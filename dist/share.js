import {canonicalState,sanitizeState,validDate} from './state.js';

export const MAX_TOKEN_LENGTH=16000;
export const MAX_DECODED_BYTES=250000;
const PAGES=new Set(['roster','calculator','settings']);
const encoder=new TextEncoder();
const decoder=new TextDecoder('utf-8',{fatal:true});

function toBase64(bytes){
  let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(raw).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
function fromBase64(raw){
  if(!raw||!/^[A-Za-z0-9_-]+$/.test(raw)||raw.length%4===1)throw new Error('URLの保存データが壊れています。');
  const value=atob(raw.replaceAll('-','+').replaceAll('_','/'));
  return Uint8Array.from(value,c=>c.charCodeAt(0));
}
async function readLimited(stream){
  const reader=stream.getReader(),chunks=[];let length=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_DECODED_BYTES){await reader.cancel();throw new Error('URLの保存データが大きすぎます。JSONで引き継いでください。');}chunks.push(value);}
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}

export async function encodeSave(state,savedAt=new Date().toISOString(),{compress=true}={}){
  if(!validDate(savedAt))throw new Error('保存日時を作成できませんでした。');
  const bytes=encoder.encode(JSON.stringify({v:1,at:validDate(savedAt),state:canonicalState(state)}));
  if(bytes.length>MAX_DECODED_BYTES)throw new Error('データ量が多いためURLに保存できません。JSONを書き出してください。');
  let token=`j1.${toBase64(bytes)}`;
  if(compress&&typeof CompressionStream==='function'){
    const packed=await readLimited(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')));
    const gz=`g1.${toBase64(packed)}`;if(gz.length<token.length)token=gz;
  }
  if(token.length>MAX_TOKEN_LENGTH)throw new Error('データ量が多いためURLに保存できません。JSONを書き出してください。');
  return token;
}

export async function decodeSave(token){
  try{
    if(typeof token!=='string'||token.length>MAX_TOKEN_LENGTH)throw new Error('URLの保存データが大きすぎます。JSONで引き継いでください。');
    const prefix=token.slice(0,3);
    if(!['g1.','j1.'].includes(prefix))throw new Error('このURLの保存形式は未対応です。新しい計算機かJSONで開いてください。');
    let bytes=fromBase64(token.slice(3));
    if(prefix==='g1.'){
      if(typeof DecompressionStream!=='function')throw new Error('このブラウザは圧縮URLの復元に未対応です。ブラウザを更新するかJSONで引き継いでください。');
      bytes=await readLimited(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    }
    if(bytes.length>MAX_DECODED_BYTES)throw new Error('URLの保存データが大きすぎます。JSONで引き継いでください。');
    const raw=JSON.parse(decoder.decode(bytes));
    if(!raw||raw.v!==1||!validDate(raw.at))throw new Error('URLの保存形式・日時を確認できませんでした。');
    return {state:sanitizeState(raw.state,{strict:true}),savedAt:validDate(raw.at)};
  }catch(error){
    if(error instanceof SyntaxError||error instanceof TypeError||error?.name==='InvalidCharacterError'||error?.code==='Z_DATA_ERROR')throw new Error('URLの保存データを読み取れませんでした。送信元でセーブし直すか、JSONで引き継いでください。');
    throw error;
  }
}

export function readFragment(hash){
  const raw=String(hash||'').replace(/^#/,'');
  if(PAGES.has(raw))return {page:raw,token:null};
  const params=new URLSearchParams(raw);
  if(params.getAll('save').length>1)throw new Error('保存データが重複したURLです。送信元でセーブし直してください。');
  return {page:PAGES.has(params.get('page'))?params.get('page'):'roster',token:params.has('save')?params.get('save'):null};
}
export function makeFragment(page,token){
  const route=PAGES.has(page)?page:'roster';
  if(!token)return `#${route}`;
  return `#${new URLSearchParams({page:route,save:token})}`;
}
export function importDecision(local,incoming){
  if(!local)return 'import';
  return JSON.stringify(canonicalState(local))===JSON.stringify(canonicalState(incoming))?'same':'confirm';
}
