import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,chooseSheetOption,syncChoiceContent} from '../src/core/automation/choices';
import {planSourceSpells,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {validateCharacter} from '../src/core/validation';
import evidence from '../src/core/automation/classChoiceEvidence.json';

// Authored metadata; names identify reviewed public rule/spell identities only.
function setup(){
 const progression=evidence.optionalProgressions.find(row=>row.owner==='Warlock|XPHB')!.progression;
 const entries=normalizeData({class:[{name:'Warlock',source:'XPHB',optionalfeatureProgression:[{name:'Learned Invocations',featureType:['EI'],progression}]}],optionalfeature:[{name:'Armor of Shadows',source:'XPHB',featureType:['EI'],additionalSpells:[{innate:{_:['Mage Armor|XPHB']}}],entries:[]}],spell:[{name:'Mage Armor',source:'XPHB',level:1,entries:[]}]},'authored-invocation-activation');
 const c=newCharacter('2024');c.automation=newAutomationState();c.notes='Keep this manual note';
 c.selections=[{id:'owner',entry:entries.find(entry=>entry.kind==='class')!,level:1,quantity:1,equipped:false}];
 const invocation=entries.find(entry=>entry.kind==='feature')!,spell=entries.find(entry=>entry.kind==='spell')!,learned=sheetChoices(c,entries).find(choice=>choice.sourceProgression==='optional')!;
 setSheetChoiceSlot(c,learned.id,0,invocation.id,entries);syncChoiceContent(c,entries);
 const activation=()=>sheetChoices(c,entries).find(choice=>choice.options.some(option=>option.grant?.id===invocation.id));
 return {c,entries,invocation,spell,activation};
}
it('keeps a learned invocation inert and offers a separate explicit activation for its reviewed spell grant',()=>{
 const {c,entries,invocation,spell,activation}=setup();
 expect(planSourceSpells(c,entries).grants).toEqual([]);expect(c.selections.some(row=>row.entry.id===invocation.id)).toBe(false);
 const choice=activation();expect(choice,'learned Armor of Shadows needs an explicit executable grant choice').toBeDefined();
 const option=choice!.options.find(option=>option.grant?.id===invocation.id)!;chooseSheetOption(c,choice!.id,option.value,entries);syncChoiceContent(c,entries);syncSourceSpells(c,entries);
 expect(planSourceSpells(c,entries).grants.some(grant=>grant.eligible&&grant.entry.id===spell.id)).toBe(true);
});
it('saves and reopens activation, then revokes its automatic spell without removing an existing manual spell',()=>{
 const {c,entries,invocation,spell,activation}=setup(),manual={id:'manual-spell',entry:spell,level:1,quantity:1,equipped:false};c.selections.push(manual);const manualBytes=JSON.stringify(manual);
 const choice=activation();expect(choice).toBeDefined();const option=choice!.options.find(option=>option.grant?.id===invocation.id)!;
 chooseSheetOption(c,choice!.id,option.value,entries);syncChoiceContent(c,entries);syncSourceSpells(c,entries);
 const reopened=validateCharacter(JSON.parse(JSON.stringify(c)));syncChoiceContent(reopened,[]);syncSourceSpells(reopened,[]);
 expect(planSourceSpells(reopened,entries).grants.some(grant=>grant.eligible&&grant.entry.id===spell.id)).toBe(true);
 chooseSheetOption(reopened,choice!.id,option.value,entries);syncChoiceContent(reopened,entries);syncSourceSpells(reopened,entries);
 expect(planSourceSpells(reopened,entries).grants.filter(grant=>grant.eligible&&grant.entry.id===spell.id)).toEqual([]);
 expect(JSON.stringify(reopened.selections.find(row=>row.id===manual.id))).toBe(manualBytes);expect(reopened.notes).toBe('Keep this manual note');
});
