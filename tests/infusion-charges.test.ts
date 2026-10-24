import {it,expect} from 'vitest';
import {infusionChargesFixture} from './helpers/infusionChargesFixture';
import {infusionChargeOffer as offer,infusionChargeActionRequest as request,performInfusionChargeAction as perform,infusionChargeKey,validateInfusionChargeState,type InfusionChargeAction,type InfusionChargeRequest} from '../src/core/automation/infusionCharges';
import {setInfusionTarget,setInfusionHeld,infusionTargets,canActivateInfusion,evaluateInfusions} from '../src/core/automation/infusions';
import {activeSelections} from '../src/core/automation/active';
import {validateCharacter} from '../src/core/validation';
import {setSheetChoiceSlot} from '../src/core/automation/choices';
import {performRest} from '../src/core/automation/rest';
import {setResource} from '../src/core/resources';
const use:InfusionChargeAction={kind:'use',triggerConfirmed:true,reactionConfirmed:true};
const dawn=(roll:number):InfusionChargeAction=>({kind:'dawn',dawnConfirmed:true,roll});
function bound(name='Repulsion Shield'){
 const f=infusionChargesFixture(name);setInfusionTarget(f.c,f.choiceId,f.infusion.id,f.targetId);if(name==='Repulsion Shield')setInfusionHeld(f.c,f.choiceId,f.infusion.id,true);return f;
}
function initialized(name='Repulsion Shield',initial=4){const f=bound(name);expect(perform(f.c,request(f.c,f.choiceId,f.infusion.id,'initial',{kind:'initialize',initial})).status).toBe('applied');return f;}
const current=(f:ReturnType<typeof bound>)=>offer(f.c,f.choiceId,f.infusion.id).current;
function act(f:ReturnType<typeof bound>,action:InfusionChargeAction,id='action'){return perform(f.c,request(f.c,f.choiceId,f.infusion.id,id,action));}
function unchangedReject(f:ReturnType<typeof bound>,r:InfusionChargeRequest){const before=JSON.stringify(f.c);expect(perform(f.c,r).status).toBe('rejected');expect(JSON.stringify(f.c)).toBe(before);}

