// An event/DOM stub checks application wiring without pretending to verify browser layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as data from '../dist/data.js';
import * as math from '../dist/math.js';
import * as collection from '../dist/collection.js';
import * as storage from '../dist/state.js';
import * as share from '../dist/share.js';
import * as portraits from '../dist/portraits.js';

const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('initialize().catch(', 'window.__ready=initialize().catch(');
class Store{
  entries=new Map();failKey=null;
  getItem(key){return this.entries.get(key)??null;}
  setItem(key,value){if(key===this.failKey)throw Error('Storage unavailable');this.entries.set(key,String(value));}
  removeItem(key){this.entries.delete(key);}
}
class Element{
  constructor(id){this.id=id;this.value='';this.hidden=false;this.disabled=false;this.open=false;this.innerHTML='';this.textContent='';this.dataset={};this.events=new Map();this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x),contains:x=>this.classes.has(x)};}
  addEventListener(name,fn){this.events.set(name,fn);}
  querySelectorAll(){return [];}
  setAttribute(name,value){this[name]=value;}
  removeAttribute(name){delete this[name];}
  showModal(){this.open=true;}
  close(){this.open=false;}
  focus(){}
  select(){this.selected=true;}
  click(){}
  remove(){}
}
async function boot({url='https://example.com/nikke-recruit-lab/',local=new Store(),downloadBlocked=false,clipboardBlocked=false}={}){
  const elements=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
  const pages=['roster','calculator','settings'].map(id=>elements['page-'+id]);
  const navs=['roster','calculator','settings'].map(page=>{const e=new Element('nav-'+page);e.dataset.page=page;return e;});
  const docEvents=new Map(),windowEvents=new Map(),timers=new Map();let nextTimer=0;
  let currentUrl=new URL(url),reloads=0;
  const location={get href(){return currentUrl.href;},get hash(){return currentUrl.hash;},reload(){reloads++;}};
  const document={getElementById:id=>{assert.ok(elements[id],`HTML contains #${id}`);return elements[id];},createElement:tag=>{if(downloadBlocked)throw Error('Downloads unavailable');return new Element(tag);},body:{append(){}},querySelectorAll:selector=>selector==='.page'?pages:selector==='.nav-item'?navs:[],addEventListener:(key,fn)=>docEvents.set(key,fn),activeElement:{tagName:'BODY'},visibilityState:'visible'};
  const window={addEventListener:(key,fn)=>windowEvents.set(key,fn),scrollTo(){},prompt(){}};
  const modules={...data,...math,...collection,...storage,...share,...portraits,sanitize:storage.sanitizeState};
  const context=vm.createContext({...modules,document,window,location,history:{replaceState(_state,_unused,href){currentUrl=new URL(href,currentUrl);}},localStorage:local,sessionStorage:new Store(),navigator:{clipboard:{writeText:async()=>{if(clipboardBlocked)throw Error('Clipboard unavailable');}}},structuredClone,Blob,URL,crypto,confirm:()=>true,setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(script,context,{filename:'app.js'});await window.__ready;
  return {elements,local,location,window,state:()=>window.NikkeRecruitLab.getState(),reloads:()=>reloads,editRank(id,rank){elements.characters.events.get('change')({target:{dataset:{rank:id},value:String(rank)}});},navigate(page){docEvents.get('click')({target:{closest:selector=>selector==='[data-page]'?{dataset:{page}}:null}});},filterGroup(group){docEvents.get('click')({target:{closest:selector=>selector==='[data-group]'?{dataset:{group}}:null}});}};
}
const makeOwned=(id,rank)=>{const s=storage.baseState();s.owned=[id];s.ranks={[id]:rank};return s;};

test('company filters render their Overspec characters and match the displayed counts',async()=>{
  const app=await boot();
  const expected={elysion:['overspec-1'],missilis:['overspec-2','overspec-4'],tetra:['overspec-3'],pilgrim:['overspec-1','overspec-2','overspec-3','overspec-4']};
  const counts={elysion:35,missilis:29,tetra:43,pilgrim:21};
  for(const [group,ids] of Object.entries(expected)){
    app.filterGroup(group);
    const markup=app.elements.characters.innerHTML;
    assert.equal((markup.match(/data-rank="/g)||[]).length,counts[group]);
    for(const id of ['overspec-1','overspec-2','overspec-3','overspec-4'])assert.equal(markup.includes(`data-rank="${id}"`),ids.includes(id));
    assert.match(app.elements.groupFilters.innerHTML,new RegExp(`data-group="${group}"[^>]*>.*?<small>${counts[group]}</small>`));
  }
  app.filterGroup('all');
  assert.equal((app.elements.characters.innerHTML.match(/data-rank="/g)||[]).length,124);
});

test('editing then immediately saving flushes the newest state into the URL and survives reopening',async()=>{
  const local=new Store();storage.writeLocalState(local,makeOwned('elysion-1',3),'2026-10-28T01:00:00Z');
  const app=await boot({local});app.editRank('tetra-3',10);
  assert.ok(app.state().owned.includes('tetra-3'));
  await app.elements.quickSave.onclick();
  assert.equal(app.reloads(),1);
  const route=share.readFragment(app.location.hash),decoded=await share.decodeSave(route.token);
  assert.equal(decoded.state.ranks['tetra-3'],10);
  assert.equal(storage.loadLocalState(local).state.ranks['tetra-3'],10);
  const reopened=await boot({url:app.location.href,local});
  assert.equal(reopened.elements.importDialog.open,false);
  assert.match(reopened.elements.urlSaveStatus.textContent,/URLに保存済み/);
  reopened.navigate('settings');assert.equal(share.readFragment(reopened.location.hash).token,route.token);
  reopened.editRank('tetra-3',9);assert.match(reopened.elements.urlSaveStatus.textContent,/変更あり/);
});
test('a different URL waits for a choice, can preserve local data, import it, then restore the previous collection',async()=>{
  const local=new Store(),before=makeOwned('elysion-1',2),incoming=makeOwned('tetra-3',10);
  storage.writeLocalState(local,before,'2026-10-28T01:00:00Z');
  const url='https://example.com/nikke-recruit-lab/'+share.makeFragment('settings',await share.encodeSave(incoming));
  let app=await boot({url,local});assert.equal(app.elements.importDialog.open,true);
  assert.equal(storage.stateFingerprint(app.state()),storage.stateFingerprint(before));
  app.elements.keepLocal.onclick();assert.equal(app.elements.importDialog.open,false);
  assert.equal(storage.stateFingerprint(storage.loadLocalState(local).state),storage.stateFingerprint(before));
  app=await boot({url,local});app.elements.applyIncoming.onclick();
  assert.equal(storage.stateFingerprint(app.state()),storage.stateFingerprint(incoming));
  assert.equal(app.elements.restoreBackup.disabled,false);
  app.elements.restoreBackup.onclick();assert.equal(app.elements.importDialog.open,true);
  app.elements.applyIncoming.onclick();
  assert.equal(storage.stateFingerprint(app.state()),storage.stateFingerprint(before));
});
test('a new device imports the URL directly and malformed URLs leave an existing collection intact',async()=>{
  const incoming=makeOwned('tetra-3',10),token=await share.encodeSave(incoming);
  const app=await boot({url:'https://example.com/nikke-recruit-lab/'+share.makeFragment('calculator',token)});
  assert.equal(app.elements.importDialog.open,false);
  assert.equal(storage.stateFingerprint(storage.loadLocalState(app.local).state),storage.stateFingerprint(incoming));
  const original=app.local.getItem(storage.STORAGE_KEY);
  const broken=await boot({url:'https://example.com/nikke-recruit-lab/#page=roster&save=g1.broken',local:app.local});
  assert.equal(broken.local.getItem(storage.STORAGE_KEY),original);
  assert.equal(storage.stateFingerprint(broken.state()),storage.stateFingerprint(incoming));
});
test('an import that cannot save its backup does not replace the active collection',async()=>{
  const local=new Store(),before=makeOwned('elysion-1',2);
  storage.writeLocalState(local,before,'2026-10-28T01:00:00Z');local.failKey=storage.BACKUP_KEY;
  const token=await share.encodeSave(makeOwned('tetra-3',10));
  const app=await boot({url:'https://example.com/nikke-recruit-lab/'+share.makeFragment('roster',token),local});
  app.elements.applyIncoming.onclick();
  assert.equal(app.elements.importDialog.open,true);
  assert.equal(storage.stateFingerprint(app.state()),storage.stateFingerprint(before));
  assert.equal(storage.stateFingerprint(storage.loadLocalState(local).state),storage.stateFingerprint(before));
});
test('legacy JSON is offered for confirmation and the active state is backed up on import',async()=>{
  const local=new Store(),before=makeOwned('elysion-1',2);storage.writeLocalState(local,before,'2026-10-28T01:00:00Z');
  const app=await boot({local});
  const file={size:100,text:async()=>JSON.stringify({version:1,owned:['tetra-3']})};
  await app.elements.importFile.onchange({target:{files:[file],value:'backup.json'}});
  assert.equal(app.elements.importDialog.open,true);app.elements.applyIncoming.onclick();
  assert.equal(app.state().ranks['tetra-3'],0);
  assert.equal(storage.stateFingerprint(storage.loadRecovery(local).state),storage.stateFingerprint(before));
});

test('blocked downloads still expose the latest complete collection as selectable backup text',async()=>{
  const local=new Store(),original=makeOwned('elysion-1',2);
  original.resources.tickets=143;original.wish=['tetra-3'];original.rates.access=72;
  storage.writeLocalState(local,original,'2026-10-28T01:00:00Z');
  const app=await boot({local,downloadBlocked:true,clipboardBlocked:true});
  app.editRank('tetra-3',10);app.elements.quickExport.onclick();
  assert.equal(app.elements.exportDialog.open,true);
  const backup=JSON.parse(app.elements.exportText.value);
  assert.equal(storage.stateFingerprint(backup),storage.stateFingerprint(app.state()));
  assert.equal(backup.ranks['tetra-3'],10);assert.equal(backup.resources.tickets,143);
  assert.ok(backup.exportedAt);assert.match(app.elements.exportHelp.textContent,/保存できませんでした/);
  await app.elements.copyExport.onclick();assert.equal(app.elements.exportText.selected,true);
  app.elements.closeExport.onclick();assert.equal(app.elements.exportDialog.open,false);
});

test('pasted export transfers all state only after confirmation and keeps the previous data for recovery',async()=>{
  const source=await boot();source.editRank('tetra-3',10);source.elements.exportData.onclick();
  const local=new Store(),before=makeOwned('elysion-1',2);
  storage.writeLocalState(local,before,'2026-10-28T01:00:00Z');
  const destination=await boot({local});destination.elements.importText.onclick();
  destination.elements.importTextValue.value=source.elements.exportText.value;
  destination.elements.reviewTextImport.onclick();
  assert.equal(destination.elements.textImportDialog.open,false);
  assert.equal(destination.elements.importDialog.open,true);
  assert.match(destination.elements.applyIncoming.textContent,/JSON/);
  assert.equal(storage.stateFingerprint(destination.state()),storage.stateFingerprint(before));
  destination.elements.applyIncoming.onclick();
  assert.equal(storage.stateFingerprint(destination.state()),storage.stateFingerprint(source.state()));
  assert.equal(storage.stateFingerprint(storage.loadRecovery(local).state),storage.stateFingerprint(before));
});

test('invalid, unsupported and oversized pasted backups leave active and saved data intact',async()=>{
  const local=new Store(),before=makeOwned('elysion-1',2);
  storage.writeLocalState(local,before,'2026-10-28T01:00:00Z');
  const app=await boot({local}),saved=local.getItem(storage.STORAGE_KEY);
  app.elements.importText.onclick();
  for(const text of ['broken','{"version":99}',' '.repeat(2000001)]){
    app.elements.importTextValue.value=text;app.elements.reviewTextImport.onclick();
    assert.equal(app.elements.textImportDialog.open,true);
    assert.equal(app.elements.importDialog.open,false);
    assert.ok(app.elements.importTextError.textContent);
    assert.equal(local.getItem(storage.STORAGE_KEY),saved);
    assert.equal(storage.stateFingerprint(app.state()),storage.stateFingerprint(before));
  }
});
