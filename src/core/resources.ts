import type {Character} from './model';
import {spellState} from './characterDetails';
import {parentClass} from './featureOwnership';
// Standard multiclass caster progression, indexed by effective caster level.
const fullSlots=[[],[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
export function syncAutoResources(c:Character,before?:Character){
 const previous=JSON.stringify([c.runtime.resources,c.spellSettings?.slots]);const resources=c.runtime.resources,needed=new Set<string>();
 if(before)for(const [level,slot] of Object.entries(c.spellSettings?.slots||{})){if(slot.used!==before.spellSettings?.slots[level]?.used&&resources[`spell-slot:${level}`])resources[`spell-slot:${level}`].current=Math.max(0,slot.max-slot.used);}
 function ensure(id:string,name:string,max:number,initial=max){needed.add(id);const old=resources[id];const used=old?Math.max(0,old.max-old.current):max-initial;resources[id]={...old,name,max,current:Math.max(0,max-used),type:old?.type||'count',icon:old?.icon||'gem',automatic:true};}
 const classes=c.selections.filter(s=>s.entry.kind==='class'),dice:Record<string,number>={};let caster=0,pact=0;
 for(const cls of classes){const raw=cls.entry.raw,faces=Number(raw.hd?.faces||(classes.length===1?c.externalSnapshot?.core_stats?.hit_dice?.die_size:0));if(faces>0)dice[faces]=(dice[faces]||0)+cls.level;
  const sub=c.selections.find(s=>s.entry.kind==='subclass'&&parentClass(c,s)?.id===cls.id),progression=sub?.entry.raw.casterProgression||raw.casterProgression;
  if(progression==='full')caster+=cls.level;
  else if(progression==='1/2'||progression==='half')caster+=classes.length===1||c.edition==='2024'?Math.ceil(cls.level/2):Math.floor(cls.level/2);
  else if(progression==='artificer')caster+=Math.ceil(cls.level/2);
  else if(progression==='1/3'||progression==='third')caster+=classes.length===1?Math.ceil(cls.level/3):Math.floor(cls.level/3);
  else if(progression==='pact')pact+=cls.level;
 }
 for(const [faces,max] of Object.entries(dice))ensure(`hit-die:${faces}`,`生命骰 d${faces}`,max,Math.min(max,c.externalSnapshot?.core_stats?.hit_dice?.current??max));
 let slots=fullSlots[Math.min(20,caster)]||[];
 // Single-class source tables take precedence over multiclass arithmetic.
 if(classes.length===1){const cls=classes[0],sub=c.selections.find(s=>s.entry.kind==='subclass'&&parentClass(c,s)?.id===cls.id);for(const group of [...(cls.entry.raw.classTableGroups||[]),...(sub?.entry.raw.subclassTableGroups||[])]){const row=group.rowsSpellProgression?.[cls.level-1];if(Array.isArray(row)&&row.every((n:any)=>typeof n==='number'))slots=row;}}
 const hasCasting=(card:Character)=>card.selections.some(s=>['class','subclass'].includes(s.entry.kind)&&(s.entry.raw.casterProgression||[...(s.entry.raw.classTableGroups||[]),...(s.entry.raw.subclassTableGroups||[])].some(group=>group.rowsSpellProgression)));
 const automaticSlots=hasCasting(c)||!!before&&hasCasting(before);
 if((slots.some(n=>n>0)||pact)&&!c.spellSettings)c.spellSettings=structuredClone(spellState(c));
 const knownSlots=c.spellSettings?.slots||{};
 if(!caster&&!pact&&!slots.length&&!automaticSlots)slots=Array.from({length:9},(_,i)=>knownSlots[String(i+1)]?.max||0);
 for(let i=0;i<slots.length;i++)if(slots[i]>0){const level=String(i+1),max=slots[i],existing=knownSlots[level];ensure(`spell-slot:${level}`,`${level}环法术位`,max,max-(existing?.used||0));if(c.spellSettings)c.spellSettings.slots[level]={max,used:max-resources[`spell-slot:${level}`].current};}
 if(pact){const level=Math.min(5,Math.ceil(pact/2)),max=pact===1?1:pact<11?2:pact<17?3:4;ensure(`pact-slot:${level}`,`${level}环契约位`,max);}
 if(automaticSlots&&c.spellSettings)for(const level of Object.keys(c.spellSettings.slots))if(!needed.has(`spell-slot:${level}`))delete c.spellSettings.slots[level];
 for(const [id,r] of Object.entries(resources))if(r.automatic&&!needed.has(id))delete resources[id];
 return previous!==JSON.stringify([resources,c.spellSettings?.slots]);
}
export function setResource(c:Character,id:string,current:number){const r=c.runtime.resources[id];if(!r)return;r.current=Math.max(0,r.unlimited?current:Math.min(r.max,current));if(id.startsWith('spell-slot:')&&c.spellSettings)c.spellSettings.slots[id.split(':')[1]]={max:r.max,used:r.max-r.current};}