it.each(['Repulsion Shield','Mind Sharpener'])('%s never creates resources from selection, binding, evaluation or offer',name=>{
 const f=infusionChargesFixture(name);expect(offer(f.c,f.choiceId,f.infusion.id).canInitialize).toBe(false);expect(f.c.runtime.infusionCharges).toBeUndefined();
 setInfusionTarget(f.c,f.choiceId,f.infusion.id,f.targetId);const before=JSON.stringify(f.c);expect(offer(f.c,f.choiceId,f.infusion.id)).toMatchObject({supported:true,canInitialize:true,canUse:false,canDawn:false});evaluateInfusions(f.c,activeSelections(f.c));expect(JSON.stringify(f.c)).toBe(before);
});
it.each([0,1,2,3,4])('records explicitly chosen initial %s once, never auto-full',initial=>{
 const f=initialized('Repulsion Shield',initial);expect(current(f)).toBe(initial);expect(f.c.schemaVersion).toBe(1);expect(f.c.infusions!.version).toBe(1);expect(f.c.runtime.resources).toEqual({});
 unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'second-initial',{kind:'initialize',initial:4}));
});
it.each([-1,5,1.5,NaN,Infinity,'4',null,undefined])('rejects invalid initial balance %s atomically',initial=>{const f=bound();unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'bad',{kind:'initialize',initial:initial as number}));});
it.each(['Repulsion Shield','Mind Sharpener'])('%s consumes exactly one, persists receipt and handles exact retry without debit',name=>{
 const f=initialized(name),r=request(f.c,f.choiceId,f.infusion.id,'use',use);expect(perform(f.c,r)).toMatchObject({status:'applied',receipt:{kind:'use',before:4,after:3,action:use}});const after=JSON.stringify(f.c);
 expect(perform(f.c,r).status).toBe('duplicate');expect(JSON.stringify(f.c)).toBe(after);
 const reopened=validateCharacter(JSON.parse(JSON.stringify(f.c)));expect(perform(reopened,r).status).toBe('duplicate');expect(reopened.runtime.infusionCharges).toEqual(f.c.runtime.infusionCharges);
});
it('rejects insufficient balance, absent record and incomplete trigger/reaction confirmations',()=>{
 for(const initial of [undefined,0]){const f=initial===undefined?bound():initialized('Repulsion Shield',initial);unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'use',use));}
 for(const action of [{kind:'use'},{...use,triggerConfirmed:false},{...use,reactionConfirmed:false},{...use,triggerConfirmed:1},{...use,cost:0}]){const f=initialized();unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'use',action as InfusionChargeAction));}
});
it.each([1,2,3,4])('restores the actual dawn d4 value %s and caps at four',roll=>{
 const f=initialized('Mind Sharpener',1);expect(act(f,dawn(roll))).toMatchObject({status:'applied',receipt:{before:1,after:Math.min(4,1+roll),action:{kind:'dawn',roll}}});expect(current(f)).toBe(Math.min(4,1+roll));
});
it.each([0,5,1.5,NaN,'2',null,undefined])('rejects invalid dawn d4 %s without writes',roll=>{const f=initialized('Mind Sharpener',1);unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'dawn',dawn(roll as number)));});
it('requires explicit dawn confirmation, no broad reset or fixed recovery; full balance does not record dawn',()=>{
 const f=initialized('Mind Sharpener',0);unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'dawn',{kind:'dawn',dawnConfirmed:false,roll:4}));
 unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'dawn',{kind:'restore',recovery:'long'} as any));
 expect(act(f,dawn(4),'dawn').status).toBe('applied');unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'dawn-again',dawn(1)));
});
it.each(['Repulsion Shield','Mind Sharpener'])('%s dawn is not gated by wearing, holding or attunement',name=>{
 const f=initialized(name,0),target=f.c.selections.find(row=>row.id===f.targetId)!;target.equipped=false;target.attuned=false;delete f.c.infusions!.bindings[0].held;
 expect(offer(f.c,f.choiceId,f.infusion.id)).toMatchObject({canUse:false,canDawn:true});expect(act(f,dawn(2))).toMatchObject({status:'applied',receipt:{after:2}});
});
it.each(['unequipped','unattuned','unheld','multiple shields'])('Repulsion use requires held equipped attuned shield: %s',reason=>{
 const f=initialized(),target=f.c.selections.find(row=>row.id==='shield')!;
 if(reason==='unequipped')target.equipped=false;if(reason==='unattuned')target.attuned=false;if(reason==='unheld')delete f.c.infusions!.bindings[0].held;if(reason==='multiple shields')f.c.selections.push({...structuredClone(target),id:'other-shield'});
 expect(offer(f.c,f.choiceId,f.infusion.id).canUse).toBe(false);unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'use',use));expect(offer(f.c,f.choiceId,f.infusion.id).canDawn).toBe(false); // still full, no restoration needed
});
it('Mind needs worn armor or robes but never attunement or holding and adds no AC',()=>{
 const f=initialized('Mind Sharpener'),result=evaluateInfusions(f.c,activeSelections(f.c));expect(result.bonus).toBe(0);expect(result.trace).toEqual([]);expect(result.spellAttack.bonus).toBe(0);expect(f.c.selections.find(row=>row.id==='armor')!.attuned).toBe(false);expect(act(f,use).status).toBe('applied');
 f.c.selections.find(row=>row.id==='armor')!.equipped=false;unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'not-worn',use));expect(act(f,dawn(1),'recover-not-worn').status).toBe('applied');
 setInfusionTarget(f.c,f.choiceId,f.infusion.id,'robes');f.c.selections.find(row=>row.id==='robes')!.equipped=true;expect(act(f,{kind:'initialize',initial:1},'robes-initial').status).toBe('applied');expect(act(f,use,'robes-use').status).toBe('applied');
});
it.each(['source','english','type','rarity','copy','effect','quantity','bonus','attune'])('Mind rejects noncanonical/nonmagical robe lookalike (%s)',change=>{
 const f=infusionChargesFixture('Mind Sharpener'),target=f.c.selections.find(row=>row.id==='robes')!;
 if(change==='source')target.entry.source='XPHB';if(change==='english')target.entry.english='Unknown';if(change==='type')target.entry.raw.type='G|XPHB';if(change==='rarity')target.entry.raw.rarity='common';if(change==='copy')target.entry.raw._copy={};if(change==='effect')target.entry.effects=[{op:'add',target:'ac',value:1}];if(change==='quantity')target.quantity=2;if(change==='bonus')target.entry.raw.bonusAc=0;if(change==='attune')target.entry.raw.reqAttune=true;
 expect(infusionTargets(f.c,f.infusion).map(row=>row.id)).not.toContain('robes');expect(()=>setInfusionTarget(f.c,f.choiceId,f.infusion.id,'robes')).toThrow();
});
it('accepts LA/MA/HA Mind armor and strict Robes, not shields, other G or renamed display impostors',()=>{
 const f=infusionChargesFixture('Mind Sharpener'),armor=f.c.selections.find(row=>row.id==='armor')!;
 for(const type of ['LA','MA','HA']){armor.entry.raw.type=type;expect(infusionTargets(f.c,f.infusion).map(row=>row.id)).toEqual(['armor','robes']);}
 const other=structuredClone(f.c.selections.find(row=>row.id==='robes')!);other.id='clothes';other.entry.english='Fine Clothes';other.entry.name='Robes';f.c.selections.push(other);expect(infusionTargets(f.c,f.infusion).map(row=>row.id)).toEqual(['armor','robes']);
});
it.each(['Repulsion Shield','Mind Sharpener'])('%s source/owner/target/feature/automation restrictions suspend all charge actions',name=>{
 for(const change of [(f:ReturnType<typeof bound>)=>f.c.profile.enabledSources=[],(f:ReturnType<typeof bound>)=>f.c.automation!.enabled=false,(f:ReturnType<typeof bound>)=>f.c.selections[0].level=name==='Mind Sharpener'?1:5,(f:ReturnType<typeof bound>)=>f.c.profile.disabledEntries=[f.infusion.id],(f:ReturnType<typeof bound>)=>f.c.selections=f.c.selections.filter(row=>row.id!=='infuse-feature'),(f:ReturnType<typeof bound>)=>f.c.selections.find(row=>row.id===f.targetId)!.quantity=2,(f:ReturnType<typeof bound>)=>f.c.selections[0].entry.raw.classFeatures=[]]){
  const f=initialized(name,1);change(f);const before=JSON.stringify(f.c);expect(offer(f.c,f.choiceId,f.infusion.id)).toMatchObject({canInitialize:false,canUse:false,canDawn:false});for(const action of [use,dawn(1),{kind:'initialize',initial:4} as const])unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'blocked',action));expect(JSON.stringify(f.c)).toBe(before);
 }
});
it('never substitutes another class level or class instance for the learned owner',()=>{
 const f=infusionChargesFixture('Repulsion Shield',5);f.c.selections.push({...structuredClone(f.c.selections[0]),id:'level20',level:20});expect(canActivateInfusion(f.c,f.choiceId,f.infusion.id)).toBe(false);f.c.selections[0].level=6;expect(canActivateInfusion(f.c,f.choiceId,f.infusion.id)).toBe(true);
});
it('reuses canonical history across imported snapshot IDs and character copies, never across target or class instances',()=>{
 const f=initialized();expect(act(f,use).status).toBe('applied');const key=offer(f.c,f.choiceId,f.infusion.id).key!;expect(key).toBe(infusionChargeKey('owner','Repulsion Shield|TCE','shield'));
 f.c.id='new-character-copy';f.c.name='Renamed';f.infusion.name='Renamed infusion';expect(current(f)).toBe(3);
 setInfusionTarget(f.c,f.choiceId,f.infusion.id,null);const duplicate={...structuredClone(f.infusion),id:'another-import'};f.c.classChoiceSnapshots![duplicate.id]=duplicate;f.c.answers[f.choiceId]=[duplicate.id];setInfusionTarget(f.c,f.choiceId,duplicate.id,'shield');expect(offer(f.c,f.choiceId,duplicate.id)).toMatchObject({key,current:3,canInitialize:false});
});
it('A to B to A, revoke and relearn never reset historical charges',()=>{
 const f=initialized();expect(act(f,use).status).toBe('applied');const shield=f.c.selections.find(row=>row.id==='shield')!;f.c.selections.push({...structuredClone(shield),id:'shield-B',equipped:false});
 setInfusionTarget(f.c,f.choiceId,f.infusion.id,'shield-B');expect(current(f)).toBeUndefined();expect(act(f,{kind:'initialize',initial:2},'init-B').status).toBe('applied');setInfusionTarget(f.c,f.choiceId,f.infusion.id,'shield');expect(current(f)).toBe(3);
 const history=JSON.stringify(f.c.runtime.infusionCharges);setSheetChoiceSlot(f.c,f.choiceId,0,undefined,f.entries);expect(f.c.infusions!.bindings).toEqual([]);setSheetChoiceSlot(f.c,f.choiceId,0,f.infusion.id,f.entries);expect(f.c.infusions!.bindings).toEqual([]);setInfusionTarget(f.c,f.choiceId,f.infusion.id,'shield');expect(current(f)).toBe(3);expect(JSON.stringify(f.c.runtime.infusionCharges)).toBe(history);
});
it('disable/re-enable, unbind/rebind, repeated evaluation and reload do not refill',()=>{
 const f=initialized('Mind Sharpener',1),history=JSON.stringify(f.c.runtime.infusionCharges);f.c.automation!.enabled=false;offer(f.c,f.choiceId,f.infusion.id);f.c.automation!.enabled=true;setInfusionTarget(f.c,f.choiceId,f.infusion.id,null);setInfusionTarget(f.c,f.choiceId,f.infusion.id,f.targetId);evaluateInfusions(f.c,activeSelections(f.c));f.c=validateCharacter(JSON.parse(JSON.stringify(f.c)));expect(current(f)).toBe(1);expect(JSON.stringify(f.c.runtime.infusionCharges)).toBe(history);
});
it('keeps manual resources with identical labels and canonical keys isolated from initialize/use/dawn',()=>{
 const f=bound(),key=offer(f.c,f.choiceId,f.infusion.id).key!;f.c.runtime.resources={[key]:{name:'Repulsion Shield',current:23,max:99,unlimited:true},'infusion:Repulsion Shield|TCE':{name:'斥力之盾',current:0,max:0}};const resources=JSON.stringify(f.c.runtime.resources);
 expect(act(f,{kind:'initialize',initial:2},'init').status).toBe('applied');expect(act(f,use,'use').status).toBe('applied');expect(act(f,dawn(3),'dawn').status).toBe('applied');expect(JSON.stringify(f.c.runtime.resources)).toBe(resources);
 const charges=JSON.stringify(f.c.runtime.infusionCharges);setResource(f.c,key,12);expect(JSON.stringify(f.c.runtime.infusionCharges)).toBe(charges);
});
it.each(['short','long'] as const)('%s rest does not mean dawn or alter independent balances',kind=>{
 const f=initialized('Mind Sharpener',1),charges=JSON.stringify(f.c.runtime.infusionCharges);performRest(f.c,{id:'rest',sequence:0,revision:f.c.revision,kind,rolls:[],recover:{}});expect(JSON.stringify(f.c.runtime.infusionCharges)).toBe(charges);
});
it('rejects duplicate rule, target and capacity conflicts without modifying charge history',()=>{
 for(const change of [(f:ReturnType<typeof bound>)=>f.c.infusions!.bindings.push({...f.c.infusions!.bindings[0]}),(f:ReturnType<typeof bound>)=>f.c.infusions!.bindings.push({choiceId:'other',entryId:'other',targetId:f.targetId}),(f:ReturnType<typeof bound>)=>{for(let i=0;i<4;i++)f.c.infusions!.bindings.push({choiceId:'other'+i,entryId:'other'+i,targetId:'other'+i});}]){const f=initialized('Mind Sharpener',1);change(f);expect(offer(f.c,f.choiceId,f.infusion.id)).toMatchObject({canUse:false,canDawn:false,canInitialize:false});unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'blocked',use));}
});
it.each(['revision','equipment','attunement','binding','source','raw target','balance','owner level','class feature','choice answer'])('rejects stale basis after %s changes even if revision is not advanced',change=>{
 const f=initialized(),r=request(f.c,f.choiceId,f.infusion.id,'use',use);
 if(change==='revision')f.c.revision++;if(change==='equipment')f.c.selections.find(row=>row.id==='shield')!.equipped=false;if(change==='attunement')f.c.selections.find(row=>row.id==='shield')!.attuned=false;if(change==='binding')delete f.c.infusions!.bindings[0].held;if(change==='source')f.c.profile.enabledSources=['PHB'];if(change==='raw target')f.c.selections.find(row=>row.id==='shield')!.entry.raw.ac=3;if(change==='balance'){const state=f.c.runtime.infusionCharges!;state.records[r.key].current=2;state.last!.after=2;(state.last!.action as any).initial=2;}if(change==='owner level')f.c.selections[0].level=7;if(change==='class feature')f.c.selections[1].entry.raw.classSource='ERLW';if(change==='choice answer')f.c.answers[f.choiceId]=[];
 unchangedReject(f,r);
});
it('rejects changed IDs, payload fingerprints, keys and original stale requests after a newer operation',()=>{
 const f=initialized(),r=request(f.c,f.choiceId,f.infusion.id,'same',use);expect(perform(f.c,r).status).toBe('applied');unchangedReject(f,{...r,action:dawn(1)});expect(act(f,dawn(1),'new').status).toBe('applied');unchangedReject(f,r);
 for(const patch of [{key:'other'},{sequence:0},{revision:0},{id:''},{basis:''},{action:{...use,rest:'long'}}])unchangedReject(f,{...request(f.c,f.choiceId,f.infusion.id,'bad',use),...patch} as any);
});
it('preserves unknown charge versions on import and rejects actions without mutation',()=>{
 const f=bound();(f.c.runtime as any).infusionCharges={version:2,future:{keep:[1,2,3]}};const before=JSON.stringify(f.c);expect(offer(f.c,f.choiceId,f.infusion.id)).toMatchObject({supported:true,canInitialize:false,canUse:false,canDawn:false});expect(validateCharacter(JSON.parse(before))).toEqual(f.c);unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'init',{kind:'initialize',initial:4}));
});
it.each(['max','current','unlimited','ownership','record-key','sequence','last','receipt-after','receipt-dawn','extra-state'])('rejects malformed own charge store (%s), never repairs or overwrites it',change=>{
 const f=initialized('Mind Sharpener',2),state=f.c.runtime.infusionCharges!,key=Object.keys(state.records)[0];
 if(change==='max')state.records[key].max=5 as 4;if(change==='current')state.records[key].current=-1;if(change==='unlimited')(state.records[key] as any).unlimited=true;if(change==='ownership')state.records[key].ownerId='other';if(change==='record-key'){state.records.wrong=state.records[key];delete state.records[key];}if(change==='sequence')state.sequence=0;if(change==='last')delete state.last;if(change==='receipt-after')state.last!.after=3;if(change==='receipt-dawn'){state.last!.kind='dawn';state.last!.action=dawn(5);}if(change==='extra-state')(state as any).unlimited=true;
 expect(()=>validateInfusionChargeState(state)).toThrow();const before=JSON.stringify(f.c);expect(()=>validateCharacter(JSON.parse(before))).toThrow();unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'new',use));expect(JSON.stringify(f.c)).toBe(before);
});
it('does not change HP, concentration-like manual data, positions, reactions or original entry snapshots',()=>{
 const f=initialized('Mind Sharpener',2);f.c.notes='Manual concentration and reaction tracking';f.c.inventory={view:'list',order:[],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:0,pp:0},positions:{armor:8}};f.c.runtime.hp=9;const before=structuredClone(f.c);expect(act(f,use).status).toBe('applied');delete before.runtime.infusionCharges;const after=structuredClone(f.c);delete after.runtime.infusionCharges;expect(after).toEqual(before);
});

