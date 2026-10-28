export const RANK_OPTIONS = [
  {value:-1,label:'未所持'},
  {value:0,label:'無凸'},
  {value:1,label:'1凸'},
  {value:2,label:'2凸'},
  {value:3,label:'3凸'},
  ...Array.from({length:7},(_,i)=>({value:i+4,label:`コア＋${i+1}${i===6?'（最大）':''}`}))
];

const validRank=value=>typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=10;

// Collection filters include an Overspec's manufacturer without changing its recruit pool.
export function matchesCollectionGroup(character,group){
  return group==='all'||character.group===group||(character.overspec===true&&character.manufacturer===group);
}

// Old backups only tracked ownership. Keep it and start owned characters at 0.
export function normalizeRanks(owned,raw){
  const values=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  return Object.fromEntries(owned.map(id=>[id,validRank(values[id])?values[id]:0]));
}

export function rankFor(state,id){
  if(!state.owned.includes(id))return -1;
  return validRank(state.ranks?.[id])?state.ranks[id]:0;
}

export function rankLabel(rank){return RANK_OPTIONS.find(option=>option.value===rank)?.label||'無凸';}

export function setOwnership(state,id,isOwned){
  state.ranks??={};
  if(isOwned){
    if(!state.owned.includes(id))state.owned.push(id);
    if(!validRank(state.ranks[id]))state.ranks[id]=0;
  }else{
    state.owned=state.owned.filter(value=>value!==id);
    delete state.ranks[id];
  }
}

export function setRank(state,id,value){
  if(value!==-1&&!validRank(value))return false;
  setOwnership(state,id,value>=0);
  if(value>=0)state.ranks[id]=value;
  return true;
}

export function matchesRank(state,id,filter){
  if(filter==='all')return true;
  const rank=rankFor(state,id);
  if(rank<0)return false;
  if(filter==='mlb')return rank>=3;
  if(filter==='core')return rank>=4;
  if(filter==='max')return rank===10;
  return rank===Number(filter);
}
