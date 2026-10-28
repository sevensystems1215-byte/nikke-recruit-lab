import test from 'node:test';
import assert from 'node:assert/strict';
import {RANK_OPTIONS,normalizeRanks,rankFor,rankLabel,setOwnership,setRank,matchesRank,matchesCollectionGroup} from '../dist/collection.js';
import {buildModel} from '../dist/math.js';
import {CHARACTERS,DEFAULT_RATES,SOURCES} from '../dist/data.js';

test('Overspec characters match both their recruit pool and the requested manufacturer',()=>{
  const manufacturers={'overspec-1':'elysion','overspec-2':'missilis','overspec-3':'tetra','overspec-4':'missilis'};
  for(const [id,manufacturer] of Object.entries(manufacturers)){
    const character=CHARACTERS.find(c=>c.id===id);
    assert.equal(matchesCollectionGroup(character,'all'),true);
    assert.equal(matchesCollectionGroup(character,'pilgrim'),true);
    assert.equal(matchesCollectionGroup(character,manufacturer),true);
    for(const other of ['elysion','missilis','tetra'].filter(group=>group!==manufacturer))assert.equal(matchesCollectionGroup(character,other),false);
    assert.equal(character.group,'pilgrim');
  }
});
test('collection group counts overlap for Overspec while the all-character list stays unique',()=>{
  const chars=CHARACTERS.filter(c=>c.since<='2026-10-28');
  assert.deepEqual(['all','elysion','missilis','tetra','pilgrim'].map(group=>chars.filter(c=>matchesCollectionGroup(c,group)).length),[124,35,29,43,21]);
  const emma=chars.find(c=>c.name==='エマ');
  assert.equal(matchesCollectionGroup(emma,'elysion'),true);
  assert.equal(matchesCollectionGroup(emma,'pilgrim'),false);
});

test('ownership-only saved data migrates to zero limit breaks',()=>{
  assert.deepEqual(normalizeRanks(['a','b'],undefined),{a:0,b:0});
  assert.deepEqual(normalizeRanks(['a'],null),{a:0});
});
test('saved progression keeps valid owned records and drops orphan entries',()=>{
  assert.deepEqual(normalizeRanks(['a','b','c'],{a:3,b:10,c:0,orphan:7}),{a:3,b:10,c:0});
});
test('invalid imported progression values become zero without coercing strings',()=>{
  const raw={a:11,b:-1,c:2.5,d:'3',e:null,f:NaN,g:Infinity};
  assert.deepEqual(normalizeRanks(Object.keys(raw),raw),{a:0,b:0,c:0,d:0,e:0,f:0,g:0});
});
test('selecting each valid progression state registers ownership and preserves its label',()=>{
  const state={owned:[],ranks:{}};
  for(const option of RANK_OPTIONS.filter(x=>x.value>=0)){
    assert.equal(setRank(state,'a',option.value),true);
    assert.deepEqual(state.owned,['a']);
    assert.equal(rankFor(state,'a'),option.value);
    assert.equal(rankLabel(option.value),option.label);
  }
  assert.equal(rankLabel(10),'コア＋7（最大）');
});
test('returning to unowned clears progression; selecting zero registers ownership again',()=>{
  const state={owned:['a'],ranks:{a:8}};
  setRank(state,'a',-1);assert.equal(rankFor(state,'a'),-1);assert.deepEqual(state.ranks,{});
  setRank(state,'a',0);assert.equal(rankFor(state,'a'),0);assert.deepEqual(state.owned,['a']);
});
test('bulk ownership retains already-entered progression and initializes only new characters',()=>{
  const state={owned:['a'],ranks:{a:9}};
  ['a','b','c'].forEach(id=>setOwnership(state,id,true));
  assert.deepEqual(state.ranks,{a:9,b:0,c:0});
  assert.deepEqual(state.owned,['a','b','c']);
});
test('invalid rank changes do not mutate ownership or saved progression',()=>{
  const state={owned:['a'],ranks:{a:3}},before=structuredClone(state);
  for(const value of [11,Infinity,NaN,-2,2.5,'3'])assert.equal(setRank(state,'a',value),false);
  assert.deepEqual(state,before);
});
test('progression filters respect three-limit-break and core thresholds',()=>{
  const state={owned:['zero','three','core','max'],ranks:{zero:0,three:3,core:4,max:10}};
  for(const id of ['three','core','max'])assert.equal(matchesRank(state,id,'mlb'),true);
  for(const id of ['missing','zero'])assert.equal(matchesRank(state,id,'mlb'),false);
  assert.equal(matchesRank(state,'three','core'),false);
  assert.equal(matchesRank(state,'core','core'),true);
  assert.equal(matchesRank(state,'max','max'),true);
  assert.equal(matchesRank(state,'core','max'),false);
  assert.equal(matchesRank(state,'missing','0'),false);
  assert.equal(matchesRank(state,'zero','0'),true);
});
test('JSON backup round-trip retains progression and ownership',()=>{
  const original={owned:['a','b','c'],ranks:{a:0,b:3,c:10}};
  const restored=JSON.parse(JSON.stringify(original));restored.ranks=normalizeRanks(restored.owned,restored.ranks);
  assert.deepEqual(restored,original);
});
test('editing progression preserves the original random-recruit expectation model',()=>{
  const chars=CHARACTERS.filter(c=>c.since<='2026-10-28');
  const state={owned:[],ranks:{},wish:[],resources:Object.fromEntries(SOURCES.map(s=>[s.id,0])),rates:{...DEFAULT_RATES},wishEnabled:false,recycle:true};
  state.resources.tickets=100;
  setRank(state,chars[0].id,0);const base=buildModel(chars,state);
  setRank(state,chars[0].id,10);const maxed=buildModel(chars,state);
  assert.equal(base.distinct,maxed.distinct);assert.equal(base.ssr,maxed.ssr);assert.equal(base.anyNew,maxed.anyNew);
});
