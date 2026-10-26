import {it,expect} from 'vitest';
import {radiantRefuelingFixture} from './fixtures/radiantRefuelingFixture';
import {setInfusionTarget,evaluateInfusions,infusionTargets} from '../src/core/automation/infusions';
import {activeSelections} from '../src/core/automation/active';
import {refuelingRingOffer as offer,refuelingRingActionRequest as request,performRefuelingRingAction as perform,validateRefuelingRingState,type RefuelingRingAction,type RefuelingRingRequest} from '../src/core/automation/refuelingRing';
import {validateCharacter} from '../src/core/validation';
import {setResource} from '../src/core/resources';
import {performRest} from '../src/core/automation/rest';
import {setSheetChoiceSlot} from '../src/core/automation/choices';
const use=(slotKey='spell-slot:1'):RefuelingRingAction=>({kind:'use',slotKey,actionConfirmed:true});
const dawn:RefuelingRingAction={kind:'dawn',dawnConfirmed:true};
function ready(initial?:0|1,warlock=0){
 const f=radiantRefuelingFixture('Spell-Refueling Ring',warlock);f.c=structuredClone(f.c);setInfusionTarget(f.c,f.choiceId,f.entry.id,'ring-a');
 f.c.spellSettings={mode:'prepared',ability:'int',capacity:3,attackBonus:0,dcBonus:0,prepared:[],slots:{'1':{max:4,used:2},'2':{max:2,used:1}}};
 Object.assign(f.c.runtime.resources,{'spell-slot:1':{automatic:true,max:4,current:2},'spell-slot:2':{automatic:true,max:2,current:1}});
 if(warlock){const level=Math.min(5,Math.ceil(warlock/2));f.c.runtime.resources[`pact-slot:${level}`]={automatic:true,max:warlock===1?1:warlock<11?2:warlock<17?3:4,current:0};}
 if(initial!==undefined)expect(act(f,{kind:'initialize',initial},'init').status).toBe('applied');return f;
}
function act(f:ReturnType<typeof radiantRefuelingFixture>,action:RefuelingRingAction,id='action'){return perform(f.c,request(f.c,f.choiceId,f.entry.id,id,action));}
function unchangedReject(f:ReturnType<typeof ready>,r:RefuelingRingRequest){const before=structuredClone(f.c);expect(perform(f.c,r).status).toBe('rejected');expect(f.c).toEqual(before);}
it('never initializes, syncs, adopts pools or grants AC from reading, evaluating and binding',()=>{
 const f=ready();f.c.runtime.resources['spell-slot:1'].automatic=false;const before=structuredClone(f.c);
 expect(offer(f.c,f.choiceId,f.entry.id)).toMatchObject({supported:true,max:1,canInitialize:true,canUse:false,canDawn:false});evaluateInfusions(f.c,activeSelections(f.c));expect(f.c).toEqual(before);expect(f.c.runtime.refuelingRing).toBeUndefined();expect(f.c.runtime.infusionCharges).toBeUndefined();
});
it.each([0,1] as const)('initializes explicitly %s, once, without restoring any pool',initial=>{
 const f=ready(),pools=structuredClone(f.c.runtime.resources),slots=structuredClone(f.c.spellSettings);
 expect(act(f,{kind:'initialize',initial},'init').status).toBe('applied');expect(offer(f.c,f.choiceId,f.entry.id).current).toBe(initial);expect(f.c.schemaVersion).toBe(1);expect(f.c.infusions!.version).toBe(1);expect(f.c.runtime.resources).toEqual(pools);expect(f.c.spellSettings).toEqual(slots);
 unchangedReject(f,request(f.c,f.choiceId,f.entry.id,'again',{kind:'initialize',initial:1}));
});
it.each([-1,2,.5,NaN,Infinity,'1',null,undefined])('rejects invalid explicit initial %s with zero changes',initial=>{const f=ready();unchangedReject(f,request(f.c,f.choiceId,f.entry.id,'init',{kind:'initialize',initial} as any));});
it.each(['spell-slot:1','spell-slot:2','pact-slot:2'])('atomically spends the ring and credits exactly one %s',slotKey=>{
 const f=ready(1,3),before=structuredClone(f.c),r=request(f.c,f.choiceId,f.entry.id,'use',use(slotKey));
 expect(perform(f.c,r)).toMatchObject({status:'applied',receipt:{before:1,after:0,slot:{key:slotKey,before:before.runtime.resources[slotKey].current,after:before.runtime.resources[slotKey].current+1}}});
 expect(offer(f.c,f.choiceId,f.entry.id).current).toBe(0);
 for(const [key,pool] of Object.entries(before.runtime.resources))expect(f.c.runtime.resources[key]).toEqual(key===slotKey?{...pool,current:pool.current+1}:pool);
 if(slotKey.startsWith('spell-'))expect(f.c.spellSettings!.slots[slotKey.slice(-1)].used).toBe(before.spellSettings!.slots[slotKey.slice(-1)].used-1);else expect(f.c.spellSettings).toEqual(before.spellSettings);
 expect(f.c.selections).toEqual(before.selections);expect(f.c.notes).toBe(before.notes);expect(f.c.runtime.hp).toBe(before.runtime.hp);
 const after=structuredClone(f.c);expect(perform(f.c,r).status).toBe('duplicate');expect(f.c).toEqual(after);
 const reopened=validateCharacter(JSON.parse(JSON.stringify(f.c)));expect(perform(reopened,r).status).toBe('duplicate');
});
it('after a credit, ordinary spell spending and later pool edits do not invalidate historical receipts on reopen',()=>{
 const f=ready(1),r=request(f.c,f.choiceId,f.entry.id,'credit',use());expect(perform(f.c,r).status).toBe('applied');const history=structuredClone(f.c.runtime.refuelingRing);
 setResource(f.c,'spell-slot:1',1);expect(f.c.spellSettings!.slots['1'].used).toBe(3);const reopened=validateCharacter(JSON.parse(JSON.stringify(f.c)));
 expect(reopened.runtime.refuelingRing).toEqual(history);expect(reopened.runtime.resources['spell-slot:1'].current).toBe(1);expect(perform(reopened,r).status).toBe('duplicate');
 delete reopened.runtime.resources['spell-slot:1'];delete reopened.spellSettings!.slots['1'];expect(validateCharacter(reopened).runtime.refuelingRing).toEqual(history);
});
it('after a pact credit, normal pact spending and reopen retain ring debt and historical receipt',()=>{
 const f=ready(1,5);expect(act(f,use('pact-slot:3')).status).toBe('applied');setResource(f.c,'pact-slot:3',0);expect(validateCharacter(JSON.parse(JSON.stringify(f.c))).runtime.refuelingRing!.last!.slot).toMatchObject({before:0,after:1});expect(offer(f.c,f.choiceId,f.entry.id).current).toBe(0);
});
it('dawn restores only the use and does not require wearing or attunement, nor refill slots',()=>{
 const f=ready(0),pools=structuredClone(f.c.runtime.resources),settings=structuredClone(f.c.spellSettings);const target=f.c.selections.find(row=>row.id==='ring-a')!;target.equipped=false;target.attuned=false;
 expect(offer(f.c,f.choiceId,f.entry.id)).toMatchObject({canUse:false,canDawn:true});expect(act(f,dawn).status).toBe('applied');expect(f.c.runtime.resources).toEqual(pools);expect(f.c.spellSettings).toEqual(settings);unchangedReject(f,request(f.c,f.choiceId,f.entry.id,'full',dawn));
});
it.each(['short','long'] as const)('%s rest never resets the independent ring use',kind=>{const f=ready(0),history=structuredClone(f.c.runtime.refuelingRing);performRest(f.c,{id:'rest',sequence:0,revision:f.c.revision,kind,rolls:[],recover:{}});expect(f.c.runtime.refuelingRing).toEqual(history);});
it.each([undefined,0] as const)('cannot credit any slot when the ring use is %s',initial=>{const f=ready(initial);unchangedReject(f,request(f.c,f.choiceId,f.entry.id,'use',use()));});
it.each([{kind:'use',slotKey:'spell-slot:1',actionConfirmed:false},{kind:'use',slotKey:'spell-slot:1'},{kind:'use',slotKey:'spell-slot:1',actionConfirmed:true,cost:0},{kind:'dawn',dawnConfirmed:false},{kind:'dawn',dawnConfirmed:true,roll:4},{kind:'reaction',slotKey:'spell-slot:1',actionConfirmed:true}])('rejects malformed/cancelled action %#',action=>{const f=ready(1);unchangedReject(f,request(f.c,f.choiceId,f.entry.id,'bad',action as any));});
it.each(['manual','locked','unlimited','fractional','overfull','full','wrong-max','mirror','source-grant','feature-grant','missing-pool','missing-mirror'])('never alters the rejected %s target or consumes the ring',change=>{
 const f=ready(1),pool=f.c.runtime.resources['spell-slot:1'];if(change==='manual')pool.automatic=false;if(change==='locked')pool.locked=true;if(change==='unlimited')pool.unlimited=true;if(change==='fractional')pool.current=.5;if(change==='overfull')pool.current=5;if(change==='full'){pool.current=4;f.c.spellSettings!.slots['1'].used=0;}if(change==='wrong-max')pool.max=9;if(change==='mirror')f.c.spellSettings!.slots['1'].used=1;if(change==='source-grant')pool.sourceSpellGrant={usageKey:'user'};if(change==='feature-grant')pool.featureGrant={ownerId:'artificer',ruleMax:4,recovery:{},origin:'manual'};if(change==='missing-pool')delete f.c.runtime.resources['spell-slot:1'];if(change==='missing-mirror')delete f.c.spellSettings!.slots['1'];
 unchangedReject(f,request(f.c,f.choiceId,f.entry.id,'use',use()));
});
it.each(['revision','card','pool-current','pool-name','pool-max','mirror-used','mirror-max','owner','table','grant','source','target','answers','sequence'])('rejects a stale request after %s changes before any writes',change=>{
 const f=ready(1),r=request(f.c,f.choiceId,f.entry.id,'use',use());
 if(change==='revision')f.c.revision++;if(change==='card')f.c.id='other-card';if(change==='pool-current'){f.c.runtime.resources['spell-slot:1'].current=1;f.c.spellSettings!.slots['1'].used=3;}if(change==='pool-name')f.c.runtime.resources['spell-slot:1'].name='Renamed';if(change==='pool-max')f.c.runtime.resources['spell-slot:1'].max=7;if(change==='mirror-used')f.c.spellSettings!.slots['1'].used=1;if(change==='mirror-max')f.c.spellSettings!.slots['1'].max=5;if(change==='owner')f.c.selections.find(r=>r.id==='artificer')!.level=7;if(change==='table')f.c.selections.find(r=>r.id==='artificer')!.entry.raw.classTableGroups[1].rowsSpellProgression[0][0]=3;if(change==='grant')f.c.selections.find(r=>r.entry.english==='Spellcasting')!.grantKey='manual';if(change==='source')f.c.profile.enabledSources=[];if(change==='target')f.c.selections.find(r=>r.id==='ring-a')!.attuned=false;if(change==='answers')f.c.answers[f.choiceId]=[];if(change==='sequence'){f.c.runtime.refuelingRing!.sequence++;f.c.runtime.refuelingRing!.last!.sequence++;}
 unchangedReject(f,r);
});
it.each(['worn','attuned','disabled','level','missing-infuse','conflict','capacity'])('suspends current use when %s authorization fails without washing history',change=>{
 const f=ready(1),target=f.c.selections.find(r=>r.id==='ring-a')!;if(change==='worn')target.equipped=false;if(change==='attuned')target.attuned=false;if(change==='disabled')f.c.profile.enabledSources=[];if(change==='level')f.c.selections.find(r=>r.id==='artificer')!.level=5;if(change==='missing-infuse')f.c.selections=f.c.selections.filter(r=>r.entry.english!=='Infuse Item');if(change==='conflict')f.c.infusions!.bindings.push({...f.c.infusions!.bindings[0]});if(change==='capacity')for(let i=0;i<3;i++)f.c.infusions!.bindings.push({choiceId:'other'+i,entryId:'other'+i,targetId:'other'+i});
 const before=structuredClone(f.c.runtime.refuelingRing);expect(offer(f.c,f.choiceId,f.entry.id).canUse).toBe(false);unchangedReject(f,request(f.c,f.choiceId,f.entry.id,'use',use()));expect(f.c.runtime.refuelingRing).toEqual(before);
});
it('rejects pact4+ without downcasting even if a stale lower-level pool exists',()=>{const f=ready(1,7);f.c.runtime.resources['pact-slot:3']={automatic:true,current:0,max:2};for(const key of ['pact-slot:4','pact-slot:3'])unchangedReject(f,request(f.c,f.choiceId,f.entry.id,key,use(key)));expect(offer(f.c,f.choiceId,f.entry.id).slots.map(row=>row.key)).toEqual(['spell-slot:1','spell-slot:2']);});
it('A→B→A, forget/relearn, source disabling and renamed snapshot IDs retain physical history',()=>{
 const f=ready(1);expect(act(f,use(),'spend').status).toBe('applied');const initial=structuredClone(f.c.runtime.refuelingRing);
 setInfusionTarget(f.c,f.choiceId,f.entry.id,'ring-b');expect(offer(f.c,f.choiceId,f.entry.id).current).toBeUndefined();expect(act(f,{kind:'initialize',initial:1},'B').status).toBe('applied');setInfusionTarget(f.c,f.choiceId,f.entry.id,'ring-a');expect(offer(f.c,f.choiceId,f.entry.id).current).toBe(0);
 setSheetChoiceSlot(f.c,f.choiceId,0,undefined,f.entries);expect(f.c.infusions!.bindings).toEqual([]);setSheetChoiceSlot(f.c,f.choiceId,0,f.entry.id,f.entries);setInfusionTarget(f.c,f.choiceId,f.entry.id,'ring-a');expect(offer(f.c,f.choiceId,f.entry.id).current).toBe(0);
 f.c.profile.enabledSources=[];expect(offer(f.c,f.choiceId,f.entry.id).canInitialize).toBe(false);f.c.profile.enabledSources=['PHB','TCE'];const key=Object.keys(initial!.records)[0];expect(f.c.runtime.refuelingRing!.records[key]).toEqual(initial!.records[key]);
 setInfusionTarget(f.c,f.choiceId,f.entry.id,null);const alias={...structuredClone(f.entry),id:'new-import'};f.c.classChoiceSnapshots![alias.id]=alias;f.c.answers[f.choiceId]=[alias.id];setInfusionTarget(f.c,f.choiceId,alias.id,'ring-a');expect(offer(f.c,f.choiceId,alias.id)).toMatchObject({key,current:0,canInitialize:false});
});
it.each(['source','name','type','rarity','copy','effect','quantity','bonus','attune'])('rejects noncanonical or magical ring impostor: %s',change=>{
 const f=ready(),target=f.c.selections.find(r=>r.id==='ring-a')!;if(change==='source')target.entry.source='XPHB';if(change==='name')target.entry.english=target.entry.raw.ENG_name='Another Ring';if(change==='type')target.entry.raw.type='RG';if(change==='rarity')target.entry.raw.rarity='common';if(change==='copy')target.entry.raw._copy={};if(change==='effect')target.entry.effects=[{op:'add',target:'ac',value:1}];if(change==='quantity')target.quantity=2;if(change==='bonus')target.entry.raw.bonusAc=0;if(change==='attune')target.entry.raw.reqAttune=true;expect(infusionTargets(f.c,f.entry).map(x=>x.id)).not.toContain('ring-a');unchangedReject(f,request(f.c,f.choiceId,f.entry.id,'init',{kind:'initialize',initial:1}));
});
it('unknown Ring versions survive import untouched and block all actions',()=>{const f=ready();(f.c.runtime as any).refuelingRing={version:2,future:{history:['keep']}};expect(validateCharacter(JSON.parse(JSON.stringify(f.c)))).toEqual(f.c);for(const action of [{kind:'initialize',initial:1} as const,use(),dawn])unchangedReject(f,request(f.c,f.choiceId,f.entry.id,'unknown',action));});
it.each(['record-max','record-owner','record-rule','current','sequence','last','slot-after','mirror','wrong-slot','extra'])('rejects malformed own store and preserves all inputs: %s',change=>{
 const f=ready(1);expect(act(f,use(),'use').status).toBe('applied');const state=f.c.runtime.refuelingRing!,row=state.records[state.last!.key];if(change==='record-max')(row as any).max=4;if(change==='record-owner')row.ownerId='other';if(change==='record-rule')row.ruleRef='Mind Sharpener|TCE';if(change==='current')(row as any).current=2;if(change==='sequence')state.sequence=0;if(change==='last')delete state.last;if(change==='slot-after')state.last!.slot!.after++;if(change==='mirror')state.last!.slot!.mirrorAfter!++;if(change==='wrong-slot')state.last!.slot!.key='pact-slot:1';if(change==='extra')(state as any).unlimited=true;
 expect(()=>validateRefuelingRingState(state)).toThrow();expect(()=>validateCharacter(JSON.parse(JSON.stringify(f.c)))).toThrow();unchangedReject(f,request(f.c,f.choiceId,f.entry.id,'dawn',dawn));
});
it('old request and reused operation ID cannot replay after newer ring action',()=>{
 const f=ready(1),r=request(f.c,f.choiceId,f.entry.id,'use',use());expect(perform(f.c,r).status).toBe('applied');unchangedReject(f,{...r,action:use('spell-slot:2')});expect(act(f,dawn,'dawn').status).toBe('applied');unchangedReject(f,r);
});
