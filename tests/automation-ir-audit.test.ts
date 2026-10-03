import {it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {initializeAutomation} from '../src/core/automation/state';
import {createIdentity} from '../src/data/automation/identity';
import {snapshotRecordErrors} from '../src/data/automation/record-validation';
import {validateCharacter} from '../src/core/validation';
import {planSourceSpells,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {setResource} from '../src/core/resources';
import {specialSpellResource} from '../src/core/spellResourceKeys';
import {evaluate} from '../src/core/engine';
import {spellValues} from '../src/core/characterDetails';
import {irRuntimeGaps} from '../src/core/automation/capabilities';
import {bindAutomationCharacter} from '../src/core/automation/binding';
const spell=(name:string):Entry=>({id:name,kind:'spell',name,english:name,packId:'kiwee',source:'XPHB',edition:'2024',revision:'test',entries:[],raw:{},automationVersion:'test',automation:{identity:createIdentity({kind:'spell',source:'XPHB',engName:name}),edition:'2024',verdict:'automated',provenance:[{layer:'structured',ref:'synthetic-audit'}],mechanics:{spellModel:{level:1}},unsupported:[]}});
it('validates owned quickbar snapshots and strips unbound embedded publisher rules without changing storage',()=>{
 const c=newCharacter();initializeAutomation(c);c.quickbarCopies=[{id:'copy',entry:spell('Snapshot')}];const original=structuredClone(c);expect(bindAutomationCharacter(c,undefined,[]).quickbarCopies![0].entry.automation).toBeUndefined();expect(c).toEqual(original);c.quickbarCopies[0].entry.automation!.identity.key='forged';expect(()=>validateCharacter(c)).toThrow(/IR/);delete c.quickbarCopies[0].entry.automation;c.quickbarCopies[0].entry.manualSpellLevel=99;expect(()=>validateCharacter(c)).toThrow(/环阶/);
});
it('keeps unsupported client targets and stacking groups visible and never applies a grouped modifier independently',()=>{
 const e={...spell('Unsupported target'),kind:'feat' as const};e.automation!.identity=createIdentity({kind:'feat',source:'XPHB',engName:e.english});e.automation!.mechanics={modifiers:[{target:'ac',op:'add',value:99,stackGroup:'exclusive'},{target:'sense:darkvision',op:'set',value:60}]};const c=newCharacter();initializeAutomation(c);c.selections=[{id:'source',entry:e,level:1,quantity:1,equipped:false}];expect(irRuntimeGaps(e)).toEqual(['stack:exclusive','target:sense:darkvision']);expect(evaluate(c).ac).toBe(10);expect(evaluate(c).issues.some(issue=>issue.id==='automation-runtime:source')).toBe(true);expect(evaluate(c).trace['sense:darkvision']).toBeUndefined();
});
it('adds only declared equipped and attuned casting bonuses, ignoring raw and prose bonus claims',()=>{
 const e={...spell('Casting focus'),kind:'item' as const,raw:{bonusSpellAttack:99,bonusSpellSaveDc:99}};e.automation!.identity=createIdentity({kind:'item',source:'XPHB',engName:e.english});e.automation!.mechanics={equipmentModel:{category:'other',requiresAttunement:true,spellAttackBonus:2,spellDcBonus:1}};const c=newCharacter();initializeAutomation(c);c.selections=[{id:'focus',entry:e,level:1,quantity:1,equipped:true}];expect(spellValues(c,evaluate(c))).toEqual({attack:2,dc:10});c.selections[0].attuned=true;expect(spellValues(c,evaluate(c))).toEqual({attack:4,dc:11});c.selections[0].equipped=false;expect(spellValues(c,evaluate(c))).toEqual({attack:2,dc:10});
});
it('permits missing targets in a partial snapshot but still rejects known cross-edition and wrong-kind references',()=>{
 const e=spell('Target'),record={...e.automation!,identity:createIdentity({kind:'feat',source:'PHB',engName:'Source'}),edition:'2014' as const,mechanics:{grants:[{type:'spell',fixed:[e.automation!.identity.key],usage:'free' as const}]}};expect(snapshotRecordErrors(record).map(issue=>issue.code)).toContain('edition-reference');record.mechanics.grants[0].fixed=[createIdentity({kind:'spell',source:'PHB',engName:'Missing'}).key];expect(snapshotRecordErrors(record)).toEqual([]);record.mechanics.grants[0].fixed=[createIdentity({kind:'item',source:'PHB',engName:'Missing'}).key];expect(snapshotRecordErrors(record).map(issue=>issue.code)).toContain('reference-kind');
});
it('preserves overflow consumption when separate source uses become shared at a lowered maximum',()=>{
 const spells=['First','Second'].map(spell),owner:Entry={...spell('Source'),kind:'feat',automation:{...spell('Source').automation!,identity:createIdentity({kind:'feat',source:'XPHB',engName:'Source'}),mechanics:{grants:spells.map((spell,i)=>({type:'spell',key:`source-spell:audit/${i}`,fixed:[spell.automation!.identity.key],usage:'uses',ambiguous:true,usagePool:'pool',uses:{max:{formula:'@class.level'},recovery:[{period:'long',amount:'all'}]}}))}}};const c=newCharacter();initializeAutomation(c);c.selections=[{id:'owner',entry:owner,level:3,quantity:1,equipped:false}];const mode=planSourceSpells(c,spells).choices.find(choice=>choice.usageModes)!.key;c.automation!.spellUsageModes={[mode]:'each'};syncSourceSpells(c,spells);for(const grant of planSourceSpells(c,spells).grants)setResource(c,specialSpellResource(grant.id,c),0);syncSourceSpells(c,spells);c.selections[0].level=1;syncSourceSpells(c,spells);c.automation!.spellUsageModes[mode]='shared';syncSourceSpells(c,spells);c.selections[0].level=3;syncSourceSpells(c,spells);const restored=validateCharacter(JSON.parse(JSON.stringify(c))),grant=planSourceSpells(restored,spells).grants[0];expect(restored.runtime.resources[specialSpellResource(grant.id,restored)]).toMatchObject({max:3,current:0});expect(restored.runtime.sourceSpellSpent![grant.config.sourceGrant!.usageKey!]).toBe(6);
});
