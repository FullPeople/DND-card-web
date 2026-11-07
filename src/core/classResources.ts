import type {Character} from './model';
import {parentClass} from './featureOwnership';
import {reviewedAlertIdentity} from './automation/reviewedFeatIdentity';
import {limitedSourceIdentity} from './automation/limitedSourceUseSource';
import {itemChargeIdentity} from './automation/itemChargeDebitSource';
// Standard multiclass caster progression, indexed by effective caster level.
const fullSlots=[[],[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
export const hasClassCasting=(card:Character)=>card.selections.some(s=>['class','subclass'].includes(s.entry.kind)&&!reviewedAlertIdentity(s.entry)&&!limitedSourceIdentity(s.entry)&&!itemChargeIdentity(s.entry)&&(s.entry.raw.casterProgression||[...(s.entry.raw.classTableGroups||[]),...(s.entry.raw.subclassTableGroups||[])].some(group=>group.rowsSpellProgression)));

/** Source-declared automatic capacities only. Never reads or mutates balances. */
export function classResourcePlan(c:Character){
 const classes=c.selections.filter(s=>s.entry.kind==='class'&&!reviewedAlertIdentity(s.entry)&&!limitedSourceIdentity(s.entry)&&!itemChargeIdentity(s.entry)),dice:Record<string,number>={};let caster=0,pact=0;
 const casting=classes.map(cls=>{
  const raw=cls.entry.raw,sub=c.selections.find(s=>s.entry.kind==='subclass'&&!reviewedAlertIdentity(s.entry)&&!limitedSourceIdentity(s.entry)&&!itemChargeIdentity(s.entry)&&parentClass(c,s)?.id===cls.id),progression=sub?.entry.raw.casterProgression||raw.casterProgression;
  const tables=[...(raw.classTableGroups||[]),...(sub?.entry.raw.subclassTableGroups||[])].map(group=>group.rowsSpellProgression?.[cls.level-1]).filter((row:any)=>Array.isArray(row)&&row.every((n:any)=>typeof n==='number'));
  return {cls,progression,table:tables[tables.length-1] as number[]|undefined};
 });
 // Only classes that currently provide ordinary Spellcasting combine slots.
 // A noncaster, Pact Magic or an independent pool does not change its rounding
 // or replace the sole ordinary caster's actual declared source table.
 const ordinary=casting.filter(({cls,progression,table})=>progression!=='pact'&&(table?table.some(n=>n>0):progression==='full'||progression==='artificer'||['half','1/2'].includes(progression)&&(c.edition==='2024'||cls.level>=2)||['third','1/3'].includes(progression)&&cls.level>=3));
 for(const cls of classes){const faces=Number(cls.entry.raw.hd?.faces||(classes.length===1?c.externalSnapshot?.core_stats?.hit_dice?.die_size:0));if(faces>0)dice[faces]=(dice[faces]||0)+cls.level;}
 for(const source of casting){const {cls,progression}=source;
  if(progression==='pact'){pact+=cls.level;continue;}
  if(!ordinary.includes(source))continue;
  if(progression==='full')caster+=cls.level;
  else if(progression==='1/2'||progression==='half')caster+=ordinary.length===1||c.edition==='2024'?Math.ceil(cls.level/2):Math.floor(cls.level/2);
  else if(progression==='artificer')caster+=Math.ceil(cls.level/2);
  else if(progression==='1/3'||progression==='third')caster+=ordinary.length===1?Math.ceil(cls.level/3):Math.floor(cls.level/3);
 }
 let slots=fullSlots[Math.min(20,caster)]||[];
 // With only one ordinary caster, its source table still applies even if
 // other character levels grant independent slots or no spellcasting at all.
 if(ordinary.length===1&&ordinary[0].table)slots=ordinary[0].table;
 return {dice,caster,pact,slots:[...slots]};
}
