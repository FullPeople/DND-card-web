import {automationEnabled} from './automation/state';
import {irMechanics,irParentClass,irSelectionActive} from './automation/ir';
import type {Character} from './model';
import {syncFeatureResources,planFeatureResources,featureResourceReceipts} from './automation/featureResources';
import {spellState} from './characterDetails';
import {parentClass} from './featureOwnership';
export function isHitDieResource(id:string){return /^hit-die:\d+$/.test(id);}
// Standard multiclass caster progression, indexed by effective caster level.
const fullSlots=[[],[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
export function syncAutoResources(c:Character,before?:Character){
 if(!automationEnabled(c))return false;
 const previous=JSON.stringify([c.runtime.resources,c.spellSettings?.slots]);const resources=c.runtime.resources,needed=new Set<string>();
 if(before)for(const [level,slot] of Object.entries(c.spellSettings?.slots||{})){if(slot.used!==before.spellSettings?.slots[level]?.used&&resources[`spell-slot:${level}`])resources[`spell-slot:${level}`].current=Math.max(0,slot.max-slot.used);}
 for(const [id,r]of Object.entries(resources))if(r.automatic){const prior=c.runtime.automaticResourceArchive?.[id],spent=Math.max(0,r.max-r.current);r.automaticSpent=prior&&prior.current===r.current&&prior.max===r.max?Math.max(spent,r.automaticSpent??spent):spent;(c.runtime.automaticResourceArchive||={})[id]=structuredClone(r);}
 function ensure(id:string,name:string,max:number,initial=max,debt?:number){needed.add(id);const old=resources[id]||c.runtime.automaticResourceArchive?.[id];const used=debt??(old?old.automaticSpent??Math.max(0,old.max-old.current):max-initial);resources[id]={...old,name,max,current:Math.max(0,max-used),automaticSpent:used,type:old?.type||'count',icon:old?.icon||'gem',automatic:true};(c.runtime.automaticResourceArchive||={})[id]=structuredClone(resources[id]);}
 const classes=c.selections.filter(s=>s.entry.kind==='class'&&irSelectionActive(c,s)),dice:Record<string,number>={};let caster=0,pact=0;
 for(const cls of classes){const model=irMechanics(cls.entry)?.classModel,faces=model?.hitDie;if(faces)dice[faces]=(dice[faces]||0)+cls.level;
  const sub=c.selections.find(s=>s.entry.kind==='subclass'&&irParentClass(c,s)?.id===cls.id&&irSelectionActive(c,s)),progression=irMechanics(sub?.entry||cls.entry)?.classModel?.casterProgression||model?.casterProgression;
  if(progression==='full')caster+=cls.level;
  else if(progression==='half')caster+=classes.length===1||c.edition==='2024'?Math.ceil(cls.level/2):Math.floor(cls.level/2);
  else if(progression==='artificer')caster+=Math.ceil(cls.level/2);
  else if(progression==='third')caster+=classes.length===1?Math.ceil(cls.level/3):Math.floor(cls.level/3);
  else if(progression==='pact')pact+=cls.level;
 }
 for(const [faces,max] of Object.entries(dice))ensure(`hit-die:${faces}`,`生命骰 d${faces}`,max,Math.min(max,c.externalSnapshot?.core_stats?.hit_dice?.current??max));
 let slots=fullSlots[Math.min(20,caster)]||[];
 // Single-class source tables take precedence over multiclass arithmetic.
 if(classes.length===1){const cls=classes[0],sub=c.selections.find(s=>s.entry.kind==='subclass'&&irParentClass(c,s)?.id===cls.id&&irSelectionActive(c,s));const table=irMechanics(sub?.entry||cls.entry)?.classModel?.spellSlots||irMechanics(cls.entry)?.classModel?.spellSlots;const row=table?.[cls.level-1];if(row)slots=row;}
 const hasCasting=(card:Character)=>card.selections.some(s=>['class','subclass'].includes(s.entry.kind)&&irSelectionActive(card,s)&&(irMechanics(s.entry)?.classModel?.casterProgression||irMechanics(s.entry)?.classModel?.spellSlots));
 const incomplete=c.selections.some(row=>['class','subclass'].includes(row.entry.kind)&&(!row.entry.automation||row.entry.automation.verdict==='needsAnnotation'));
 const automaticSlots=!incomplete&&(hasCasting(c)||!!before&&hasCasting(before));
 if((slots.some(n=>n>0)||pact)&&!c.spellSettings)c.spellSettings=structuredClone(spellState(c));
 const knownSlots=c.spellSettings?.slots||{};
 if(!caster&&!pact&&!slots.length&&!automaticSlots)slots=Array.from({length:9},(_,i)=>knownSlots[String(i+1)]?.max||0);
 for(let i=0;i<slots.length;i++)if(slots[i]>0){const level=String(i+1),max=slots[i],existing=knownSlots[level];ensure(`spell-slot:${level}`,`${level}环法术位`,max,max-(existing?.used||0));if(c.spellSettings)c.spellSettings.slots[level]={max,used:max-resources[`spell-slot:${level}`].current};}
 if(pact){const level=Math.min(5,Math.ceil(pact/2)),max=pact===1?1:pact<11?2:pact<17?3:4;const current=Object.entries(resources).filter(([key])=>/^pact-slot:[1-5]$/.test(key)).map(([,r])=>r.automaticSpent??Math.max(0,r.max-r.current)),archived=c.runtime.automaticResourceArchive?.['pact-slot:pool'];const debt=current.length?Math.max(...current):archived?.automaticSpent??0;ensure(`pact-slot:${level}`,`${level}环契约位`,max,max,debt);(c.runtime.automaticResourceArchive||={})['pact-slot:pool']=structuredClone(resources[`pact-slot:${level}`]);}
 if(automaticSlots&&c.spellSettings)for(const level of Object.keys(c.spellSettings.slots))if(!needed.has(`spell-slot:${level}`))delete c.spellSettings.slots[level];
 for(const [id,r] of Object.entries(resources))if(r.automatic&&!needed.has(id)&&!incomplete)delete resources[id];
 const featuresChanged=syncFeatureResources(c);
 return featuresChanged||previous!==JSON.stringify([resources,c.spellSettings?.slots]);
}
export function setResource(c:Character,id:string,current:number,options:{preserveDebt?:boolean}={}){
 const r=c.runtime.resources[id];if(!r)return;
 r.current=Math.max(0,r.unlimited?current:Math.min(r.max,current));const spent=Math.max(0,r.max-r.current),preserveDebt=options.preserveDebt||r.current===0;
 // Keeping an exhausted counter at zero is not a restoration. Only an
 // explicit positive adjustment or rest can reduce its overflow consumption.
 if(r.featureGrant){r.featureGrant.spent=Math.max(spent,preserveDebt?r.featureGrant.spent??0:0);(c.runtime.featureResourceArchive||={})[id]=structuredClone(r);}
 if(r.automatic){r.automaticSpent=Math.max(spent,preserveDebt?r.automaticSpent??0:0);(c.runtime.automaticResourceArchive||={})[id]=structuredClone(r);if(/^pact-slot:[1-5]$/.test(id))c.runtime.automaticResourceArchive!['pact-slot:pool']=structuredClone(r);}
 if(id.startsWith('spell-slot:')&&c.spellSettings)c.spellSettings.slots[id.split(':')[1]]={max:r.max,used:r.max-r.current};
}
/** Copy synchronization can consume or clamp counters, but cannot restore debt. */
export function preserveMigrationResources(card:Character,original:Character){
 const grants=planFeatureResources(card).grants;
 for(const [id,r]of Object.entries(card.runtime.resources)){
  const grant=grants.find(grant=>grant.key===id),receipts=grant?featureResourceReceipts(original.runtime.resources,grant,grants):[];
  const available=original.runtime.resources[id]?.current??(receipts.length?Math.min(...receipts.map(([,r])=>r.current)):0);
  setResource(card,id,Math.min(r.current,available),{preserveDebt:true});
 }
}
