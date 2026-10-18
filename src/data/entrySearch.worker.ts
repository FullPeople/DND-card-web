import {searchEntryRows,type SearchRow} from './entrySearchTask';
let rows:SearchRow[]=[],latest=0;
globalThis.onmessage=async({data}:{data:{rows?:SearchRow[];id:number;query?:string}})=>{
 latest=data.id;if(data.rows){rows=data.rows;return;}
 if(data.query===undefined)return;
 const id=data.id;
 try{const indices=await searchEntryRows(rows,data.query,()=>latest!==id);if(indices)globalThis.postMessage({id,indices});}
 catch(error){if(latest===id)globalThis.postMessage({id,error:String(error)});}
};
