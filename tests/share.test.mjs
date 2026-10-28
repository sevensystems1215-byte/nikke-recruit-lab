import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {CHARACTERS,SOURCES} from '../dist/data.js';
import {baseState,sanitizeState,stateFingerprint,loadLocalState,writeLocalState,loadRecovery,replaceLocalState,STORAGE_KEY,BACKUP_KEY} from '../dist/state.js';
import {encodeSave,decodeSave,readFragment,makeFragment,importDecision,MAX_TOKEN_LENGTH,MAX_DECODED_BYTES} from '../dist/share.js';

const when='2026-10-28T12:34:56.000Z';
function sample(){
  const state=baseState();
  state.owned=CHARACTERS.slice(0,93).map(c=>c.id);
  state.ranks=Object.fromEntries(state.owned.map((id,i)=>[id,i%11]));
  state.custom=[{id:'custom-example',name:'テスト：<ニケ> ＆ "別衣装"',group:'tetra',since:'2022-11-04',custom:true}];
  state.owned.push('custom-example');state.ranks['custom-example']=10;
  state.wish=['elysion-1','missilis-1','tetra-1','pilgrim-1'];state.excluded=['tetra-2'];
  state.resources=Object.fromEntries(SOURCES.map((s,i)=>[s.id,i*137+29]));
  state.rates.mid=20.5;state.rates.refund=13;state.wishEnabled=false;state.recycle=false;
  return state;
}
class MemoryStorage{
  data=new Map();failKey=null;
  getItem(key){return this.data.get(key)??null;}
  setItem(key,value){if(key===this.failKey)throw new Error('Quota exceeded');this.data.set(key,String(value));}
}
function rawToken(payload){return 'j1.'+Buffer.from(JSON.stringify(payload)).toString('base64url');}

