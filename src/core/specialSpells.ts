import {ownedLimitedSourceResource} from './automation/limitedSourceUses';
import {rememberSourceSpellUses,sourceSpellEnabled} from './automation/sourceSpellState';
import {spellState} from './characterDetails';
import type {Character,SpecialSpell} from './model';

import {specialSpellResource} from './spellResourceKeys';
export {specialSpellResource} from './spellResourceKeys';
export function setSpecialSpell(c:Character,id:string,config?:SpecialSpell):boolean{
 if(ownedLimitedSourceResource(c,specialSpellResource(id,c)))throw Error('有限来源配置由专属历史管理。');
 const row=c.selections.find(s=>s.id===id&&s.entry.kind==='spell');if(!row||row.grantKey?.startsWith('source-spell:'))return false;
 const settings=c.spellSettings||=structuredClone(spellState(c));
 const manualSource=settings.special?.[id]?.manualSource;
 if(!config){if(manualSource)delete row.parentId;if(settings.special)delete settings.special[id];delete c.runtime.resources[specialSpellResource(id,c)];return true;}
 const next={...config,...(manualSource?{manualSource}:{}),max:config.mode==='uses'?Math.max(1,Math.min(100,Math.trunc(config.max||1))):undefined};
 (settings.special||={})[id]=next;settings.prepared=settings.prepared.map(value=>value===id?'':value);
 const key=specialSpellResource(id,c),old=c.runtime.resources[key];
 if(next.mode==='uses'){const max=next.max!,spent=old?Math.max(0,old.max-old.current):0;c.runtime.resources[key]={...old,name:`${row.entry.name}施法次数`,type:'count',max,current:Math.max(0,max-spent)};}
 else delete c.runtime.resources[key];
 return true;
}
export function changeSpecialSpellUses(c:Character,id:string,value:number){if(ownedLimitedSourceResource(c,specialSpellResource(id,c)))throw Error('有限来源不能手工补充次数。');const config=c.spellSettings?.special?.[id],resource=c.runtime.resources[specialSpellResource(id,c)];if(config?.mode!=='uses'||!resource||!sourceSpellEnabled(c,id))return;resource.current=Math.max(0,Math.min(resource.max,Math.trunc(value)));rememberSourceSpellUses(c,id);}
