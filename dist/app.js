import {CHARACTERS,GROUPS,SOURCES,DEFAULT_RATES,SNAPSHOT,REFERENCES} from './data.js';
import {amount,buildModel} from './math.js';
import {RANK_OPTIONS,rankFor,rankLabel,setOwnership,setRank,matchesRank,matchesCollectionGroup} from './collection.js';
import {PORTRAITS} from './portraits.js';
import {baseState,sanitizeState as sanitize,stateFingerprint,loadLocalState,writeLocalState,loadRecovery,replaceLocalState} from './state.js';
import {encodeSave,decodeSave,readFragment,makeFragment,importDecision} from './share.js';

const $=id=>document.getElementById(id);
const icons={grid:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>',chart:'<path d="M4 4v16h17M8 15l4-5 4 2 5-7"/>',settings:'<path d="M12 3l2 2 3-.5 1 3 3 1v4l-3 1-1 3-3-.5-2 2-2-2-3 .5-1-3-3-1v-4l3-1 1-3 3 .5z"/><circle cx="12" cy="11" r="3"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>',arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',star:'<path d="m12 3 2.8 5.8 6.4 1-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-1z"/>',check:'<path d="m5 12 4 4L19 6"/>',plus:'<path d="M12 4v16M4 12h16"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',save:'<path d="M4 3h14l3 3v15H3V3zM7 3v7h10V3M7 21v-7h10v7"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/>',ticket:'<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4zM15 6v3m0 3v1m0 3v2"/>'};
function icon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.grid}</svg>`;}
function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groupFor=id=>GROUPS.find(g=>g.id===id);
const fmt=n=>Number(n).toLocaleString('ja-JP',{maximumFractionDigits:2,minimumFractionDigits:2});
const pct=(n,digits=1)=>`${(Math.max(0,Math.min(1,n))*100).toFixed(digits)}%`;
const normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[\s：:・.]/g,'');
let state=baseState(),storageAvailable=true,saveTimer,calcTimer,toastTimer,page='roster';
let localUpdatedAt=null,localExists=false,lastPersisted=null,localReadError=false,hasEdited=false;
let urlToken=null,urlSnapshot=null,urlSavedAt=null,savingUrl=false,pendingIncoming=null,routeRequest=0;
const filters={group:'all',status:'all',search:'',rank:'all'};
try{
  const loaded=loadLocalState(localStorage);state=loaded.state;localExists=loaded.exists;
  localUpdatedAt=loaded.updatedAt;lastPersisted=stateFingerprint(state);
}catch(e){storageAvailable=false;localReadError=true;}
function catalog(){return [...CHARACTERS,...state.custom].filter(c=>c.since<=state.snapshot);}
function activeChars(){return catalog().filter(c=>!state.excluded.includes(c.id));}
function persist(){
  if(localReadError&&!hasEdited)return false;
  const fingerprint=stateFingerprint(state);
  const updatedAt=fingerprint===lastPersisted&&localUpdatedAt?localUpdatedAt:new Date().toISOString();
  try{
    writeLocalState(localStorage,state,updatedAt);storageAvailable=true;localReadError=false;
    localUpdatedAt=updatedAt;lastPersisted=fingerprint;localExists=true;
  }catch(e){storageAvailable=false;}
  renderSaveStatus();return storageAvailable;
}
function save(){hasEdited=true;renderSaveStatus();clearTimeout(saveTimer);saveTimer=setTimeout(persist,150);}
function dateLabel(value){if(!value)return '日時不明';return new Date(value).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function renderSaveStatus(){
  const same=urlSnapshot!==null&&stateFingerprint(state)===urlSnapshot;
  $('saveStatus').textContent=storageAvailable?'この端末に保存済み':'端末に保存できません';
  $('localSaveStatus').textContent=storageAvailable?'この端末に自動保存':'端末保存不可・JSONでバックアップ';
  $('urlSaveStatus').textContent=savingUrl?'URLに保存しています…':same?`URLに保存済み · ${dateLabel(urlSavedAt)}`:urlToken?'変更あり・セーブしてください':'URL未保存・セーブして引き継ぎ';
  $('saveBar').classList.toggle('is-dirty',!same);
  $('quickSave').disabled=savingUrl;$('saveUrl').disabled=savingUrl;
  $('copyUrl').disabled=!same||savingUrl;
  $('storageMessage').textContent=storageAvailable?'編集内容はこの端末に自動保存されます。別の端末へはセーブ後のタブを共有してください。':'端末内への保存ができません。JSONを書き出してデータを残してください。';
  try{const recovery=loadRecovery(localStorage);$('restoreBackup').disabled=!recovery;$('recoveryInfo').textContent=recovery?`取り込み前のデータ：所持${recovery.state.owned.length}体 · ${dateLabel(recovery.createdAt)}`:'URLまたはJSONを取り込む前のデータを1世代残します。';}catch(e){$('restoreBackup').disabled=true;}
}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}
function navigate(next){
  page=['roster','calculator','settings'].includes(next)?next:'roster';
  document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==`page-${page}`);
  document.querySelectorAll('.nav-item').forEach(el=>{el.classList.toggle('active',el.dataset.page===page);if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  $('pageLabel').textContent={roster:'所持一覧',calculator:'期待値を計算',settings:'データ・設定'}[page];
  history.replaceState(null,'',makeFragment(page,urlToken));if(page==='calculator')renderCalculation();if(page==='settings')renderSettings();window.scrollTo({top:0,behavior:'instant'});
}
function refreshMeta(){
  const chars=activeChars(),owned=chars.filter(c=>state.owned.includes(c.id)).length,wish=chars.filter(c=>state.wish.includes(c.id)).length;
  const mlb=chars.filter(c=>rankFor(state,c.id)>=3).length;
  $('navTotal').textContent=chars.length;$('sideWish').textContent=wish;$('catalogCount').textContent=`${chars.length} NIKKES`;
  $('topDate').textContent=`DATA ${state.snapshot.replaceAll('-','.')}`;$('footerDate').textContent=`DATA · ${state.snapshot.replaceAll('-','.')}`;
  const draws=SOURCES.reduce((a,s)=>a+Math.floor(amount(state.resources[s.id])/s.unit),0);
  const stats=[{label:'所持済み',value:owned,denom:`/ ${chars.length}`,icon:'check',class:'owned-stat',progress:chars.length?owned/chars.length:0,foot:`達成率 ${chars.length?(owned/chars.length*100).toFixed(1):0}% · 3凸以上 ${mlb}体`},{label:'未所持のSSR',value:chars.length-owned,denom:'体',icon:'users',foot:'次に迎えたいニケをチェック'},{label:'ウィッシュリスト',value:wish,denom:'/ 20',icon:'star',foot:wish===20?'4グループすべて設定済み':'各グループ5体で一般募集に反映'},{label:'手持ちで使える回数',value:draws,denom:'回',icon:'ticket',foot:'チケット＋モールド・アクセス'}];
  $('rosterStats').innerHTML=stats.map(s=>`<article class="stat ${s.class||''}"><div class="stat-label"><span>${s.label}</span><span data-icon="${s.icon}"></span></div><div class="stat-number">${s.value.toLocaleString('ja-JP')}<small>${s.denom}</small></div>${s.progress!==undefined?`<div class="progress-line"><i style="width:${s.progress*100}%"></i></div>`:''}<div class="stat-foot">${s.foot}</div></article>`).join('');
  hydrateIcons($('rosterStats'));
  $('groupFilters').innerHTML=[{id:'all',name:'すべて',color:null},...GROUPS].map(g=>`<button class="group-filter ${filters.group===g.id?'active':''}" data-group="${g.id}" aria-pressed="${filters.group===g.id}">${g.color?`<span class="dot" style="background:${g.color}"></span>`:''}${g.name}<small>${chars.filter(c=>matchesCollectionGroup(c,g.id)).length}</small></button>`).join('');
}
function visibleCharacters(){return activeChars().filter(c=>matchesCollectionGroup(c,filters.group)&&(!filters.search||normalize(c.name).includes(normalize(filters.search)))&&(filters.status==='all'||filters.status==='owned'&&state.owned.includes(c.id)||filters.status==='missing'&&!state.owned.includes(c.id)||filters.status==='wish'&&state.wish.includes(c.id))&&matchesRank(state,c.id,filters.rank));}
function renderRoster(){
  refreshMeta();const chars=visibleCharacters();
  $('visibleCount').textContent=`${chars.length}体を表示`;
  $('characters').innerHTML=chars.map(c=>{
    const g=groupFor(c.manufacturer||c.group),owned=state.owned.includes(c.id),wish=state.wish.includes(c.id);
    const split=c.name.split('：'),title=esc(split[0])+(split[1]?`<span>：${esc(split.slice(1).join('：'))}</span>`:'');
    return `<article class="character-card ${owned?'is-owned':''} ${wish?'is-wish':''}" style="--group-color:${g.color}">${portraitMarkup(c)}<div class="character-info"><div class="character-meta">${g.en}${c.overspec?'<span class="os-tag">OS</span>':''}${c.custom?'<span class="os-tag">CUSTOM</span>':''}</div><div class="character-name">${title}</div><div class="ownership-row"><button class="ownership" data-own="${esc(c.id)}" aria-pressed="${owned}" aria-label="${esc(c.name)}：${owned?'所持済み。押すと未所持に変更':'未所持。押すと所持済みに変更'}"><span class="check-circle">${owned?'✓':''}</span><span>${owned?'所持済み':'未所持'}</span></button><select class="rank-select ${rankFor(state,c.id)>=3?'rank-mlb':''}" data-rank="${esc(c.id)}" aria-label="${esc(c.name)}の凸状況">${RANK_OPTIONS.map(option=>`<option value="${option.value}" ${rankFor(state,c.id)===option.value?'selected':''}>${option.label}</option>`).join('')}</select></div></div><button class="wish-button ${wish?'selected':''}" data-wish="${esc(c.id)}" aria-pressed="${wish}" title="${wish?'ウィッシュリストから外す':'ウィッシュリストに追加'}" aria-label="${esc(c.name)}をウィッシュリスト${wish?'から外す':'に追加'}">${wish?'★':'☆'}</button></article>`;
  }).join('');
  $('noResults').hidden=chars.length>0;$('bulkOwned').disabled=chars.length===0;$('bulkMissing').disabled=chars.length===0;
  $('rankFilter').value=filters.rank;
  $('statusFilters').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.status===filters.status);b.setAttribute('aria-pressed',String(b.dataset.status===filters.status));});
}
function toggleWish(id){
  if(state.wish.includes(id))state.wish=state.wish.filter(x=>x!==id);
  else{const char=activeChars().find(c=>c.id===id);if(!char)return;const count=activeChars().filter(c=>c.group===char.group&&state.wish.includes(c.id)).length;if(count>=5){toast(`${groupFor(char.group).name}は5体まで登録できます`);return;}state.wish.push(id);}
  save();renderRoster();if(page==='calculator')renderCalculation();if($('wishDialog').open)renderWishDialog();
}
function renderResources(){
  let divider='';
  $('resourceInputs').innerHTML=SOURCES.map((s,i)=>{
    if(i===1)divider='<div class="resource-divider">COMMON MOLDS / ACCESS</div>';else if(i===5)divider='<div class="resource-divider">MANUFACTURER MOLDS</div>';else divider='';
    const count=amount(state.resources[s.id]),draws=Math.floor(count/s.unit),rem=count%s.unit;
    return `${divider}<label class="resource-field ${i===0?'featured':''}"><span><span class="resource-title">${esc(s.name)}</span><span class="resource-subtitle" id="sub-${s.id}">${i===0?'1枚につき1回':`${draws}回使用 · 端数${rem}個`}</span></span><input type="number" data-resource="${s.id}" id="resource-${s.id}" min="0" max="999999" step="1" value="${count}" aria-label="${esc(s.name)}の${i===0?'枚数':'個数'}" inputmode="numeric"></label>`;
  }).join('');
}
function renderWishlist(){
  const chars=activeChars();
  $('wishMode').value=state.wishEnabled?'on':'off';$('recycle').checked=state.recycle;
  $('wishlistOverview').innerHTML=GROUPS.map(g=>{
    const chosen=chars.filter(c=>c.group===g.id&&state.wish.includes(c.id));
    return `<div class="wishlist-group"><div class="wishlist-group-label"><span>${g.name}</span><strong class="${chosen.length===5?'full-count':''}">${chosen.length} / 5</strong></div><div class="wish-slots">${Array.from({length:5},(_,i)=>`<span class="wish-slot ${i<chosen.length?'filled':''}"></span>`).join('')}</div>${chosen.length?`<div class="wishlist-tags">${chosen.map(c=>`<button class="wish-name" data-wish="${esc(c.id)}" title="登録を解除">${esc(c.name)} <span>×</span></button>`).join('')}</div>`:''}</div>`;
  }).join('');
}
function renderCalculation(){
  refreshMeta();renderWishlist();const model=buildModel(activeChars(),state);
  for(const s of model.details){const sub=$(`sub-${s.id}`);if(sub)sub.textContent=s.kind==='ticket'?`${s.draws}回募集`: `${s.draws}回使用 · 端数${s.remainder}個`;}
  const warnings=[];
  if(!model.ticketValid&&model.nTickets>0)warnings.push('<div class="notice">一般募集の新規獲得を計算するには、各グループ5体、計20体のウィッシュ登録が必要です。下の「未所持を優先して仮設定」を使うか、排出対象を「未設定として計算する」に切り替えてください。</div>');
  if(!state.wishEnabled)warnings.push('<div class="notice blue">ウィッシュリスト未設定として、3企業・ピルグリム/OSの各枠内で全対象キャラに等分しています。</div>');
  $('calculationWarnings').innerHTML=warnings.join('');$('calculationWarnings').hidden=!warnings.length;
  const totalNew=model.distinct===null?'—':fmt(model.distinct),any=model.anyNew===null?'—':pct(model.anyNew);
  $('resultCards').innerHTML=`<article class="result-card highlight"><span>新規獲得期待数</span><div class="result-value">${totalNew}<small>種類</small></div><p>未所持${model.missing.length}体のうち、新たに迎える種類数</p></article><article class="result-card"><span>SSR獲得期待数</span><div class="result-value">${fmt(model.ssr)}<small>体</small></div><p>重複を含む体数${model.additional>0?` · 還元分${fmt(model.additional)}体を含む`:''}</p></article><article class="result-card"><span>新規を1体以上迎える確率</span><div class="result-value">${any}</div><p>すべての資源を使った場合</p></article>`;
  renderChart(model);
  const used=model.details.filter(s=>s.draws>0||s.count>0);
  $('sourceBreakdown').innerHTML=used.length?used.map(s=>`<tr><td>${esc(s.short)}</td><td>${s.draws.toLocaleString('ja-JP')}回</td><td>${s.kind==='ticket'?'—':`${s.remainder}個`}</td><td class="table-rate">${fmt(s.draws*(s.kind==='ticket'?(state.rates.ticketNormal+state.rates.ticketRare)/100:s.rate))}体</td></tr>`).join('')+(model.additional>0?`<tr><td>アクセス還元による追加確定分</td><td>平均${fmt(model.additional)}回</td><td>—</td><td class="table-rate">${fmt(model.additional)}体</td></tr>`:''):'<tr><td colspan="4" class="table-empty">資源の所持数を入力してください。</td></tr>';
  const missing=model.rows.filter(c=>!c.owned).sort((a,b)=>b.probability-a.probability||a.name.localeCompare(b.name,'ja'));
  $('probabilityCount').textContent=`${missing.length} NIKKES`;$('probabilityEmpty').hidden=missing.length>0;
  $('probabilityRows').innerHTML=missing.map(c=>`<tr><td>${c.wish?'<span class="mint">★</span> ':''}${esc(c.name)}</td><td>${groupFor(c.group).name}</td><td>${model.ticketValid?pct(c.ticketP,4):'未設定'}</td><td class="table-rate">${model.valid?`<span class="smallbar" style="width:${c.probability*45}px"></span>${pct(c.probability,2)}`:'—'}</td></tr>`).join('');
}
function renderChart(model){
  if(!model.ticketValid){$('projectionChart').innerHTML='<div class="chart-blank">ウィッシュリストを20体設定すると、<br>一般募集回数ごとの見通しが表示されます。</div>';return;}
  const max=Math.min(1000000,Math.max(200,Math.ceil(model.nTickets/100)*100*2));
  const W=640,H=210,L=38,T=18,R=15,B=35,x=n=>L+n/max*(W-L-R),y=p=>H-B-p*(H-T-B);
  const values=Array.from({length:61},(_,i)=>{const n=max*i/60;return[x(n),y(model.newProbability(n))];});
  const curve=values.map((v,i)=>`${i?'L':'M'}${v[0].toFixed(2)},${v[1].toFixed(2)}`).join(' ');
  const grid=[0,.25,.5,.75,1].map(p=>`<line class="grid" x1="${L}" y1="${y(p)}" x2="${W-R}" y2="${y(p)}"/><text x="${L-8}" y="${y(p)+3}" text-anchor="end">${p*100}%</text>`).join('');
  const labels=[0,.25,.5,.75,1].map(p=>`<text x="${x(max*p)}" y="${H-13}" text-anchor="middle">${(max*p).toLocaleString('ja-JP')}回</text>`).join('');
  const n=Math.min(max,model.nTickets),current=model.newProbability(n);
  const points=[0,50,100,200];
  $('projectionChart').innerHTML=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="一般募集回数と、未所持キャラを1体以上獲得する確率のグラフ。現在${model.nTickets}回で${pct(current)}。"><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2e6e45" stop-opacity=".18"/><stop offset="100%" stop-color="#2e6e45" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${curve} L${x(max)},${H-B} L${L},${H-B} Z" fill="url(#areaFill)"/><path d="${curve}" class="curve"/>${labels}<line x1="${x(n)}" y1="${T}" x2="${x(n)}" y2="${H-B}" stroke="#2e6e4566" stroke-dasharray="3 4"/><circle cx="${x(n)}" cy="${y(current)}" r="4" fill="#2e6e45" stroke="#ffffff" stroke-width="2"/><text class="axis-label" x="${Math.min(W-100,Math.max(L+5,x(n)+8))}" y="${Math.min(H-B-8,Math.max(30,y(current)-12))}">現在 ${model.nTickets}回 / ${pct(current)}</text></svg><div class="chart-summary">${points.map(v=>`<div class="projection-point">${v===0?'モールドのみ':`一般募集 ${v}回`}<b>${pct(model.newProbability(v))}</b></div>`).join('')}</div>`;
}
const rateLabels={ticketNormal:'一般募集・3企業合計 %',ticketRare:'一般募集・ピルグリム/OS %',high:'旧ハイクオリティ SSR %',mid:'ミドルクオリティ SSR %',access:'アクセス SSR %',company:'企業通常モールド SSR %',refund:'アクセス失敗時の還元個数'};
function renderSettings(){
  $('snapshot').value=state.snapshot;
  $('ratesInputs').innerHTML=Object.entries(rateLabels).map(([id,name])=>`<label class="rate-field"><span>${name}</span><input type="number" data-rate="${id}" aria-label="${name}" value="${state.rates[id]}" min="0" max="100" step="${id==='refund'?1:.1}" inputmode="decimal"></label>`).join('');
  $('references').innerHTML=`<div class="source-links">${REFERENCES.map(([name,url])=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${name} ↗</a>`).join('')}</div>`;
  renderSaveStatus();
  renderCatalogEditor();
}
function renderCatalogEditor(){
  const search=normalize($('catalogSearch').value);
  $('catalogEditor').innerHTML=`<div class="catalog-editor">${catalog().filter(c=>!search||normalize(c.name).includes(search)).map(c=>`<div class="catalog-row"><label><input type="checkbox" data-include="${esc(c.id)}" ${!state.excluded.includes(c.id)?'checked':''}><span>${esc(c.name)}<small>${groupFor(c.group).name}${c.custom?' · 追加キャラ':''}</small></span></label>${c.custom?`<button class="text-link" data-delete="${esc(c.id)}">削除</button>`:''}</div>`).join('')}</div>`;
}
function renderWishDialog(){
  const chars=activeChars();
  $('wishDialogBody').innerHTML=GROUPS.map(g=>{
    const chosen=chars.filter(c=>c.group===g.id&&state.wish.includes(c.id));
    return `<section class="dialog-group"><h3>${g.name}<span>${chosen.length} / 5</span></h3>${chosen.length?`<div class="wishlist-tags">${chosen.map(c=>`<button class="wish-name" data-wish="${esc(c.id)}">★ ${esc(c.name)} <span>×</span></button>`).join('')}</div>`:'<p class="fine-print">まだ登録されていません。一覧で☆を押すと追加できます。</p>'}</section>`;
  }).join('');
}
function download(text,name,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportData(){persist();download(JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),`nikke-recruit-backup-${new Date().toISOString().slice(0,10)}.json`,'application/json');toast('バックアップを書き出しました');}
function afterStateChange(){save();renderRoster();if(page==='calculator')renderCalculation();if(page==='settings')renderSettings();}
function portraitMarkup(c){
  const photo=PORTRAITS[c.id];
  if(!photo)return `<div class="face-icon face-fallback" aria-hidden="true">${esc(c.name[0])}<small>SSR</small></div>`;
  const width=photo.backgroundSize.split(' ')[0],[left,top]=photo.backgroundPosition.split(' ');
  return `<div class="face-icon" role="img" aria-label="${esc(c.name)}の顔アイコン"><span class="portrait-placeholder" aria-hidden="true">${esc(c.name[0])}</span><img class="portrait-image" src="${esc(photo.src)}" alt="" loading="lazy" decoding="async" style="width:${esc(width)};left:${esc(left)};top:${esc(top)};transform:translate(-${esc(left)},-${esc(top)})"></div>`;
}
function summaryMarkup(data,at){
  const core=Object.values(data.ranks).filter(rank=>rank>=4).length;
  return `<strong>所持 ${data.owned.length}体</strong><span>コア強化中 ${core}体</span><span>一般募集チケット ${data.resources.tickets.toLocaleString('ja-JP')}枚</span><span>更新 ${esc(dateLabel(at))}</span>`;
}
function offerIncoming(incoming){
  pendingIncoming=incoming;
  $('importHeading').textContent=incoming.source==='recovery'?'取り込み前のデータに戻す':incoming.source==='file'?'JSONのデータを取り込む':'引き継ぎURLのデータを取り込む';
  $('localSummary').innerHTML=summaryMarkup(state,localUpdatedAt);
  $('incomingSummary').innerHTML=summaryMarkup(incoming.state,incoming.savedAt);
  $('applyIncoming').textContent=incoming.source==='recovery'?'取り込み前に戻す':incoming.source==='file'?'JSONのデータを取り込む':'URLのデータを取り込む';
  if(!$('importDialog').open)$('importDialog').showModal();
}
function applyIncoming(){
  const incoming=pendingIncoming;if(!incoming)return;
  clearTimeout(saveTimer);
  const updatedAt=incoming.savedAt&&Number.isFinite(Date.parse(incoming.savedAt))?new Date(incoming.savedAt).toISOString():new Date().toISOString();
  try{replaceLocalState(localStorage,state,incoming.state,localUpdatedAt,updatedAt);}
  catch(error){storageAvailable=false;renderSaveStatus();toast('取り込み前の保存ができません。現在のデータをJSONで書き出して、ブラウザの保存設定を確認してください。');return;}
  state=incoming.state;localUpdatedAt=updatedAt;lastPersisted=stateFingerprint(state);localExists=true;localReadError=false;hasEdited=false;storageAvailable=true;
  pendingIncoming=null;$('importDialog').close();
  renderResources();renderRoster();renderSettings();if(page==='calculator')renderCalculation();
  toast(incoming.source==='recovery'?'取り込み前のデータに戻しました':'データを取り込み、この端末にも保存しました');
}
async function handleRoute(){
  const request=++routeRequest;
  let route;
  try{route=readFragment(location.hash);}catch(error){urlToken=null;urlSnapshot=null;urlSavedAt=null;navigate('roster');renderSaveStatus();toast(error.message);return;}
  if(route.token!==urlToken){
    if(pendingIncoming){pendingIncoming=null;$('importDialog').close();}
    urlToken=route.token;urlSnapshot=null;urlSavedAt=null;
    if(route.token!==null){
      try{
        const incoming=await decodeSave(route.token);if(request!==routeRequest)return;
        urlSnapshot=stateFingerprint(incoming.state);urlSavedAt=incoming.savedAt;
        const decision=importDecision(localExists||localReadError||hasEdited?state:null,incoming.state);
        if(decision==='import'){state=incoming.state;localUpdatedAt=incoming.savedAt;lastPersisted=urlSnapshot;hasEdited=true;persist();renderResources();renderRoster();renderSettings();}
        else if(decision==='confirm')offerIncoming({...incoming,source:'url'});
      }catch(error){if(request!==routeRequest)return;urlToken=null;urlSnapshot=null;urlSavedAt=null;toast(error.message);}
    }
  }
  if(request!==routeRequest)return;
  navigate(route.page);renderSaveStatus();
}
async function saveToUrl(){
  if(savingUrl)return;
  savingUrl=true;renderSaveStatus();clearTimeout(saveTimer);
  try{
    const snapshot=sanitize(structuredClone(state)),fingerprint=stateFingerprint(snapshot);
    const token=await encodeSave(snapshot);
    if(fingerprint!==stateFingerprint(state))throw new Error('保存中に入力が変更されました。もう一度セーブしてください。');
    hasEdited=true;persist();
    try{sessionStorage.setItem('nikke-url-saved','1');}catch(e){}
    history.replaceState(null,'',makeFragment(page,token));
    location.reload();
  }catch(error){toast(error.message);}
  finally{savingUrl=false;renderSaveStatus();}
}
document.addEventListener('click',event=>{
  if(event.target.closest('.brand')){event.preventDefault();navigate('roster');return;}
  const nav=event.target.closest('[data-page]');if(nav){navigate(nav.dataset.page);return;}
  const own=event.target.closest('[data-own]');if(own){const id=own.dataset.own;setOwnership(state,id,!state.owned.includes(id));afterStateChange();return;}
  const wish=event.target.closest('[data-wish]');if(wish){toggleWish(wish.dataset.wish);return;}
  const group=event.target.closest('[data-group]');if(group){filters.group=group.dataset.group;renderRoster();return;}
  const status=event.target.closest('[data-status]');if(status){filters.status=status.dataset.status;renderRoster();return;}
  if(event.target.closest('[data-open-settings]')){navigate('settings');return;}
  const del=event.target.closest('[data-delete]');if(del){const c=state.custom.find(c=>c.id===del.dataset.delete);if(!c||!confirm(`「${c.name}」を追加キャラから削除しますか？`))return;state.custom=state.custom.filter(x=>x.id!==c.id);setOwnership(state,c.id,false);state.wish=state.wish.filter(x=>x!==c.id);state.excluded=state.excluded.filter(x=>x!==c.id);afterStateChange();toast('追加キャラを削除しました');}
});
$('search').addEventListener('input',e=>{filters.search=e.target.value;renderRoster();});
$('catalogSearch').addEventListener('input',renderCatalogEditor);
$('rankFilter').onchange=e=>{filters.rank=e.target.value;renderRoster();};
$('characters').addEventListener('change',e=>{const id=e.target.dataset.rank;if(!id||!activeChars().some(c=>c.id===id))return;if(!setRank(state,id,Number(e.target.value)))return;afterStateChange();const next=[...$('characters').querySelectorAll('[data-rank]')].find(el=>el.dataset.rank===id);next?.focus();});
$('goCalc').onclick=()=>navigate('calculator');$('backRoster').onclick=()=>navigate('roster');
$('clearFilters').onclick=()=>{filters.group='all';filters.status='all';filters.search='';filters.rank='all';$('search').value='';renderRoster();};
$('bulkOwned').onclick=()=>{const chars=visibleCharacters();chars.forEach(c=>setOwnership(state,c.id,true));afterStateChange();toast(`${chars.length}体を所持済みにしました`);};
$('bulkMissing').onclick=()=>{const chars=visibleCharacters();if(!chars.length)return;if(chars.length>1&&!confirm(`表示中の${chars.length}体を未所持に変更しますか？`))return;chars.forEach(c=>setOwnership(state,c.id,false));afterStateChange();toast(`${chars.length}体を未所持にしました`);};
$('goWish').onclick=()=>{renderWishDialog();$('wishDialog').showModal();};$('closeWish').onclick=()=>$('wishDialog').close();$('editWish').onclick=()=>{$('wishDialog').close();filters.group='all';filters.status='all';filters.search='';filters.rank='all';$('search').value='';navigate('roster');renderRoster();toast('各キャラの☆から登録・解除できます');};
$('wishDialog').addEventListener('click',e=>{if(e.target===$('wishDialog')){const box=$('wishDialog').getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)$('wishDialog').close();}});
$('resourceInputs').addEventListener('input',event=>{const id=event.target.dataset.resource;if(!id)return;state.resources[id]=amount(event.target.value);save();clearTimeout(calcTimer);calcTimer=setTimeout(renderCalculation,120);});
$('resourceInputs').addEventListener('change',e=>{if(e.target.dataset.resource)e.target.value=state.resources[e.target.dataset.resource];});
$('wishMode').onchange=e=>{state.wishEnabled=e.target.value==='on';afterStateChange();};$('recycle').onchange=e=>{state.recycle=e.target.checked;afterStateChange();};
$('autoWish').onclick=()=>{
  const chars=activeChars();
  if(!GROUPS.every(g=>chars.filter(c=>c.group===g.id).length>=5)){toast('各グループに5体以上の対象キャラが必要です');return;}
  if(state.wish.length&&!confirm('現在のウィッシュリストを、未所持優先の仮設定で置き換えますか？'))return;
  state.wish=GROUPS.flatMap(g=>chars.filter(c=>c.group===g.id).sort((a,b)=>Number(state.owned.includes(a.id))-Number(state.owned.includes(b.id))||a.name.localeCompare(b.name,'ja')).slice(0,5).map(c=>c.id));state.wishEnabled=true;afterStateChange();toast('未所持優先で仮設定しました。性能順ではありません。');
};
$('exportData').onclick=exportData;$('quickExport').onclick=exportData;$('importData').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    if(file.size>2000000)throw new Error('ファイルが大きすぎます。2MB以下のバックアップを選んでください。');
    const raw=JSON.parse(await file.text());
    offerIncoming({state:sanitize(raw),savedAt:raw.exportedAt||null,source:'file'});
  }catch(error){toast(error instanceof SyntaxError?'JSONファイルを読み取れませんでした':error.message);}finally{e.target.value='';}
};
$('exportMissing').onclick=()=>{
  const safe=s=>`"${String(s).replace(/^[=+@-]/,"'$&").replaceAll('"','""')}"`;
  const rows=[['名前','グループ','ウィッシュリスト'],...activeChars().filter(c=>!state.owned.includes(c.id)).map(c=>[c.name,groupFor(c.group).name,state.wish.includes(c.id)?'登録済み':'未登録'])];
  download('\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n'),`nikke-missing-${state.snapshot}.csv`,'text/csv;charset=utf-8');toast('未所持一覧を保存しました');
};
$('exportCollection').onclick=()=>{
  const safe=value=>'"'+String(value).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
  const rows=[['名前','グループ','所持状況','凸状況','ウィッシュリスト'],...activeChars().map(c=>[c.name,groupFor(c.group).name,state.owned.includes(c.id)?'所持済み':'未所持',rankLabel(rankFor(state,c.id)),state.wish.includes(c.id)?'登録済み':'未登録'])];
  download('\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n'),`nikke-collection-${state.snapshot}.csv`,'text/csv;charset=utf-8');toast('凸状況を含む所持一覧を保存しました');
};
$('snapshot').onchange=e=>{state.snapshot=e.target.value;const available=new Set(activeChars().map(c=>c.id));state.wish=state.wish.filter(id=>available.has(id));afterStateChange();toast(`募集対象日を${state.snapshot}に変更しました`);};
$('ratesInputs').addEventListener('change',e=>{const id=e.target.dataset.rate;if(!id)return;const value=Number(e.target.value);if(!Number.isFinite(value)||value<0||value>100){e.target.value=state.rates[id];toast('0〜100の数値を入力してください');return;}if(['ticketNormal','ticketRare'].includes(id)&&value+state.rates[id==='ticketNormal'?'ticketRare':'ticketNormal']>100){e.target.value=state.rates[id];toast('一般募集の確率合計は100%以下にしてください');return;}state.rates[id]=id==='refund'?Math.floor(value):value;save();});
$('defaultRates').onclick=()=>{state.rates={...DEFAULT_RATES};afterStateChange();toast('排出率を標準値に戻しました');};
$('addCharacter').onsubmit=e=>{
  e.preventDefault();const name=$('customName').value.trim();if(!name)return;
  if(state.custom.length>=500){toast('手動追加は500体までです');return;}
  if([...CHARACTERS,...state.custom].some(c=>normalize(c.name)===normalize(name))){toast('同じ名前のキャラがすでに登録されています');return;}
  const id=`custom-${crypto.randomUUID()}`;state.custom.push({id,name,group:$('customGroup').value,since:'2022-11-04',custom:true});$('customName').value='';afterStateChange();toast(`${name}を追加しました`);
};
$('catalogEditor').addEventListener('change',e=>{const id=e.target.dataset.include;if(!id)return;if(e.target.checked)state.excluded=state.excluded.filter(x=>x!==id);else{const c=activeChars().find(c=>c.id===id);if(c&&activeChars().filter(x=>x.group===c.group).length<=1){e.target.checked=true;toast('各グループに最低1体の対象キャラを残してください');return;}state.excluded.push(id);state.wish=state.wish.filter(x=>x!==id);}save();renderRoster();});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&page==='roster'){e.preventDefault();$('search').focus();}});
window.addEventListener('hashchange',()=>{handleRoute().catch(error=>toast(error.message));});
window.addEventListener('pagehide',persist);
document.addEventListener('load',event=>{if(event.target.classList?.contains('portrait-image'))event.target.parentElement.classList.add('portrait-ready');},true);
document.addEventListener('error',event=>{if(event.target.classList?.contains('portrait-image')){event.target.parentElement.classList.remove('portrait-ready');event.target.remove();}},true);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persist();});
$('quickSave').onclick=saveToUrl;$('saveUrl').onclick=saveToUrl;
$('copyUrl').onclick=async()=>{
  if(!urlSnapshot||stateFingerprint(state)!==urlSnapshot){toast('セーブしてからURLを共有してください');return;}
  try{await navigator.clipboard.writeText(location.href);toast('保存URLをコピーしました');}
  catch(e){window.prompt('保存URLをコピーしてください',location.href);}
};
$('applyIncoming').onclick=()=>applyIncoming();
$('keepLocal').onclick=()=>{$('importDialog').close();pendingIncoming=null;renderSaveStatus();toast('この端末のデータを使います');};
$('importDialog').addEventListener('cancel',()=>{pendingIncoming=null;});
$('restoreBackup').onclick=()=>{
  try{const record=loadRecovery(localStorage);if(!record)return;offerIncoming({state:record.state,savedAt:record.updatedAt,source:'recovery'});}catch(e){toast('取り込み前のデータを読み込めませんでした');}
};
async function initialize(){
  hydrateIcons();renderResources();renderRoster();renderSettings();
  await handleRoute();
  if(localReadError)toast('端末の保存データを読み込めませんでした。JSONを読み込むか、保存設定を確認してください。');
  else{
    try{if(sessionStorage.getItem('nikke-url-saved')){sessionStorage.removeItem('nikke-url-saved');toast(storageAvailable?'URLに保存しました。このタブを共有できます。':'URLに保存しました。端末保存は利用できません。');}}catch(e){}
  }
}
initialize().catch(error=>{renderSaveStatus();toast(error.message);});
// A small read-only hook for checking the current results from the browser console.
window.NikkeRecruitLab={getState:()=>structuredClone(state),calculate:()=>buildModel(activeChars(),state)};
