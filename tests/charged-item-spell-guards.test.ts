import {expect,it,vi} from 'vitest';
import type {Character} from '../src/core/model';
import * as chargeActor from '../src/core/automation/itemChargeDebits';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {syncSourceSpells,setChargedItemSpellIntent} from '../src/core/automation/sourceSpells';
import {chargedItemSpellOffer,chargedItemSpellObservedIntent,chargedItemSpellBoundCastReceipt,chargedItemSpellDebitId} from '../src/core/automation/chargedItemSpells';
import {assertProtectedResourceHistoryTravel} from '../src/core/automation/protectedResourceHistoryTravel';
import {applyPatch} from '../src/core/merge';
import {readCharacter} from '../src/core/validation';
import nonunit from '../src/core/automation/nonunitItemChargeEvidence.json';
import {chargedItemSpellSpecs,chargedItemSpellFindOwner,chargedItemSpellSnapshot as snapshot} from './helpers/chargedItemSpellSourceFixture';
import {chargedItemSpellFixture} from './helpers/chargedItemSpellFlowFixture';

const authority={canEdit:true,gm:false},first=chargedItemSpellSpecs[0];
const consent={confirmedGenuineOwnedItem:true}as const,castConsent={confirmedCurrentItemCastValid:true}as const;
function acquire(f:ReturnType<typeof chargedItemSpellFixture>,remaining=f.rule.capacity){
 const pool=chargeActor.itemChargeOffers(f.c,authority).find(row=>row.ownerId===f.owner.id)!;
 expect(chargeActor.performItemChargeAction(f.c,chargeActor.itemChargeRequest(f.c,f.owner.id,'known',{kind:'acquire',knownRemaining:remaining,confirmedGenuineItem:true,confirmedKnownBalance:true}),authority).status).toBe('applied');return{...f,pool};
}
const known=(id=first.ownerId,form:'canonical'|'final'='canonical',remaining?:number)=>acquire(chargedItemSpellFixture(id,form),remaining);
function activate(f:ReturnType<typeof known>){
 setChargedItemSpellIntent(f.c,f.owner.id,consent,f.entries,authority);syncSourceSpells(f.c,f.entries);
 const children=f.c.selections.filter(row=>row.parentId===f.owner.id&&row.grantKey?.startsWith('source-spell:item-charged/'));expect(children).toHaveLength(1);return{...f,child:children[0]};
}
const active=(id=first.ownerId,remaining?:number)=>activate(known(id,'canonical',remaining));
function castRequest(f:ReturnType<typeof active>,id='cast',context?:any,payment='item-charge',mode:'cast'|'restore'='cast'){
 const current=arguments.length<3?castConsent:context;
 return(spellActionRequest as any)(f.c,f.child.id,payment,id,mode,undefined,undefined,current);
}
function rejectUnchanged(c:Character,request:any,access?:any){const current=arguments.length>=3?access:authority,before=snapshot(c);expect(performSpellAction(c,request,current).status).toBe('rejected');expect(snapshot(c)).toBe(before);}
function rejectConsent(f:ReturnType<typeof known>,access:any,intent:any=consent){const before=snapshot(f.c);expect(()=>setChargedItemSpellIntent(f.c,f.owner.id,intent,f.entries,access)).toThrow();expect(snapshot(f.c)).toBe(before);}
const marker=(f:ReturnType<typeof active>)=>(f.c.spellSettings!.special![f.child.id].sourceGrant as any).itemChargedSpell;
function denyFallbacks(f:ReturnType<typeof active>){for(const id of ['free','source','resource','check','slot:spell-slot:9','ordinary:spell-slot:9','item-charge'])rejectUnchanged(f.c,castRequest(f,'denied-'+id,castConsent,id));}

