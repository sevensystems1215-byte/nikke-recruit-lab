export const SNAPSHOT = '2026-10-28';
export const GROUPS = [
  {id:'elysion',name:'エリシオン',en:'ELYSION',color:'#236fa1'},
  {id:'missilis',name:'ミシリス',en:'MISSILIS',color:'#926020'},
  {id:'tetra',name:'テトラ',en:'TETRA',color:'#7753a6'},
  {id:'pilgrim',name:'ピルグリム・OS',en:'PILGRIM / OS',color:'#337d67'}
];
const seeds = {
  elysion:'エマ|ウンファ|ベスティー|プリバティ|シグナル|ポリ|ミランダ|ブリッド|ソリン|ディーゼル|ギロチン|メイデン|ヘルム|D|マスト|マルチャーナ|キリ|プリバティ：アンカインド・メイド|D：キラーワイフ|ツバイ|ファントム|マスト：ロマンチックメイド|アンカー：イノセントメイド|アルカナ|K|ソラ|エマ：タクティカル・アップ|ウンファ：タクティカル・アップ|ベスティー：タクティカル・アップ|デルタ：ニンジャシーフ|ソリン：フロストチケット|レーベル|E.H.|アルカナ：フォーチュンメイト',
  missilis:'マクスウェル|ユニ|リター|ジュリア|センチ|ドレイク|クロウ|ペッパー|アドミ|エピネル|ラプラス|ジャッカル|ティア|ナガ|トーブ|エレグ|トロニー|アイン|クエンシー：エスケープクイーン|フローラ|マナ|トリナ|モリー|シラツル|ラプラス：アルティメットヒーロー|マクスウェル：オーディナリーメカニック|ドレイク：グレイトヴィラン',
  tetra:'シュガー|エクシア|アリス|プリム|メアリー|ミルク|ユルハ|ルドミラ|ルピー|ヤン|ドラー|ノベル|フォルクヴァン|アリア|ノイズ|ボリューム|バイパー|ココア|ソーダ|ビスケット|サクラ|ブラン|ノワール|ロザンナ|ネロ|レオナ|モラン|エード|ベイ|ソーダ：トゥインクルバニー|アリス：ワンダーランドバニー|クレイ|ルージュ|ルマニ|クラスト|ブレッディ|エード：エージェントバニー|ミルク：ブルーミングバニー|ベルベット|ミント|プリカ|アークレンジャー・ブラック',
  pilgrim:'スノーホワイト|イサベル|ラプンツェル|紅蓮|ハラン|ノア|モダニア|ドロシー|レッドフード|紅蓮：ブラックシャドウ|クラウン|シンデレラ|グレイブ|リトルマーメイド|ナユタ|リバーレリオ|スノーホワイト：ヘビーアームズ'
};
export const CHARACTERS = Object.entries(seeds).flatMap(([group,names])=>names.split('|').map((name,i)=>({id:`${group}-${i+1}`,name,group,since:'2022-11-04'})));
[
  ['ラピ：レッドフード','elysion'],
  ['ミハラ：ボンディングチェーン','missilis'],
  ['アニス：スター','tetra'],
  ['ネオン：ビジョン・アイ','missilis']
].forEach(([name,manufacturer],i)=>CHARACTERS.push({id:`overspec-${i+1}`,name,group:'pilgrim',manufacturer,overspec:true,since:'2022-11-04'}));
CHARACTERS.push(
  {id:'missilis-guilty-bunny',name:'ギルティ：マイティバニー',group:'missilis',since:'2026-10-29'},
  {id:'missilis-sin-bunny',name:'シン：スウィフトバニー',group:'missilis',since:'2026-10-29'},
  {id:'tetra-belorta-witch',name:'ベロータ：パンプキンウィッチ',group:'tetra',since:'2026-10-29'}
);
export const SOURCES = [
  {id:'tickets',name:'一般募集チケット',short:'一般募集',kind:'ticket',rate:.04,pool:'all',unit:1},
  {id:'access',name:'ハイクオリティアクセス',short:'アクセス',kind:'access',rate:.61,pool:'normal',unit:50},
  {id:'perfect',name:'ハイクオリティパーフェクトモールド',short:'共通パーフェクト',rate:1,pool:'normal',unit:50},
  {id:'high',name:'ハイクオリティモールド（旧）',short:'ハイクオリティ',rate:.61,pool:'normal',unit:50},
  {id:'mid',name:'ミドルクオリティモールド',short:'ミドルクオリティ',rate:.21,pool:'normal',unit:50},
  ...GROUPS.flatMap(g=>[
    {id:`${g.id}Mold`,name:`${g.name}モールド`,short:`${g.name} 通常`,rate:.5,pool:g.id,unit:50},
    {id:`${g.id}Perfect`,name:`${g.name}パーフェクトモールド`,short:`${g.name} 確定`,rate:1,pool:g.id,unit:50}
  ])
];
export const DEFAULT_RATES={ticketNormal:3.5,ticketRare:.5,high:61,mid:21,access:61,company:50,refund:12};
export const REFERENCES=[
  ['限界突破・コア強化','https://gamewith.jp/nikke/article/show/373300'],
  ['キャラクター一覧','https://game8.jp/nikke/491924'],
  ['ウィッシュリスト・オーバースペック','https://gamewith.jp/nikke/article/show/370148'],
  ['モールドの確率','https://kamigame.jp/nikke/page/235891029717294015.html'],
  ['企業モールドの確率','https://gamewith.jp/nikke/article/show/370145'],
  ['ハイクオリティアクセス','https://gamewith.jp/nikke/article/show/520719'],
  ['アクセスの還元個数','https://wikiwiki.jp/fpo2w6pt/勝利の女神：NIKKE（メガニケ）'],
  ['パーフェクトモールド','https://gamewith.jp/nikke/article/show/520718'],
  ['10月29日の一般募集追加','https://nikke-synergy.com/notes']
];