it('binds pending requests to the current character while copied history remains valid',()=>{
 const f=initialized(),r=request(f.c,f.choiceId,f.infusion.id,'pending',use);const copied=structuredClone(f);copied.c.id='other-character';const before=JSON.stringify(copied.c);expect(perform(copied.c,r).status).toBe('rejected');expect(JSON.stringify(copied.c)).toBe(before);expect(current(copied)).toBe(4);expect(act(copied,use,'local-copy-action').status).toBe('applied');expect(current(f)).toBe(4);
});
it('new actual class or item instances have separate uninitialized ownership without deleting old records',()=>{
 const f=initialized('Mind Sharpener',2),oldKey=offer(f.c,f.choiceId,f.infusion.id).key!;setInfusionTarget(f.c,f.choiceId,f.infusion.id,null);
 f.c.selections[0].id='different-owner';f.c.selections[1].parentId='different-owner';const oldChoice=f.choiceId;f.choiceId='different-owner:class-optional:0';f.c.answers[f.choiceId]=f.c.answers[oldChoice];delete f.c.answers[oldChoice];setInfusionTarget(f.c,f.choiceId,f.infusion.id,f.targetId);
 expect(offer(f.c,f.choiceId,f.infusion.id)).toMatchObject({canInitialize:true,key:infusionChargeKey('different-owner','Mind Sharpener|TCE','armor')});expect(f.c.runtime.infusionCharges!.records[oldKey].current).toBe(2);
 expect(act(f,{kind:'initialize',initial:0},'second-owner').status).toBe('applied');setInfusionTarget(f.c,f.choiceId,f.infusion.id,null);f.c.selections.find(row=>row.id==='armor')!.id='different-armor';setInfusionTarget(f.c,f.choiceId,f.infusion.id,'different-armor');expect(offer(f.c,f.choiceId,f.infusion.id).canInitialize).toBe(true);expect(Object.keys(f.c.runtime.infusionCharges!.records)).toHaveLength(2);
});
it.each([null,{version:1,bindings:null},{version:1,bindings:[null]},{version:77,future:'keep'}])('rejects corrupted or future binding stores without changing independent history: %j',infusions=>{
 const f=initialized(),r=request(f.c,f.choiceId,f.infusion.id,'pending',use);(f.c as any).infusions=infusions;unchangedReject(f,r);expect(offer(f.c,f.choiceId,f.infusion.id)).toMatchObject({supported:true,canUse:false,canDawn:false,canInitialize:false});
});
it('rejects sequence exhaustion and malformed requests without mutation',()=>{
 const f=initialized(),state=f.c.runtime.infusionCharges!;state.sequence=Number.MAX_SAFE_INTEGER;state.last!.sequence=Number.MAX_SAFE_INTEGER-1;unchangedReject(f,request(f.c,f.choiceId,f.infusion.id,'overflow',use));
 for(const invalid of [null,undefined,[],{}, {id:'x'}]){const before=JSON.stringify(f.c);expect(perform(f.c,invalid as any).status).toBe('rejected');expect(JSON.stringify(f.c)).toBe(before);}
});
it('initialization is explicit and permitted before wearing, without granting use readiness',()=>{
 const f=bound();const target=f.c.selections.find(row=>row.id==='shield')!;target.equipped=false;target.attuned=false;delete f.c.infusions!.bindings[0].held;expect(act(f,{kind:'initialize',initial:3}).status).toBe('applied');expect(offer(f.c,f.choiceId,f.infusion.id)).toMatchObject({current:3,canInitialize:false,canUse:false,canDawn:true});
});
