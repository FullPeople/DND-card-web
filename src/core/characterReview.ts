import {evaluate} from './engine';
import {spellState,spellValues,carriedWeight} from './characterDetails';
import {selectionAllowed,type Character,type Selection} from './model';

/** Read-only review projection. No quota assumptions or resource mutations. */
export function characterReview(c:Character){
 const d=evaluate(c),spells=spellState(c),stats=spellValues(c,d),weight=carriedWeight(c);
 const selected=new Map(c.selections.map(s=>[s.id,s]));
 const allowed=(s:Selection)=>{const seen=new Set<string>();let row:Selection|undefined=s;while(row&&!seen.has(row.id)){if(!selectionAllowed(c,row.entry))return false;seen.add(row.id);row=row.parentId?selected.get(row.parentId):undefined;}return true;};
 const restricted=c.selections.filter(s=>!allowed(s));
 const classes=c.selections.filter(s=>s.entry.kind==='class');
 const recordedLevel=classes.reduce((total,s)=>total+s.level,0);
 const manual=[...(c.adjustments||[]).map(a=>({key:a.id,target:a.target,value:a.value,reason:a.reason,absolute:true})),...Object.entries(c.sheetBonuses||{}).filter(([,value])=>value!==0).map(([target,value])=>({key:`bonus:${target}`,target,value:value!,reason:'卡面调整',absolute:false}))];
 const unlinked=c.selections.filter(s=>s.entry.source==='IMPORTED'&&s.entry.packId==='imported');
 const sourceRows=[...new Set(c.selections.map(s=>s.entry.source))].map(source=>({source,total:c.selections.filter(s=>s.entry.source===source).length,restricted:restricted.filter(s=>s.entry.source===source).length}));
 return {d,spells,stats,weight,restricted,classes,recordedLevel,manual,unlinked,sourceRows,allowed};
}