it('requires an exact own per-cast literal confirmation, not inherited, extra or previously reusable consent',()=>{
 const f=active();for(const context of [undefined,{},Object.create(castConsent),{confirmedCurrentItemCastValid:false},{confirmedCurrentItemCastValid:1},{...castConsent,authoredExtra:true}])rejectUnchanged(f.c,castRequest(f,'context',context));
 const symbol={...castConsent};(symbol as any)[Symbol('authored-extra')]=true;rejectUnchanged(f.c,castRequest(f,'symbol',symbol));
 expect(performSpellAction(f.c,castRequest(f,'first'),authority).status).toBe('applied');rejectUnchanged(f.c,castRequest(f,'second-without-current-confirmation',{}));
});
it('activation, paid cast and withdrawal require current own canEdit true without changing the old charge policy',()=>{
 for(const access of [undefined,{},Object.create({canEdit:true}),{canEdit:1},{canEdit:false,gm:true},{canEdit:true,gm:1}]){
  rejectConsent(known(),access);const f=active();rejectUnchanged(f.c,castRequest(f),access);rejectConsent(f,access,null);
 }
 const f=active();const ledger=snapshot(f.c.runtime.itemChargeDebits);setChargedItemSpellIntent(f.c,f.owner.id,null,f.entries,authority);expect(snapshot(f.c.runtime.itemChargeDebits)).toBe(ledger);
});
it('current card and owned-pool locks require explicit GM authority for the same source-bound cast',()=>{
 for(const lock of ['card','pool']as const){const f=active();if(lock==='card')f.c.locked=true;else f.c.runtime.resources[f.pool.key].locked=true;rejectUnchanged(f.c,castRequest(f),authority);rejectUnchanged(f.c,castRequest(f),{canEdit:true,gm:1});expect(performSpellAction(f.c,castRequest(f,'gm'),{canEdit:true,gm:true}).status).toBe('applied');}
});
it('queued revision, source, target, nonce or pool changes cannot borrow a fresh charged payment',()=>{
 const changes:((f:ReturnType<typeof active>)=>void)[]=[f=>{f.c.revision++;},f=>{f.entry.raw.authoredExtra=true;},f=>{f.child.entry.raw.authoredExtra=true;},f=>{f.c.profile.enabledSources=[];},f=>{marker(f).nonce++;},f=>{f.c.runtime.resources[f.pool.key].current--;},f=>{setChargedItemSpellIntent(f.c,f.owner.id,null,f.entries,authority);setChargedItemSpellIntent(f.c,f.owner.id,consent,f.entries,authority);}];
 for(const change of changes){const f=active(),request=castRequest(f,'queued');change(f);rejectUnchanged(f.c,request);}
});
it('exact existing final equipment forms and coherent owner aliases retain one pool; canonical disable still wins',()=>{
 const f=active(),queued=castRequest(f,'same-rule-transport-form'),canonical=structuredClone(f.owner.entry),final=structuredClone(chargedItemSpellFindOwner(f.rule.id,'final'));
 // All eleven accepted final forms differ only in transport revision. That
 // revision is not new rule authority and cannot make an unchanged cast stale.
 expect(snapshot({...final,id:canonical.id,revision:canonical.revision})).toBe(snapshot(canonical));
 f.owner.entry=final;expect(chargedItemSpellOffer(f.c,f.owner.id,f.entries,authority).active).toBe(true);expect(performSpellAction(f.c,queued,authority).status).toBe('applied');expect(f.c.runtime.itemChargeDebits!.records).toHaveLength(1);expect(f.c.runtime.itemChargeDebits!.records[0].spent).toBe(1);
 const edited=active(),pending=castRequest(edited,'before-real-payload-edit');edited.owner.entry=structuredClone(chargedItemSpellFindOwner(edited.rule.id,'final'));edited.owner.entry.raw.authoredUnprovedSourceField=true;expect(chargedItemSpellOffer(edited.c,edited.owner.id,edited.entries,authority).active).toBe(false);rejectUnchanged(edited.c,pending);rejectUnchanged(edited.c,castRequest(edited,'fresh-but-unproved-payload'));
 const raw=chargedItemSpellFixture(first.ownerId);raw.entry.id='authored-coherent-unreserved-item-alias';const alias=activate(acquire(raw));expect(chargedItemSpellOffer(alias.c,alias.owner.id,alias.entries,authority).active).toBe(true);expect(spellPayments(alias.c,alias.child.id,authority).options[0].available).toBe(true);expect(performSpellAction(alias.c,castRequest(alias,'real-alias-payment'),authority).status).toBe('applied');
 const beforeDisable=castRequest(alias,'before-canonical-disable');alias.c.profile.disabledEntries=[first.ownerId];const disabled=chargedItemSpellOffer(alias.c,alias.owner.id,alias.entries,authority);expect(disabled.active).toBe(false);expect(disabled.canConfirm).toBe(false);expect(spellPayments(alias.c,alias.child.id,authority).options.filter(row=>row.available)).toHaveLength(0);rejectUnchanged(alias.c,beforeDisable);rejectUnchanged(alias.c,castRequest(alias,'fresh-canonical-disable'));
});
it('generated-ID collisions never overwrite manual ancestry, config, preparation or the rest of the card',()=>{
 const template=active(),f=known();setChargedItemSpellIntent(f.c,f.owner.id,consent,f.entries,authority);
 const collision={...structuredClone(f.manual),id:template.child.id};f.c.selections.push(collision);f.c.spellSettings!.special![collision.id]=structuredClone(f.manualConfig);f.c.spellSettings!.prepared.push(collision.id);
 const before=snapshot(f.c);syncSourceSpells(f.c,f.entries);expect(snapshot(f.c)).toBe(before);expect(spellPayments(f.c,collision.id,authority).options).toHaveLength(0);
});
it('future intent or carrier markers remain inactive and cannot fall through to check, free, slots or restore',()=>{
 for(const change of [(f:ReturnType<typeof active>)=>{(f.c.automation!.chargedItemSpells as any).version=99;},(f:ReturnType<typeof active>)=>{marker(f).version=99;},(f:ReturnType<typeof active>)=>{marker(f).authoredExtra=true;},(f:ReturnType<typeof active>)=>{delete(f.c.spellSettings!.special![f.child.id].sourceGrant as any).itemChargedSpell;}]){
  const f=active();change(f);const before=snapshot(f.c);expect(spellPayments(f.c,f.child.id,authority).options.filter(row=>row.available)).toHaveLength(0);denyFallbacks(f);rejectUnchanged(f.c,castRequest(f,'restore',castConsent,'source','restore'));expect(snapshot(f.c)).toBe(before);
 }
});
it('forged other-source metadata cannot redirect generic spell payment into the owned charge pool',()=>{
 const f=active(),config=f.c.spellSettings!.special![f.manual.id];config.mode='locked';config.max=undefined;config.recovery=undefined;config.sourceGrant={ownerId:f.owner.id,key:'source-spell:authored-other-source',active:true,usage:'resource',resourceKey:f.pool.key,resourceCost:1,resourceName:'Authored not authority',canUseSlots:true};
 const before=snapshot(f.c);expect(spellPayments(f.c,f.manual.id,authority).options.filter(row=>row.available)).toHaveLength(0);
 for(const payment of ['resource','item-charge','free','ordinary:spell-slot:9']){const request=(spellActionRequest as any)(f.c,f.manual.id,payment,'forged-'+payment,'cast',undefined,undefined,castConsent);rejectUnchanged(f.c,request);}expect(snapshot(f.c)).toBe(before);
});
it('a preused deterministic charge transaction ID cannot become a free successful cast',()=>{
 const f=active(),castId='preused-charge-id',chargeId=chargedItemSpellDebitId(castId,f.child.id,f.rule.branch.key,f.rule.policySha256);
 expect(chargeId.length).toBeLessThanOrEqual(128);expect(chargeActor.performItemChargeAction(f.c,chargeActor.itemChargeRequest(f.c,f.owner.id,chargeId,{kind:'debit',actionKey:f.rule.branch.key}),authority).status).toBe('applied');
 rejectUnchanged(f.c,castRequest(f,castId));expect(f.c.runtime.automationActions).toBeUndefined();
});
it('duplicate, optimistic no-op or throwing charge actors on the staged candidate never mutate the live card',()=>{
 for(const mode of ['duplicate','no-op','throw']as const){const f=active(),before=snapshot(f.c),prior=f.c.runtime.itemChargeDebits!.last!,spy=vi.spyOn(chargeActor,'performItemChargeAction');
  spy.mockImplementation((candidate)=>{expect(candidate===f.c).toBe(false);if(mode==='throw'){candidate.notes='Authored unexpected candidate mutation';throw Error('Authored staged failure');}return{status:mode==='duplicate'?'duplicate':'applied',receipt:prior,message:'Authored optimistic reply'}as any;});
  try{expect(performSpellAction(f.c,castRequest(f,'staged-'+mode),authority).status).toBe('rejected');expect(spy).toHaveBeenCalledTimes(1);expect(snapshot(f.c)).toBe(before);}finally{spy.mockRestore();}
 }
});
it('minimum-after and exhaustion conserve known v1 debt through sync, withdrawal and reactivation without refill',()=>{
 for(const spec of [chargedItemSpellSpecs.find(row=>row.minAfter===0)!,chargedItemSpellSpecs.find(row=>row.minAfter===1)!]){
  const f=active(spec.ownerId,1+spec.minAfter),prefix=snapshot(f.c.runtime.itemChargeDebits!.records[0].events);expect(performSpellAction(f.c,castRequest(f,'terminal-safe'),authority).status).toBe('applied');expect(f.c.runtime.itemChargeDebits?.version).toBe(1);expect(f.c.runtime.resources[f.pool.key].current).toBe(spec.minAfter);expect(snapshot(f.c.runtime.itemChargeDebits!.records[0].events.slice(0,1))).toBe(prefix);
  const debt=snapshot(f.c.runtime.itemChargeDebits);syncSourceSpells(f.c,f.entries);setChargedItemSpellIntent(f.c,f.owner.id,null,f.entries,authority);setChargedItemSpellIntent(f.c,f.owner.id,consent,f.entries,authority);syncSourceSpells(f.c,f.entries);expect(snapshot(f.c.runtime.itemChargeDebits)).toBe(debt);rejectUnchanged(f.c,castRequest(f,'no-refill'));
 }
});
it('a fixed1 paid cast inside an already-valid v2 ledger preserves unrelated variable units and never downgrades history',()=>{
 const f=active(),policy=nonunit.owners.find(row=>row.packId==='kiwee')!,branch=policy.branches[0],ownerId='authored-retained-variable-owner',key='item-charge-debit:'+encodeURIComponent(JSON.stringify([ownerId])),store=f.c.runtime.itemChargeDebits!,start=store.sequence;
 const event={id:'authored-prior-variable',sequence:start+1,kind:'debit' as const,before:3,after:2,actionKey:branch.key,units:1,branchKey:branch.key,context:Object.fromEntries(branch.requiredContext.map(code=>[code,true]))as Record<string,true>,policySha256:policy.policySha256};
 const historical={key,ownerId,entryId:policy.id,canonicalEntryId:policy.id,snapshotSha256:policy.fullNormalizedSnapshotSha256,capacity:policy.capacity,initial:3,spent:1,withdrawn:false,events:[{id:'authored-prior-acquire',sequence:start,kind:'acquire' as const,before:0,after:3},event]};
 store.records.push(historical);store.version=2;store.sequence+=2;store.last={...event,key,fingerprint:'0'.repeat(64)};f.c.runtime.resources[key]={name:'Authored retained variable debt',max:policy.capacity,current:2,type:'count',itemChargeDebitGrant:{key}};expect(()=>chargeActor.validateItemChargeDebitState(store)).not.toThrow();const preserved=snapshot(historical);
 expect(performSpellAction(f.c,castRequest(f,'fixed-with-v2'),authority).status).toBe('applied');expect(f.c.runtime.itemChargeDebits?.version).toBe(2);expect(snapshot(f.c.runtime.itemChargeDebits!.records.find(row=>row.ownerId===ownerId))).toBe(preserved);expect(f.c.runtime.itemChargeDebits!.records.find(row=>row.ownerId===f.owner.id)!.events.at(-1)?.units).toBeUndefined();expect(()=>chargeActor.validateItemChargeDebitState(f.c.runtime.itemChargeDebits)).not.toThrow();
});
it('consent-only Undo/redo requires current authority, preserves later manual edits, and rejects unknown future intent edits',()=>{
 const f=known(),before=structuredClone(f.c);setChargedItemSpellIntent(f.c,f.owner.id,consent,f.entries,authority);const after=structuredClone(f.c),live=structuredClone(after);live.notes='Authored later note';live.runtime.resources.manual.current=1;
 const undo=applyPatch(live,after,before);expect(()=>assertProtectedResourceHistoryTravel(live,undo,authority)).not.toThrow();expect(undo.notes).toBe(live.notes);expect(undo.runtime.resources.manual.current).toBe(1);expect(snapshot(undo.runtime.itemChargeDebits)).toBe(snapshot(before.runtime.itemChargeDebits));
 for(const access of [undefined,{},Object.create({canEdit:true}),{canEdit:false,gm:true}])expect(()=>assertProtectedResourceHistoryTravel(live,undo,access as any)).toThrow();const redo=applyPatch(undo,before,after);expect(()=>assertProtectedResourceHistoryTravel(undo,redo,authority)).not.toThrow();
 const future=structuredClone(after);(future.automation!.chargedItemSpells as any).version=99;const same=structuredClone(future);same.notes='Authored harmless note';expect(()=>assertProtectedResourceHistoryTravel(future,same,authority)).not.toThrow();const changed=structuredClone(future);(changed.automation!.chargedItemSpells as any).sequence++;expect(()=>assertProtectedResourceHistoryTravel(future,changed,authority)).toThrow();
});
it('paired cast Undo/redo checks current resource locks and keeps unrelated later manual state',()=>{
 const f=active(),before=structuredClone(f.c);expect(performSpellAction(f.c,castRequest(f,'undoable-cast'),authority).status).toBe('applied');const after=structuredClone(f.c),live=structuredClone(after);live.notes='Authored later manual note';live.runtime.resources.manual.current=1;
 const undo=applyPatch(live,after,before);expect(()=>assertProtectedResourceHistoryTravel(live,undo,authority)).not.toThrow();expect(undo.notes).toBe(live.notes);expect(undo.runtime.resources.manual.current).toBe(1);expect(undo.runtime.resources[f.pool.key].current).toBe(before.runtime.resources[f.pool.key].current);expect(()=>assertProtectedResourceHistoryTravel(live,undo,undefined)).toThrow();
 const redo=applyPatch(undo,before,after);expect(()=>assertProtectedResourceHistoryTravel(undo,redo,authority)).not.toThrow();expect(redo.runtime.resources[f.pool.key].current).toBe(after.runtime.resources[f.pool.key].current);
 live.runtime.resources[f.pool.key].locked=true;const locked=applyPatch(live,after,before);expect(()=>assertProtectedResourceHistoryTravel(live,locked,authority)).toThrow();expect(()=>assertProtectedResourceHistoryTravel(live,locked,{canEdit:true,gm:true})).not.toThrow();
});
it('bound cast observation rejects same-ID receipts with forged source, policy, fee, target or charge-event bindings',()=>{
 const f=active();expect(performSpellAction(f.c,castRequest(f,'observed-cast'),authority).status).toBe('applied');expect(chargedItemSpellBoundCastReceipt(f.c,f.child.id,'observed-cast')?.id).toBe('observed-cast');
 const changes:((c:Character)=>void)[]=[c=>{(c.runtime.automationActions!.last as any).itemChargedSpell.policySha256='0'.repeat(64);},c=>{(c.runtime.automationActions!.last as any).itemChargedSpell.chargeEventId='authored-not-the-debit';},c=>{(c.runtime.automationActions!.last as any).itemChargedSpell.ownerId='authored-wrong-owner';},c=>{(c.runtime.automationActions!.last as any).itemChargedSpell.targetEntryId='authored-wrong-target';},c=>{c.runtime.automationActions!.last!.after=c.runtime.automationActions!.last!.before;},c=>{c.runtime.automationActions!.last!.resourceId='authored-other-pool';},c=>{c.selections.find(row=>row.id===f.owner.id)!.entry.raw.authoredExtra=true;},c=>{(c.runtime.automationActions!.last as any).itemChargedSpell.chargeReceipt[Symbol('authored-extra-charge-field')]=true;}];
 for(const change of changes){const card=structuredClone(f.c);change(card);expect(chargedItemSpellBoundCastReceipt(card,f.child.id,'observed-cast')).toBeUndefined();}
 expect(chargedItemSpellBoundCastReceipt(f.c,f.child.id,'authored-other-request')).toBeUndefined();
});
it('historical bound observation survives legitimate last charge and source/pool withdrawal without claiming current castability',()=>{
 const spec=chargedItemSpellSpecs.find(row=>row.minAfter===0)!,f=active(spec.ownerId,1);expect(performSpellAction(f.c,castRequest(f,'last-paid-cast'),authority).status).toBe('applied');expect(f.c.runtime.resources[f.pool.key].current).toBe(0);expect(chargedItemSpellBoundCastReceipt(f.c,f.child.id,'last-paid-cast')?.id).toBe('last-paid-cast');
 setChargedItemSpellIntent(f.c,f.owner.id,null,f.entries,authority);syncSourceSpells(f.c,f.entries);expect(chargedItemSpellObservedIntent(f.c,f.owner.id)?.enabled).toBe(false);expect(chargedItemSpellBoundCastReceipt(f.c,f.child.id,'last-paid-cast')?.id).toBe('last-paid-cast');
 expect(chargeActor.performItemChargeAction(f.c,chargeActor.itemChargeRequest(f.c,f.owner.id,'withdraw-pool',{kind:'withdraw'}),authority).status).toBe('applied');expect(chargedItemSpellBoundCastReceipt(f.c,f.child.id,'last-paid-cast')?.id).toBe('last-paid-cast');expect(spellPayments(f.c,f.child.id,authority).options.filter(row=>row.available)).toHaveLength(0);
 const back=readCharacter(JSON.parse(JSON.stringify(f.c))).character;expect(chargedItemSpellBoundCastReceipt(back,f.child.id,'last-paid-cast')?.id).toBe('last-paid-cast');
});
