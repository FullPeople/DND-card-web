import {spellState} from './characterDetails';
import type {Character,SpecialSpell} from './model';

export const specialSpellResource=(id:string)=>`innate-spell:${id}`;
export function setSpecialSpell(c:Character,id:string,config?:SpecialSpell):boolean{
 const row=c.selections.find(s=>s.id===id&&s.entry.kind==='spell');if(!row)return false;
 const settings=c.spellSettings||=structuredClone(spellState(c));
 if(!config){if(settings.special)delete settings.special[id];delete c.runtime.resources[specialSpellResource(id)];return true;}
 const next={...config,max:config.mode==='uses'?Math.max(1,Math.min(100,Math.trunc(config.max||1))):undefined};
 (settings.special||={})[id]=next;settings.prepared=settings.prepared.map(value=>value===id?'':value);
 const key=specialSpellResource(id),old=c.runtime.resources[key];
 if(next.mode==='uses'){const max=next.max!,spent=old?Math.max(0,old.max-old.current):0;c.runtime.resources[key]={...old,name:`${row.entry.name}施法次数`,type:'count',max,current:Math.max(0,max-spent)};}
 else delete c.runtime.resources[key];
 return true;
}
export function changeSpecialSpellUses(c:Character,id:string,value:number){const config=c.spellSettings?.special?.[id],resource=c.runtime.resources[specialSpellResource(id)];if(config?.mode!=='uses'||!resource)return;resource.current=Math.max(0,Math.min(resource.max,Math.trunc(value)));}
