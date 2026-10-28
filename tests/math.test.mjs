import test from 'node:test';
import assert from 'node:assert/strict';
import {buildModel,accessProcess} from '../dist/math.js';
import {CHARACTERS,DEFAULT_RATES,SOURCES} from '../dist/data.js';

const chars=CHARACTERS.filter(c=>c.since<='2026-10-28');
const base=()=>({owned:[],wish:[],resources:Object.fromEntries(SOURCES.map(s=>[s.id,0])),rates:{...DEFAULT_RATES},wishEnabled:false,recycle:true});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('snapshot contains only the 124 ordinary-recruit SSRs, with separate overspec category',()=>{
  assert.equal(chars.length,124);assert.equal(new Set(chars.map(c=>c.id)).size,124);assert.equal(new Set(chars.map(c=>c.name)).size,124);
  assert.deepEqual(['elysion','missilis','tetra','pilgrim'].map(g=>chars.filter(c=>c.group===g).length),[34,27,42,21]);
  assert.equal(CHARACTERS.filter(c=>c.since<='2026-10-29').length,127);
});
test('October 29 additions enter the correct company and common recruit pools without changing total SSR rates',()=>{
  const latest=CHARACTERS.filter(c=>c.since<='2026-10-29');
  assert.deepEqual(['elysion','missilis','tetra','pilgrim'].map(g=>latest.filter(c=>c.group===g).length),[34,29,43,21]);
  const s=base();s.resources.tickets=100;
  const model=buildModel(latest,s);close(model.ssr,4);
  for(const id of ['missilis-guilty-bunny','missilis-sin-bunny','tetra-belorta-witch'])close(model.rows.find(c=>c.id===id).ticketP,.035/106);
  s.resources.tickets=0;s.resources.missilisPerfect=50;
  const missilis=buildModel(latest,s);
  for(const id of ['missilis-guilty-bunny','missilis-sin-bunny'])close(missilis.rows.find(c=>c.id===id).probability,1/29);
  close(missilis.rows.find(c=>c.id==='tetra-belorta-witch').probability,0);
  s.resources.missilisPerfect=0;s.resources.tetraPerfect=50;
  close(buildModel(latest,s).rows.find(c=>c.id==='tetra-belorta-witch').probability,1/43);
});
test('zero resources produces zero expected new, total SSR, and chance',()=>{const m=buildModel(chars,base());close(m.distinct,0);close(m.ssr,0);close(m.anyNew,0);});
test('100 non-wishlist pulls split 3.5% / 0.5% correctly and account for duplicates',()=>{
  const s=base();s.resources.tickets=100;const m=buildModel(chars,s);
  close(m.ssr,4);close(m.anyNew,1-.96**100);
  close(m.distinct,103*(1-(1-.035/103)**100)+21*(1-(1-.005/21)**100));
});
test('wishlist probabilities sum to 4% and all other characters have zero ticket probability',()=>{
  const s=base();s.wishEnabled=true;s.resources.tickets=100;
  s.wish=['elysion','missilis','tetra','pilgrim'].flatMap(g=>chars.filter(c=>c.group===g).slice(0,5).map(c=>c.id));
  const m=buildModel(chars,s);assert.equal(m.valid,true);
  close(m.rows.reduce((a,c)=>a+c.ticketP,0),.04);
  for(const c of m.rows)close(c.ticketP,s.wish.includes(c.id)?c.group==='pilgrim'?.001:.035/15:0);
  close(m.distinct,15*(1-(1-.035/15)**100)+5*(1-.999**100));
});
test('incomplete wishlist does not invent a new-character probability',()=>{
  const s=base();s.wishEnabled=true;s.resources.tickets=10;const m=buildModel(chars,s);
  assert.equal(m.valid,false);assert.equal(m.distinct,null);assert.equal(m.anyNew,null);close(m.ssr,.4);
});
test('molds still calculate with an incomplete wishlist when no ordinary tickets are used',()=>{
  const s=base();s.wishEnabled=true;s.resources.high=50;const m=buildModel(chars,s);
  assert.equal(m.valid,true);close(m.distinct,.61);close(m.anyNew,.61);
});
test('company pools exclude overspec; pilgrim molds include all four overspecs',()=>{
  const s=base();s.resources.elysionPerfect=50;const m=buildModel(chars,s);
  close(m.ssr,1);close(m.distinct,1);close(m.anyNew,1);
  close(m.rows.find(c=>c.id==='elysion-1').probability,1/34);
  close(m.rows.find(c=>c.id==='overspec-1').probability,0);
  s.resources.elysionPerfect=0;s.resources.pilgrimMold=50;const p=buildModel(chars,s);close(p.rows.find(c=>c.id==='overspec-1').probability,.5/21);
});
test('fragment remainders do not create a draw before reaching 50',()=>{
  const s=base();s.resources.high=49;const m=buildModel(chars,s);close(m.ssr,0);assert.equal(m.details.find(d=>d.id==='high').remainder,49);
  s.resources.high=101;const x=buildModel(chars,s);close(x.ssr,1.22);assert.equal(x.details.find(d=>d.id==='high').draws,2);
});
test('all-owned collections have zero new probability regardless of resources',()=>{
  const s=base();s.owned=chars.map(c=>c.id);s.resources.tickets=100;s.resources.high=500;s.resources.access=1000;s.resources.perfect=49;
  const m=buildModel(chars,s);close(m.distinct,0);close(m.anyNew,0);assert.ok(m.ssr>4);
});
test('cross-source duplication is counted once per initially missing character',()=>{
  const s=base(),target=chars.find(c=>c.id==='elysion-1');s.owned=chars.filter(c=>c.id!==target.id).map(c=>c.id);s.resources.high=100;s.resources.tickets=30;s.resources.elysionPerfect=50;
  const expected=1-(1-.61/103)**2*(1-.035/103)**30*(1-1/34),m=buildModel(chars,s);
  close(m.distinct,expected);close(m.anyNew,expected);
});
function bruteAccess(n,r,success,refund,miss){
  let noHit=0,extra=0;
  const visit=(i,p,f)=>{if(i===n){const bonus=Math.floor((r+f*refund)/50);noHit+=p*miss**(n-f+bonus);extra+=p*bonus;return;}visit(i+1,p*success,f);visit(i+1,p*(1-success),f+1);};
  visit(0,1,0);return {noHit,extra};
}
test('access refund dynamic calculation matches exhaustive success/failure outcomes',()=>{
  for(const n of [1,2,5,8])for(const r of [0,37,38,49])for(const miss of [0,.4,.99,1]){
    const expected=bruteAccess(n,r,.61,12,miss),actual=accessProcess(n,r,.61,12,miss,true);
    close(actual.noHit,expected.noHit);close(actual.extra,expected.extra);
  }
});
test('one access and 38 perfect fragments guarantees one SSR, without counting both branches',()=>{
  const s=base();s.resources.access=50;s.resources.perfect=38;const m=buildModel(chars,s);
  close(m.ssr,1);close(m.additional,.39);close(m.distinct,1);close(m.anyNew,1);
  close(m.rows.find(c=>c.id==='elysion-1').probability,1/103);
});
test('switching off access recycling excludes refund SSRs',()=>{
  const s=base();s.resources.access=50;s.resources.perfect=38;s.recycle=false;const m=buildModel(chars,s);
  close(m.ssr,.61);close(m.additional,0);close(m.distinct,.61);close(m.anyNew,.61);
});
test('existing complete perfect molds and remainder refunds are not double counted',()=>{
  const s=base();s.resources.access=50;s.resources.perfect=88;const m=buildModel(chars,s);
  close(m.ssr,2);close(m.distinct,103*(1-(1-1/103)**2));close(m.anyNew,1);
});
test('100% success and 100% failure access settings have deterministic results',()=>{
  close(accessProcess(10,0,1,12,.9,true).noHit,.9**10);
  close(accessProcess(10,0,0,12,.9,true).noHit,.9**2);
  close(accessProcess(10,0,0,12,1,true).extra,2);
});
