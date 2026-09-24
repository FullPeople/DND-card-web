export const COIN_LABELS = {cp:'铜币',sp:'银币',ep:'琥珀金币',gp:'金币',pp:'铂金币'} as const;
export type Coin = keyof typeof COIN_LABELS;
type Coins = Partial<Record<Coin,number>>;
const object = (value:unknown):value is Record<string,unknown> => !!value&&typeof value==='object'&&!Array.isArray(value);
function amount(value:unknown):number|undefined {
 if(typeof value==='string'){
  const text=value.trim();if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))return;
  value=Number(text);
 }
 return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:undefined;
}
/** Read existing coin schemas without changing ownership or summing aggregate
 * totals twice. Stable Suite spreadsheet imports use currency.wallet; native
 * web cards and inventory projections use a flat denomination map. */
export function normalizeCurrency(value:unknown,depth=0):Coins {
 if(depth>4)return {};
 if(!object(value)){
  if(typeof value==='string'){
   const explicit=value.trim().match(/^((?:\d+(?:\.\d*)?|\.\d+))\s*(cp|sp|ep|gp|pp)$/i);
   if(explicit){const n=amount(explicit[1]);return n===undefined?{}:{[explicit[2].toLowerCase()]:n};}
  }
  const n=amount(value);return n===undefined?{}:{gp:n};
 }
 for(const key of ['wallet','coins','currency'])if(object(value[key]))return normalizeCurrency(value[key],depth+1);
 const coins:Coins={};let hasDenominations=false;
 for(const coin of Object.keys(COIN_LABELS) as Coin[]){
  if(!Object.hasOwn(value,coin))continue;
  hasDenominations=true;const n=amount(value[coin]);if(n!==undefined)coins[coin]=n;
 }
 if(hasDenominations)return coins;
 const total=amount(value.total_gp);if(total!==undefined)return {gp:total};
 return typeof value.total_gp_raw==='string'?normalizeCurrency(value.total_gp_raw,depth+1):{};
}
export function currencyRows(value:unknown):{coin:Coin;name:string;amount:number}[]{
 const coins=normalizeCurrency(value);
 return (Object.keys(COIN_LABELS) as Coin[]).flatMap(coin=>coins[coin]? [{coin,name:COIN_LABELS[coin],amount:coins[coin]!}]:[]);
}
