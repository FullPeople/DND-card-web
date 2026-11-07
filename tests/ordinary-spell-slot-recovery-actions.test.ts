import {expect,it as privateSourceIt} from 'vitest';
import {slotBalanceRecoveryFixture} from './helpers/slotBalanceRecoveryFixture';
import {runMulticlassSourceCheck,multiclassSpellEntries} from './helpers/multiclassSlotSources';
import {slotBalanceRecoveryOffer,slotBalanceRecoveryRequest,performSlotBalanceRecovery} from '../src/core/automation/slotBalanceRecovery';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {syncAutoResources} from '../src/core/resources';
import {syncFeatures} from '../src/core/sheet';
import {prepareSpellEntry} from '../src/core/spells';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
let index=0;
function it(name:string,run:()=>unknown){const n=++index;return privateSourceIt(name,()=>runMulticlassSourceCheck(n,run));}
for(const edition of ['2014','2024'] as const)for(const remaining of [0,1,2])it(`${edition} explicit known remaining ${remaining} is recorded once and survives native reopen/source pause without a refill`,()=>{
 const {c,key}=slotBalanceRecoveryFixture(edition),before=structuredClone(c),offer=slotBalanceRecoveryOffer(c,key);
 expect(offer).toMatchObject({max:2,available:true});expect(c).toEqual(before);
 const request=slotBalanceRecoveryRequest(c,key,remaining,'authored-known-remaining');expect(performSlotBalanceRecovery(c,request).status).toBe('applied');
 expect(c.runtime.resources[key]).toMatchObject({max:2,current:remaining,automatic:true});expect(c.spellSettings!.slots['2']).toEqual({max:2,used:2-remaining});
 const applied=structuredClone(c);expect(performSlotBalanceRecovery(c,request).status).toBe('duplicate');expect(c).toEqual(applied);
 expect(performSlotBalanceRecovery(c,{...request,remaining:remaining===0?1:0}).status).toBe('rejected');expect(c).toEqual(applied);
 const restored=readCharacter(exportCharacter(c)).character;syncAutoResources(restored);expect(restored.runtime.resources[key].current).toBe(remaining);
 restored.profile.enabledSources=[];syncAutoResources(restored);restored.profile.enabledSources=[edition==='2014'?'PHB':'XPHB'];syncAutoResources(restored);
 expect(restored.runtime.resources[key].current).toBe(remaining);expect(restored.runtime.resources.manual).toEqual(before.runtime.resources.manual);expect(restored.notes).toBe(before.notes);
});
it('confirmation does not grant a spell; real preparation and a separate ordinary action pay exactly one confirmed slot',()=>{
 const {c,key,owner,entries}=slotBalanceRecoveryFixture(),request=slotBalanceRecoveryRequest(c,key,1,'known-paid-balance');
 expect(performSlotBalanceRecovery(c,request).status).toBe('applied');expect(c.selections.some(s=>s.entry.kind==='spell')).toBe(false);
 const spells=multiclassSpellEntries('2014'),matches=spells.filter(e=>e.kind==='spell'&&e.english==='Cure Wounds'&&e.source==='PHB');expect(matches).toHaveLength(1);syncFeatures(c,[...entries,...spells]);
 const id=prepareSpellEntry(c,matches[0],undefined,owner.id);expect(id).toBeDefined();expect(spellPayments(c,id!).options.some(p=>p.id==='ordinary:'+key&&p.available)).toBe(true);
 expect(performSpellAction(c,spellActionRequest(c,id!,'ordinary:'+key,'separate-paid-cast','cast',owner.id)).status).toBe('applied');expect(c.runtime.resources[key].current).toBe(0);
 const restored=readCharacter(exportCharacter(c)).character;syncAutoResources(restored);expect(restored.runtime.resources[key].current).toBe(0);
});
it('readonly, absent or inherited GM authority never writes; an own live GM can bypass a card lock only while writable',()=>{
 const {c,key}=slotBalanceRecoveryFixture();c.locked=true;const q=slotBalanceRecoveryRequest(c,key,0,'locked-recovery'),before=structuredClone(c);
 for(const authority of [undefined,{gm:false},{gm:true,canEdit:false},Object.create({gm:true}),{gm:'true'},{canEdit:'true'}]){expect(performSlotBalanceRecovery(c,q,authority as any).status).toBe('rejected');expect(c).toEqual(before);}
 expect(performSlotBalanceRecovery(c,q,{gm:true,canEdit:true}).status).toBe('applied');expect(c.runtime.resources[key].current).toBe(0);
});
it('a changed card, source, class level, source snapshot, manual record or pending capacity invalidates an earlier confirmation atomically',()=>{
 for(const mode of ['card','revision','source','level','raw','manual','pending'] as const){const {c,key}=slotBalanceRecoveryFixture(),q=slotBalanceRecoveryRequest(c,key,1,'stale-recovery');
  if(mode==='card')c.id='authored-other-card';if(mode==='revision')c.revision++;if(mode==='source')c.profile.enabledSources=[];if(mode==='level')c.selections[0].level=7;if(mode==='raw')c.selections[0].entry.entries=[];if(mode==='manual')c.runtime.resources.manual.current=1;if(mode==='pending')(c.runtime.slotCapacityReview as any).pending[key].max=3;
  const before=structuredClone(c);expect(performSlotBalanceRecovery(c,q).status).toBe('rejected');expect(c).toEqual(before);
 }
});
it('manual, automatic-only, foreign-owned, locked and mirror-only collisions remain untouched even for GM',()=>{
 for(const kind of ['manual','automatic','foreign','locked','mirror'] as const){const {c,key}=slotBalanceRecoveryFixture();
  if(kind==='mirror')c.spellSettings!.slots['2']={max:2,used:0};else c.runtime.resources[key]={name:'Authored occupied record',max:9,current:2,...(kind==='automatic'?{automatic:true}:{}),...(kind==='locked'?{locked:true}:{}),...(kind==='foreign'?{limitedSourceUseGrant:{key:'authored-other-owner'}}:{})};
  const before=structuredClone(c),offer=slotBalanceRecoveryOffer(c,key,{canEdit:true,gm:true});expect(offer.available).toBe(false);expect(performSlotBalanceRecovery(c,slotBalanceRecoveryRequest(c,key,0,'collision'),{canEdit:true,gm:true}).status).toBe('rejected');expect(c).toEqual(before);
 }
});
it('malformed and accessor requests reject without invoking getters or making a partial write',()=>{
 for(const mutate of [(q:any)=>{q.remaining=-1;},(q:any)=>{q.remaining=3;},(q:any)=>{q.remaining='0';},(q:any)=>{q.resourceId='pact-slot:2';},(q:any)=>{q.gm=true;},(q:any)=>{q.id='';},(q:any)=>{q.basis='bad';},(q:any)=>{Object.defineProperty(q,'remaining',{get(){throw Error('PRIVATE_REQUEST_GETTER');},enumerable:true});}]){
  const {c,key}=slotBalanceRecoveryFixture(),q=slotBalanceRecoveryRequest(c,key,0,'malformed'),before=structuredClone(c);mutate(q);expect(performSlotBalanceRecovery(c,q).status).toBe('rejected');expect(c).toEqual(before);
 }
 const {c,key}=slotBalanceRecoveryFixture();delete c.spellSettings;const before=structuredClone(c);expect(performSlotBalanceRecovery(c,slotBalanceRecoveryRequest(c,key,0,'no-settings')).status).toBe('rejected');expect(c).toEqual(before);
});
it('unknown/duplicate and disabled canonical class contexts never authorize recovery merely from a pending marker',()=>{
 for(const mode of ['unknown','duplicate','disabled','edition'] as const){const {c,key}=slotBalanceRecoveryFixture();if(mode==='unknown')c.selections[1].entry.packId='authored-unreviewed';if(mode==='duplicate')c.selections.push({...structuredClone(c.selections[0]),id:'duplicate-owner'});if(mode==='disabled')c.profile.disabledEntries=[c.selections[0].entry.id];if(mode==='edition')c.edition='2024';
  const before=structuredClone(c);expect(slotBalanceRecoveryOffer(c,key).available).toBe(false);expect(performSlotBalanceRecovery(c,slotBalanceRecoveryRequest(c,key,0,'unproved-source')).status).toBe('rejected');expect(c).toEqual(before);
 }
});
it('an explicit confirmation can recount an occupying ordinary automatic pool while preserving its presentation and other data',()=>{
 const {c,key}=slotBalanceRecoveryFixture();c.runtime.resources[key]={name:'Authored retained automatic label',max:3,current:1,automatic:true,type:'bar',icon:'bottle'};c.spellSettings!.slots['2']={max:3,used:2};
 const before=structuredClone(c),q={...slotBalanceRecoveryRequest(c,key,0,'explicit-existing-recount'),confirmExisting:true};
 expect(performSlotBalanceRecovery(c,q).status).toBe('applied');expect(c.runtime.resources[key]).toEqual({...before.runtime.resources[key],max:2,current:0});expect(c.spellSettings!.slots['2']).toEqual({max:2,used:2});
 const restored=readCharacter(exportCharacter(c)).character;syncAutoResources(restored);expect(restored.runtime.resources[key]).toEqual({...before.runtime.resources[key],max:2,current:0});expect(restored.runtime.resources.manual).toEqual(before.runtime.resources.manual);
});
it('a retained mirror alone needs explicit recount; manual, foreign and locked occupying counters remain protected even with that confirmation',()=>{
 const f=slotBalanceRecoveryFixture();f.c.spellSettings!.slots['2']={max:2,used:1};expect(performSlotBalanceRecovery(f.c,{...slotBalanceRecoveryRequest(f.c,f.key,0,'explicit-mirror-recount'),confirmExisting:true}).status).toBe('applied');expect(f.c.runtime.resources[f.key].current).toBe(0);
 for(const kind of ['manual','foreign','locked'] as const){const {c,key}=slotBalanceRecoveryFixture();c.runtime.resources[key]={name:'Authored protected collision',max:2,current:1,...(kind!=='manual'?{automatic:true}:{}),...(kind==='foreign'?{limitedSourceUseGrant:{key:'authored-foreign'}}:{}),...(kind==='locked'?{locked:true}:{})};const before=structuredClone(c);expect(performSlotBalanceRecovery(c,{...slotBalanceRecoveryRequest(c,key,0,'explicit-protected-recount'),confirmExisting:true},{canEdit:true,gm:true}).status).toBe('rejected');expect(c).toEqual(before);}
});