test('compressed save retains collection, every resource, custom characters and all settings',async()=>{
  const state=sample(),token=await encodeSave(state,when);
  assert.match(token,/^g1\.[A-Za-z0-9_-]+$/);
  const decoded=await decodeSave(token);
  assert.equal(decoded.savedAt,when);assert.equal(stateFingerprint(decoded.state),stateFingerprint(state));
  assert.equal(decoded.state.ranks['custom-example'],10);
  assert.equal(decoded.state.custom[0].name,state.custom[0].name);
  assert.equal(Object.keys(decoded.state.resources).length,13);
});
test('uncompressed fallback can be restored by the same decoder',async()=>{
  const token=await encodeSave(sample(),when,{compress:false});
  assert.ok(token.startsWith('j1.'));
  assert.equal(stateFingerprint((await decodeSave(token)).state),stateFingerprint(sample()));
});
test('sharing changes neither the input object nor the existing saved data',async()=>{
  const state=sample(),before=structuredClone(state),storage=new MemoryStorage();
  writeLocalState(storage,state,when);const saved=storage.getItem(STORAGE_KEY);
  await decodeSave(await encodeSave(state,when));
  assert.deepEqual(state,before);assert.equal(storage.getItem(STORAGE_KEY),saved);
});
test('identical content with different ordering does not prompt for overwrite',()=>{
  const state=sample(),reordered=structuredClone(state);
  reordered.owned.reverse();reordered.wish.reverse();reordered.ranks=Object.fromEntries(Object.entries(reordered.ranks).reverse());
  assert.equal(importDecision(state,reordered),'same');
  assert.equal(importDecision(null,state),'import');
  reordered.ranks['elysion-1']=10;assert.equal(importDecision(state,reordered),'confirm');
});
test('page navigation retains the full save token and still accepts old page links',async()=>{
  const token=await encodeSave(sample(),when);
  for(const page of ['roster','calculator','settings'])assert.deepEqual(readFragment(makeFragment(page,token)),{page,token});
  assert.deepEqual(readFragment('#calculator'),{page:'calculator',token:null});
  assert.deepEqual(readFragment(''),{page:'roster',token:null});
  assert.throws(()=>readFragment('#page=roster&save=a&save=b'),/重複/);
});
test('broken, truncated, future and invalid payloads are rejected',async()=>{
  const token=await encodeSave(sample(),when);
  for(const value of ['', 'g1.!', 'j1.a', 'g2.abcd', token.slice(0,-9), rawToken({v:2,at:when,state:sample()}),rawToken({v:1,at:'bad',state:sample()}),rawToken({v:1,at:when,state:{version:1}})])await assert.rejects(decodeSave(value));
  const future=sample();future.snapshot='2099-01-01';
  await assert.rejects(decodeSave(rawToken({v:1,at:when,state:future})),/基準日/);
  future.snapshot='2026-10-28';future.owned.push('future-nikke');
  await assert.rejects(decodeSave(rawToken({v:1,at:when,state:future})),/未対応のキャラ/);
});
test('large input and compressed expansion have explicit limits',async()=>{
  await assert.rejects(decodeSave('j1.'+'a'.repeat(MAX_TOKEN_LENGTH)),/大きすぎ/);
  const bomb='g1.'+gzipSync(Buffer.from(' '.repeat(MAX_DECODED_BYTES+1))).toString('base64url');
  assert.ok(bomb.length<MAX_TOKEN_LENGTH);
  await assert.rejects(decodeSave(bomb),/大きすぎ/);
  const state=baseState();state.custom=Array.from({length:500},(_,i)=>({id:`custom-${i}`,name:`追加キャラクター${i}`.repeat(6).slice(0,80),group:'tetra'}));
  await assert.rejects(encodeSave(state,when,{compress:false}),/データ量/);
});
test('legacy ownership-only JSON remains compatible and initializes no limit breaks',()=>{
  const migrated=sanitizeState({version:1,owned:['elysion-1','tetra-3']});
  assert.deepEqual(migrated.ranks,{'elysion-1':0,'tetra-3':0});
  assert.equal(migrated.resources.tickets,0);
});
test('old URLs and JSON advance to the current catalog without changing inventory, resources or settings',async()=>{
  const old=sample();old.snapshot='2026-10-28';delete old.followLatest;
  const original=structuredClone(old);
  for(const migrated of [sanitizeState(old),(await decodeSave(rawToken({v:1,at:when,state:old}))).state]){
    assert.equal(migrated.snapshot,'2026-10-29');assert.equal(migrated.followLatest,true);
    for(const key of ['owned','ranks','wish','excluded','custom','resources','rates','wishEnabled','recycle'])assert.deepEqual(migrated[key],old[key]);
  }
  assert.deepEqual(old,original);
  const pinned={...old,followLatest:false};
  const decoded=await decodeSave(await encodeSave(pinned,when));
  assert.equal(decoded.state.snapshot,'2026-10-28');assert.equal(decoded.state.followLatest,false);
});
test('browser save round-trip retains content and timestamps',()=>{
  const storage=new MemoryStorage();assert.equal(loadLocalState(storage).exists,false);
  writeLocalState(storage,sample(),when);
  const loaded=loadLocalState(storage);
  assert.equal(loaded.exists,true);assert.equal(loaded.updatedAt,when);
  assert.equal(stateFingerprint(loaded.state),stateFingerprint(sample()));
});
test('replacing state keeps the previous collection as a one-generation recovery',()=>{
  const storage=new MemoryStorage(),current=sample(),next=baseState();next.resources.tickets=500;
  writeLocalState(storage,current,when);
  replaceLocalState(storage,current,next,when);
  assert.equal(loadLocalState(storage).state.resources.tickets,500);
  const recovery=loadRecovery(storage);assert.equal(stateFingerprint(recovery.state),stateFingerprint(current));
  replaceLocalState(storage,next,recovery.state,null,recovery.updatedAt);
  assert.equal(stateFingerprint(loadLocalState(storage).state),stateFingerprint(current));
  assert.equal(loadRecovery(storage).state.resources.tickets,500);
});
test('failed recovery or state writes do not overwrite the previously saved collection',()=>{
  for(const failKey of [BACKUP_KEY,STORAGE_KEY]){
    const storage=new MemoryStorage(),current=sample(),next=baseState();
    writeLocalState(storage,current,when);const original=storage.getItem(STORAGE_KEY);storage.failKey=failKey;
    assert.throws(()=>replaceLocalState(storage,current,next,when),/Quota/);
    assert.equal(storage.getItem(STORAGE_KEY),original);
    assert.equal(stateFingerprint(current),stateFingerprint(sample()));
  }
});
