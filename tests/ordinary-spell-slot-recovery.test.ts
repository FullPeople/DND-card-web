import {expect,it as privateSourceIt} from 'vitest';
import {multiclassSlotEntries,runMulticlassSourceCheck} from './helpers/multiclassSlotSources';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {syncAutoResources,setResource} from '../src/core/resources';
import {readCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
import {spellState} from '../src/core/characterDetails';
import {ordinarySpellFixture} from './helpers/ordinarySpellCastingFixture';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {spellActionAuthorityReason} from '../src/core/automation/spellActionAuthority';
import {slotBalanceRecoveryFixture} from './helpers/slotBalanceRecoveryFixture';
import {slotBalanceRecoveryRequest,performSlotBalanceRecovery} from '../src/core/automation/slotBalanceRecovery';

let index=0;
function it(name:string,run:()=>unknown){const i=++index;return privateSourceIt(name,()=>runMulticlassSourceCheck(i,run));}
const entries=multiclassSlotEntries();
function entry(kind:Entry['kind'],name:string){const rows=entries.filter(e=>e.kind===kind&&e.source==='PHB'&&e.english===name&&(kind!=='subclass'||(e.raw.classSource||'PHB')==='PHB'));if(rows.length!==1)throw Error('Unique exact source required');return structuredClone(rows[0]);}
function card(mainName='Paladin',subclass?:string):Character{
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.profile.optional.multiclass=true;c.notes='Authored legacy unknown-balance sentinel';
 c.selections=[{id:'recovery-main',entry:entry('class',mainName),level:subclass?7:5,quantity:1,equipped:false},{id:'recovery-companion',entry:entry('class',mainName==='Fighter'?'Rogue':'Fighter'),level:1,quantity:1,equipped:false}];
 if(subclass)c.selections.push({id:'recovery-subclass',entry:entry('subclass',subclass),parentId:'recovery-main',level:7,quantity:1,equipped:false});
 c.runtime.resources.manual={name:'Authored retained balance',max:9,current:2,locked:true};return c;
}
function legacyShape(c:Character){
 // Actual old sync produced this shape after an exhausted second-level pool
 // was removed on adding a noncaster. Its missing balance is unknowable here.
 c.runtime.resources['spell-slot:1']={name:'Authored existing automatic pool',max:3,current:1,automatic:true};
 c.spellSettings=structuredClone(spellState(c));c.spellSettings.slots={'1':{max:3,used:2}};return c;
}
for(const [main,sub] of [['Paladin',undefined],['Ranger',undefined],['Fighter','Eldritch Knight'],['Rogue','Arcane Trickster']] as const)it(`an existing ${sub||main} legacy multiclass card never turns an absent spent balance into full second-level slots`,()=>{
 const c=readCharacter(exportCharacter(legacyShape(card(main,sub)))).character,manual=structuredClone(c.runtime.resources.manual),notes=c.notes;
 syncAutoResources(c);
 expect(c.runtime.resources['spell-slot:1']).toMatchObject({max:4,current:2});
 expect(c.runtime.resources['spell-slot:2']).toBeUndefined();expect(c.spellSettings!.slots['2']).toBeUndefined();
 expect((c.runtime as any).slotCapacityReview?.pending?.['spell-slot:2']).toMatchObject({max:2});
 const first=structuredClone(c);syncAutoResources(c);expect(c).toEqual(first);
 const reopened=readCharacter(exportCharacter(c)).character;syncAutoResources(reopened);
 expect(reopened.runtime.resources['spell-slot:2']).toBeUndefined();expect(reopened.spellSettings!.slots['2']).toBeUndefined();
 expect((reopened.runtime as any).slotCapacityReview).toEqual((first.runtime as any).slotCapacityReview);
 expect(reopened.runtime.resources.manual).toEqual(manual);expect(reopened.notes).toBe(notes);
});
it('a fresh class-only card still initializes genuine first-time slots normally',()=>{
 const c=card();syncAutoResources(c);expect(c.runtime.resources['spell-slot:2']).toMatchObject({max:2,current:2});expect((c.runtime as any).slotCapacityReview?.pending?.['spell-slot:2']).toBeUndefined();
});
it('an explicit known previous level distinguishes a real new unlock from an old missing balance',()=>{
 const before=card();before.selections[0].level=4;syncAutoResources(before);const c=structuredClone(before);c.selections[0].level=5;syncAutoResources(c,before);
 expect(c.runtime.resources['spell-slot:2']).toMatchObject({max:2,current:2});expect((c.runtime as any).slotCapacityReview?.pending?.['spell-slot:2']).toBeUndefined();
});
it('a retained explicit used mirror remains evidence of zero remaining, rather than being replaced or marked unknown',()=>{
 const c=legacyShape(card());c.spellSettings!.slots['2']={max:2,used:2};syncAutoResources(c);
 expect(c.runtime.resources['spell-slot:2']).toMatchObject({max:2,current:0});expect(c.spellSettings!.slots['2']).toEqual({max:2,used:2});
 expect((c.runtime as any).slotCapacityReview?.pending?.['spell-slot:2']).toBeUndefined();
});
it('a future balance-review version survives native reopen and holds ordinary payment, generic setters and cleanup even for GM',()=>{
 const {c,row}=ordinarySpellFixture();c.runtime.slotCapacityReview={version:2,authoredOpaque:{future:true}};
 const before=structuredClone(c),request=spellActionRequest(c,row.id,'ordinary:spell-slot:1','future-review-held');
 expect(spellPayments(c,row.id,{canEdit:true,gm:true}).options.some(p=>p.id.startsWith('ordinary:spell-slot:'))).toBe(false);
 expect(performSpellAction(c,request,{canEdit:true,gm:true}).status).toBe('rejected');expect(c).toEqual(before);
 expect(spellActionAuthorityReason(c,{canEdit:true,gm:true},['spell-slot:1'])).toBeDefined();expect(()=>setResource(c,'spell-slot:1',0)).toThrow();expect(c).toEqual(before);
 const reopened=readCharacter(exportCharacter(c)).character,previous=structuredClone(reopened);reopened.selections=[];syncAutoResources(reopened,previous);
 expect(reopened.runtime.slotCapacityReview).toEqual(before.runtime.slotCapacityReview);
 for(const id of ['spell-slot:1','spell-slot:2'])expect(reopened.runtime.resources[id]).toEqual(before.runtime.resources[id]);
 expect(reopened.spellSettings!.slots).toEqual(before.spellSettings!.slots);expect(reopened.runtime.resources.manual).toEqual(before.runtime.resources.manual);
});
it('a pending balance cannot be laundered by inserting an otherwise coherent automatic counter or by passing GM',()=>{
 const {c,row}=ordinarySpellFixture(),state=c.runtime.slotCapacityReview;
 expect(state?.version).toBe(1);(state as any).pending['spell-slot:2']={max:2};
 const before=structuredClone(c),restored=readCharacter(exportCharacter(c)).character;
 expect(spellPayments(restored,row.id,{canEdit:true,gm:true}).options.some(p=>p.id==='ordinary:spell-slot:2')).toBe(false);
 const request=spellActionRequest(restored,row.id,'ordinary:spell-slot:2','pending-counter-held');expect(performSpellAction(restored,request,{canEdit:true,gm:true}).status).toBe('rejected');expect(restored).toEqual(before);
 expect(spellActionAuthorityReason(restored,{canEdit:true,gm:true},['spell-slot:2'])).toBeDefined();expect(()=>setResource(restored,'spell-slot:2',0)).toThrow();syncAutoResources(restored);expect(restored).toEqual(before);
});
it('a known spent balance remains known through rank withdrawal, native reopening and re-adding the exact class level',()=>{
 const {c,key}=slotBalanceRecoveryFixture();expect(performSlotBalanceRecovery(c,slotBalanceRecoveryRequest(c,key,0,'known-before-withdrawal')).status).toBe('applied');
 const before=structuredClone(c);c.selections[0].level=4;syncAutoResources(c,before);expect(c.runtime.resources[key]).toBeUndefined();
 const restored=readCharacter(exportCharacter(c)).character,lower=structuredClone(restored);restored.selections[0].level=5;syncAutoResources(restored,lower);
 expect(restored.runtime.resources[key]).toMatchObject({max:2,current:0});expect((restored.runtime.slotCapacityReview as any).pending[key]).toBeUndefined();
});
it('temporarily reducing a capacity below prior spent uses never forgets that history on repeated sync or native reopen',()=>{
 const {c,key}=slotBalanceRecoveryFixture();expect(performSlotBalanceRecovery(c,slotBalanceRecoveryRequest(c,key,0,'known-capacity-clamp')).status).toBe('applied');
 let before=structuredClone(c);c.selections[0].level=7;syncAutoResources(c,before);setResource(c,key,0);expect(c.runtime.resources[key]).toMatchObject({max:3,current:0});
 before=structuredClone(c);c.selections[0].level=5;syncAutoResources(c,before);syncAutoResources(c);syncAutoResources(c);expect(c.runtime.resources[key]).toMatchObject({max:2,current:0});
 const restored=readCharacter(exportCharacter(c)).character,lower=structuredClone(restored);restored.selections[0].level=7;syncAutoResources(restored,lower);
 expect(restored.runtime.resources[key]).toMatchObject({max:3,current:0});
});
it('an opaque future automatic balance record never adopts or prevents an unrelated explicitly manual slot-shaped counter',()=>{
 const {c}=slotBalanceRecoveryFixture();c.runtime.slotCapacityReview={version:2,authoredOpaque:true};c.runtime.resources['spell-slot:9']={name:'Authored manual counter',max:3,current:1};const state=structuredClone(c.runtime.slotCapacityReview);
 setResource(c,'spell-slot:9',2);expect(c.runtime.resources['spell-slot:9']).toEqual({name:'Authored manual counter',max:3,current:2});expect(c.runtime.slotCapacityReview).toEqual(state);
});
