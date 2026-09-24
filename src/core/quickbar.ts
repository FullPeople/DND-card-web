import {uid,type Character,type Entry} from './model';
/** Reference copies never grant a selection or remove the original on deletion. */
export function pinEntry(c:Character,entry:Entry){
 const rows=c.quickbarCopies||=[];
 if(rows.some(row=>row.entry.id===entry.id)||rows.length>=100)return;
 rows.push({id:uid(),entry:structuredClone(entry)});
}
export function quickbarEntries(c:Character){
 const rows=[...(c.quickbarCopies||[])];
 for(const id of c.quickbar||[]){const s=c.selections.find(s=>s.id===id);if(s&&!rows.some(r=>r.entry.id===s.entry.id))rows.push({id,entry:s.entry});}
 return rows;
}
export function removePin(c:Character,id:string){c.quickbar=c.quickbar?.filter(value=>value!==id);c.quickbarCopies=c.quickbarCopies?.filter(row=>row.id!==id);}
