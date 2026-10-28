import {SOURCES,DEFAULT_RATES} from './data.js';

export function amount(value){ return Math.min(999999,Math.max(0,Math.floor(Number(value)||0))); }
export function sourceRate(source,rates={}){
  const r={...DEFAULT_RATES,...rates};
  return source.id==='high'?r.high/100:source.id==='mid'?r.mid/100:source.id==='access'?r.access/100:source.rate===.5?r.company/100:source.rate;
}
// A failure awards fragments, a success awards one uniformly chosen SSR.
// The 50-state distribution also accounts for crossing 50 fragments several times.
export function accessProcess(n,initialRemainder,success=.61,refund=12,miss=1,recycle=true){
  if(!n)return {noHit:1,extra:0};
  if(!recycle)return {noHit:Math.pow(1-success+success*miss,n),extra:0};
  let states=new Float64Array(50), weighted=new Float64Array(50);
  states[initialRemainder]=1;weighted[initialRemainder]=1;
  let extra=0;
  for(let i=0;i<n;i++){
    const next=new Float64Array(50), nextW=new Float64Array(50);
    for(let r=0;r<50;r++){
      if(!states[r]&&!weighted[r])continue;
      const pieces=r+refund,earned=Math.floor(pieces/50),rem=pieces%50;
      next[r]+=states[r]*success;
      next[rem]+=states[r]*(1-success);
      extra+=states[r]*(1-success)*earned;
      nextW[r]+=weighted[r]*success*miss;
      nextW[rem]+=weighted[r]*(1-success)*Math.pow(miss,earned);
    }
    states=next;weighted=nextW;
  }
  return {noHit:weighted.reduce((a,b)=>a+b,0),extra};
}
export function buildModel(chars,state){
  const owned=new Set(state.owned),wish=new Set(state.wish),rates={...DEFAULT_RATES,...state.rates};
  const pools={all:chars,normal:chars.filter(c=>c.group!=='pilgrim')};
  for(const group of ['elysion','missilis','tetra','pilgrim'])pools[group]=chars.filter(c=>c.group===group);
  const wishlistValid=Object.keys(pools).filter(g=>!['normal','all'].includes(g)).every(g=>pools[g].filter(c=>wish.has(c.id)).length===5);
  const ticketValid=!state.wishEnabled||wishlistValid;
  const missing=chars.filter(c=>!owned.has(c.id));
  const ticketP=c=>{
    const rate=(c.group==='pilgrim'?rates.ticketRare:rates.ticketNormal)/100;
    if(state.wishEnabled)return ticketValid&&wish.has(c.id)?rate/(c.group==='pilgrim'?5:15):0;
    return rate/Math.max(1,c.group==='pilgrim'?pools.pilgrim.length:pools.normal.length);
  };
  const details=SOURCES.map(source=>{
    const count=amount(state.resources[source.id]);
    return {...source,count,draws:Math.floor(count/source.unit),remainder:count%source.unit,rate:sourceRate(source,rates),size:pools[source.pool].length};
  });
  const nAccess=details.find(x=>x.id==='access').draws;
  const perfectRem=details.find(x=>x.id==='perfect').remainder;
  const accessMemo=new Map();
  const accessNoHit=miss=>{
    const key=String(miss);
    if(!accessMemo.has(key))accessMemo.set(key,accessProcess(nAccess,perfectRem,rates.access/100,amount(rates.refund),miss,state.recycle));
    return accessMemo.get(key);
  };
  const additional=accessNoHit(1).extra;
  const baseNoHit=c=>{
    let p=1;
    for(const s of details){
      if(s.kind==='ticket'||s.kind==='access'||!s.draws||!s.size)continue;
      if(s.pool==='normal'&&c.group==='pilgrim'||s.pool!=='normal'&&s.pool!==c.group)continue;
      p*=Math.pow(1-s.rate/s.size,s.draws);
    }
    if(c.group!=='pilgrim'&&pools.normal.length)p*=accessNoHit(1-1/pools.normal.length).noHit;
    return p;
  };
  const entries=chars.map(c=>({...c,owned:owned.has(c.id),wish:wish.has(c.id),ticketP:ticketP(c),baseNoHit:baseNoHit(c)}));
  const nTickets=amount(state.resources.tickets);
  const rows=entries.map(c=>({...c,expected:nTickets*c.ticketP,probability:1-c.baseNoHit*Math.pow(1-c.ticketP,nTickets)}));
  const normalMissing=missing.filter(c=>c.group!=='pilgrim').length;
  let otherNoNew=1;
  for(const s of details){
    if(s.kind==='ticket'||s.kind==='access'||!s.draws||!s.size)continue;
    const missingPool=pools[s.pool].filter(c=>!owned.has(c.id)).length;
    otherNoNew*=Math.pow(1-s.rate*missingPool/s.size,s.draws);
  }
  if(pools.normal.length)otherNoNew*=accessNoHit(1-normalMissing/pools.normal.length).noHit;
  const missingTicketP=entries.filter(c=>!c.owned).reduce((a,c)=>a+c.ticketP,0);
  const newProbability=n=>1-otherNoNew*Math.pow(1-missingTicketP,n);
  const expectedDistinct=n=>entries.filter(c=>!c.owned).reduce((a,c)=>a+1-c.baseNoHit*Math.pow(1-c.ticketP,n),0);
  const ssr=details.reduce((a,s)=>a+s.draws*(s.kind==='ticket'?(rates.ticketNormal+rates.ticketRare)/100:s.rate),0)+additional;
  const valid=ticketValid||nTickets===0;
  return {details,rows,pools,missing,ticketValid,wishlistValid,valid,additional,ssr,newProbability,expectedDistinct,
    distinct:valid?expectedDistinct(nTickets):null,anyNew:valid?newProbability(nTickets):null,
    directDraws:details.reduce((a,s)=>a+s.draws,0),nTickets};
}
