import {ownedItemChargeResource} from './automation/itemChargeDebits';
import {ownedLimitedSourceResource} from './automation/limitedSourceUses';
import type {Character} from './model';
import {syncFeatureResources} from './automation/featureResources';
import {spellState} from './characterDetails';
import {classResourcePlan,hasClassCasting,pactSlotCapacity} from './classResources';
import {automaticSlotCounter,slotBalanceHeld,syncSlotCapacityReview,currentSlotCapacityReview,acceptExplicitSlotEdits,projectKnownSlotBalance,rememberKnownSlotBalance} from './automation/slotCapacityReview';
import {ordinaryCastingRule} from './automation/ordinaryCastingIdentity';
function recordedPreviousSlots(c:Character,before?:Character){
 if(!before||before.id!==c.id)return;
 const contexts=(card:Character)=>card.selections.filter(s=>s.entry.kind==='class'||s.entry.kind==='subclass');
 const prior=contexts(before),current=contexts(c),identity=(rows:typeof prior)=>rows.map(s=>[s.id,s.entry.kind,s.level,s.parentId]);
 // Metadata hydration on an unchanged selection is not a new class/level.
 if(JSON.stringify(identity(prior))===JSON.stringify(identity(current))||prior.some(s=>!ordinaryCastingRule(s.entry)))return;
 return classResourcePlan(before).slots;
}
export function isHitDieResource(id:string){return /^hit-die:\d+$/.test(id);}
export function syncAutoResources(c:Character,before?:Character){
 const previous=JSON.stringify([c.runtime.resources,c.spellSettings?.slots,c.runtime.slotCapacityReview]);const resources=c.runtime.resources,needed=new Set<string>();
 acceptExplicitSlotEdits(c,before);
 // Existing manual/opaque-ownership or locked slot pools belong to the player,
 // not the class reconciler. Protect them before mirror sync, ensure and cleanup.
 // This is current ownership only; historical automatic adoption is unknowable.
 const protectedSlots=new Set(Object.entries(resources).filter(([id,pool])=>/^(?:spell|pact)-slot:[1-9]$/.test(id)&&(!automaticSlotCounter(pool)||pool.locked===true)).map(([id])=>id));
 if(before)for(const [level,slot] of Object.entries(c.spellSettings?.slots||{})){if(!protectedSlots.has(`spell-slot:${level}`)&&!slotBalanceHeld(c,`spell-slot:${level}`)&&slot.used!==before.spellSettings?.slots[level]?.used&&resources[`spell-slot:${level}`])resources[`spell-slot:${level}`].current=Math.max(0,slot.max-slot.used);}
 function ensure(id:string,name:string,max:number,initial=max){needed.add(id);if(protectedSlots.has(id)||slotBalanceHeld(c,id))return false;const old=resources[id],known=currentSlotCapacityReview(c)?.balances?.[id];const used=known?known.spent:old?Math.max(0,old.max-old.current):max-initial;resources[id]={...old,name:id.startsWith('spell-slot:')?(old?.name??name):name,max,current:Math.max(0,max-used),type:old?.type||'count',icon:old?.icon||'gem',automatic:true};projectKnownSlotBalance(c,id,used);return true;}
 const plan=classResourcePlan(c),{dice,caster,pact}=plan;let slots=plan.slots;
 syncSlotCapacityReview(c,slots,c.runtime.slotCapacityReview===undefined?recordedPreviousSlots(c,before):undefined);
 for(const [faces,max] of Object.entries(dice))ensure(`hit-die:${faces}`,`生命骰 d${faces}`,max,Math.min(max,c.externalSnapshot?.core_stats?.hit_dice?.current??max));
 const automaticSlots=hasClassCasting(c)||!!before&&hasClassCasting(before);
 if((slots.some(n=>n>0)||pact)&&!c.spellSettings){c.spellSettings=structuredClone(spellState(c));for(const id of protectedSlots)if(id.startsWith('spell-slot:'))delete c.spellSettings.slots[id.split(':')[1]];}
 const knownSlots=c.spellSettings?.slots||{};
 if(!caster&&!pact&&!slots.length&&!automaticSlots)slots=Array.from({length:9},(_,i)=>knownSlots[String(i+1)]?.max||0);
 for(let i=0;i<slots.length;i++)if(slots[i]>0){const level=String(i+1),max=slots[i],existing=knownSlots[level],updated=ensure(`spell-slot:${level}`,`${level}环法术位`,max,max-(existing?.used||0));if(c.spellSettings&&updated)c.spellSettings.slots[level]={max,used:max-resources[`spell-slot:${level}`].current};}
 if(pact){const {level,max}=pactSlotCapacity(pact);ensure(`pact-slot:${level}`,`${level}环契约位`,max);}
 if(automaticSlots&&c.spellSettings)for(const level of Object.keys(c.spellSettings.slots))if(!needed.has(`spell-slot:${level}`)&&!protectedSlots.has(`spell-slot:${level}`)&&!slotBalanceHeld(c,`spell-slot:${level}`))delete c.spellSettings.slots[level];
 for(const [id,r] of Object.entries(resources))if(r.automatic&&!needed.has(id)&&!protectedSlots.has(id)&&!slotBalanceHeld(c,id)&&!ownedLimitedSourceResource(c,id)&&!ownedItemChargeResource(c,id))delete resources[id];
 const featuresChanged=syncFeatureResources(c);
 return featuresChanged||previous!==JSON.stringify([resources,c.spellSettings?.slots,c.runtime.slotCapacityReview]);
}
export function setResource(c:Character,id:string,current:number){if(slotBalanceHeld(c,id))throw Error('该法术位的原余额尚未确认，请先核对实际余量。');if(ownedItemChargeResource(c,id))throw Error('物品充能只能由专属记账操作修改。');if(ownedLimitedSourceResource(c,id))throw Error('有限来源余额只能由专属操作修改。');const r=c.runtime.resources[id];if(!r)return;r.current=Math.max(0,r.unlimited?current:Math.min(r.max,current));if(r.featureGrant){r.featureGrant.spent=Math.max(0,r.max-r.current);(c.runtime.featureResourceArchive||={})[id]=structuredClone(r);}if(id.startsWith('spell-slot:')&&c.spellSettings)c.spellSettings.slots[id.split(':')[1]]={max:r.max,used:r.max-r.current};rememberKnownSlotBalance(c,id);}
