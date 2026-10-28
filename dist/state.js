import {CHARACTERS,GROUPS,SOURCES,DEFAULT_RATES,SNAPSHOT} from './data.js';
import {amount} from './math.js';
import {normalizeRanks} from './collection.js';

export const STORAGE_KEY='nikke-recruit-lab-v1';
export const BACKUP_KEY=`${STORAGE_KEY}-before-import`;
const normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[\s：:・.]/g,'');
export const baseState=()=>({version:1,snapshot:SNAPSHOT,followLatest:true,owned:[],ranks:{},wish:[],excluded:[],custom:[],resources:Object.fromEntries(SOURCES.map(s=>[s.id,0])),rates:{...DEFAULT_RATES},wishEnabled:true,recycle:true});

export function sanitizeState(raw,{strict=false}={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1)throw new Error('対応していない保存形式です。');
  if(strict&&(!Array.isArray(raw.owned)||!Array.isArray(raw.wish)||!Array.isArray(raw.excluded)||!Array.isArray(raw.custom)||!raw.resources||typeof raw.resources!=='object'||!raw.rates||typeof raw.rates!=='object'))throw new Error('保存データの項目が不足しています。');
  const result=baseState();
  const strings=v=>Array.isArray(v)?[...new Set(v.filter(s=>typeof s==='string'&&s.length<150))]:[];
  if(strict&&!['2026-10-28','2026-10-29'].includes(raw.snapshot))throw new Error('このデータ基準日は未対応です。計算機を更新してください。');
  // Old saves follow the updated catalog while retaining inventory and character IDs.
  // A date explicitly selected after this update remains fixed for historical calculations.
  result.followLatest=raw.followLatest!==false;
  result.snapshot=result.followLatest?SNAPSHOT:['2026-10-28','2026-10-29'].includes(raw.snapshot)?raw.snapshot:SNAPSHOT;
  result.custom=Array.isArray(raw.custom)?raw.custom.slice(0,500).filter(c=>c&&typeof c.id==='string'&&c.id.startsWith('custom-')&&typeof c.name==='string'&&c.name.trim()&&GROUPS.some(g=>g.id===c.group)).map(c=>({id:c.id.slice(0,100),name:c.name.trim().slice(0,80),group:c.group,since:'2022-11-04',custom:true})):[];
  result.custom=result.custom.filter((c,i,a)=>a.findIndex(x=>x.id===c.id)===i&&!CHARACTERS.some(x=>normalize(x.name)===normalize(c.name)));
  const known=new Set([...CHARACTERS,...result.custom].map(c=>c.id));
  if(strict&&['owned','wish','excluded'].some(key=>raw[key].some(id=>!known.has(id))))throw new Error('未対応のキャラが含まれています。計算機の更新かJSONでの移行を確認してください。');
  result.owned=strings(raw.owned).filter(id=>known.has(id));
  result.ranks=normalizeRanks(result.owned,raw.ranks);
  result.excluded=strings(raw.excluded).filter(id=>known.has(id));
  const available=[...CHARACTERS,...result.custom].filter(c=>c.since<=result.snapshot);
  for(const group of GROUPS){const members=available.filter(c=>c.group===group.id);if(members.length&&members.every(c=>result.excluded.includes(c.id)))result.excluded=result.excluded.filter(id=>id!==members[0].id);}
  const availableIds=new Set(available.map(c=>c.id));
  result.wish=strings(raw.wish).filter(id=>known.has(id)&&availableIds.has(id)&&!result.excluded.includes(id));
  const groups={};result.wish=result.wish.filter(id=>{const g=[...CHARACTERS,...result.custom].find(c=>c.id===id).group;groups[g]=(groups[g]||0)+1;return groups[g]<=5;});
  for(const s of SOURCES)result.resources[s.id]=amount(raw.resources?.[s.id]);
  for(const [id,value] of Object.entries(DEFAULT_RATES))result.rates[id]=Math.min(100,Math.max(0,Number.isFinite(Number(raw.rates?.[id]))?Number(raw.rates[id]):value));
  if(result.rates.ticketNormal+result.rates.ticketRare>100){result.rates.ticketNormal=3.5;result.rates.ticketRare=.5;}
  result.wishEnabled=raw.wishEnabled!==false;result.recycle=raw.recycle!==false;
  return result;
}

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
export function canonicalState(raw){
  const state=sanitizeState(raw);
  for(const key of ['owned','wish','excluded'])state[key].sort();
  state.custom.sort((a,b)=>a.id.localeCompare(b.id));
  return stable(state);
}
export const stateFingerprint=raw=>JSON.stringify(canonicalState(raw));

export function loadLocalState(storage){
  const raw=storage.getItem(STORAGE_KEY);
  if(!raw)return {exists:false,state:baseState(),updatedAt:null};
  const parsed=JSON.parse(raw);
  return {exists:true,state:sanitizeState(parsed),updatedAt:validDate(parsed._updatedAt)};
}
export function validDate(value){
  return typeof value==='string'&&value.length<40&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
}
export function writeLocalState(storage,state,updatedAt){
  storage.setItem(STORAGE_KEY,JSON.stringify({...sanitizeState(state),_updatedAt:updatedAt}));
}
export function loadRecovery(storage){
  const raw=storage.getItem(BACKUP_KEY);if(!raw)return null;
  const record=JSON.parse(raw);
  return {state:sanitizeState(record.state),updatedAt:validDate(record.updatedAt),createdAt:validDate(record.createdAt)};
}
// Write the recovery first. If either write fails, callers retain their in-memory state.
export function replaceLocalState(storage,current,next,currentUpdatedAt,nextUpdatedAt=new Date().toISOString()){
  const recovery={state:sanitizeState(current),updatedAt:validDate(currentUpdatedAt),createdAt:new Date().toISOString()};
  storage.setItem(BACKUP_KEY,JSON.stringify(recovery));
  writeLocalState(storage,next,nextUpdatedAt);
  return recovery;
}
