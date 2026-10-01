/** Receiving boundary for the host-filtered dice result snapshot (not edit history). */
export function boundedDiceHistory(value:unknown):any[]{
 if(!Array.isArray(value))return [];
 const rows=new Map<string,any>();
 for(const row of value){
  if(!row||typeof row.rollId!=='string'||!row.rollId||!Array.isArray(row.dice)||!Number.isFinite(row.total)||!Number.isFinite(row.ts))continue;
  const previous=rows.get(row.rollId);if(!previous||previous.hidden&&!row.hidden)rows.set(row.rollId,row);
 }
 return [...rows.values()].sort((a,b)=>b.ts-a.ts).slice(0,100);
}
