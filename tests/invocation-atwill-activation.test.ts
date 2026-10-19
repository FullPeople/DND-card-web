import {it,expect,vi} from 'vitest';
vi.mock('../src/platform/workbench',()=>({inWorkbench:false,workbenchRequest:vi.fn()}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,chooseSheetOption,syncChoiceContent} from '../src/core/automation/choices';
import {planSourceSpells,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {validateCharacter} from '../src/core/validation';
import evidence from '../src/core/automation/classChoiceEvidence.json';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ClassChoiceRecords} from '../src/ui/ClassChoiceRecords';

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
it('offers only an at-will self cast, preserves slots and rejects a forged slot payment',()=>{
 const {c,entries,invocation,activation}=setup(),choice=activation();expect(choice).toBeDefined();chooseSheetOption(c,choice!.id,invocation.id,entries);syncChoiceContent(c,entries);syncSourceSpells(c,entries);
 const grant=planSourceSpells(c,entries).grants.find(row=>row.config.sourceGrant?.active)!;
 expect(grant.config.sourceGrant).toMatchObject({usage:'free',canUseSlots:false,target:'self'});
 c.runtime.resources['spell-slot:1']={max:2,current:2};c.runtime.resources['pact-slot:1']={max:1,current:1};const resources=JSON.stringify(c.runtime.resources);
 expect(spellPayments(c,grant.id).options.map(row=>row.id)).toEqual(['free']);expect(spellPayments(c,grant.id).options[0].label).toContain('自身');
 expect(performSpellAction(c,spellActionRequest(c,grant.id,'slot:spell-slot:1','bad-slot')).status).toBe('rejected');
 expect(performSpellAction(c,spellActionRequest(c,grant.id,'free','first-cast'))).toMatchObject({status:'applied',receipt:{target:'self'}});expect(performSpellAction(c,spellActionRequest(c,grant.id,'free','second-cast')).status).toBe('applied');expect(JSON.stringify(c.runtime.resources)).toBe(resources);
});
it('removes executable grants when the learned slot changes and restores only on an explicit saved activation',()=>{
 const {c,entries,invocation,activation}=setup(),choice=activation();expect(choice).toBeDefined();chooseSheetOption(c,choice!.id,invocation.id,entries);syncChoiceContent(c,entries);syncSourceSpells(c,entries);
 const id=planSourceSpells(c,entries).grants.find(row=>row.config.sourceGrant?.active)!.id,learned=sheetChoices(c,entries).find(row=>row.sourceProgression==='optional')!;
 setSheetChoiceSlot(c,learned.id,0,undefined,entries);expect(spellPayments(c,id).options).toEqual([]);syncChoiceContent(c,entries);syncSourceSpells(c,entries);expect(c.selections.some(row=>row.id===id)).toBe(false);
 setSheetChoiceSlot(c,learned.id,0,invocation.id,entries);syncChoiceContent(c,entries);syncSourceSpells(c,entries);expect(spellPayments(c,id).options.map(row=>row.id)).toEqual(['free']);
});
it('refuses cross-edition or altered source shapes and never converts a manually added invocation into a free cast',()=>{
 const {c,entries,invocation,activation}=setup(),change=(blocks:unknown)=>{invocation.raw.additionalSpells=blocks;c.classChoiceSnapshots![invocation.id].raw.additionalSpells=structuredClone(blocks);};change([{innate:{_:["Mage Armor|PHB"]}}]);expect(activation()).toBeUndefined();change([{innate:{_:["Mage Armor|XPHB"]},resourceName:'unreviewed'}]);expect(activation()).toBeUndefined();
 change([{innate:{_:["Mage Armor|XPHB"]}}]);c.selections.push({id:'manual-invocation',entry:invocation,quantity:1,level:1,equipped:false});syncSourceSpells(c,entries);expect(planSourceSpells(c,entries).grants.some(row=>row.config.sourceGrant?.usage==='free')).toBe(false);
});
it('suspends a saved activation after a level quota reduction or source disable and restores the retained answer',()=>{
 const {c,entries,invocation,activation}=setup(),learned=sheetChoices(c,entries).find(row=>row.sourceProgression==='optional')!;c.selections[0].level=2;setSheetChoiceSlot(c,learned.id,0,undefined,entries);setSheetChoiceSlot(c,learned.id,2,invocation.id,entries);
 const choice=activation()!;chooseSheetOption(c,choice.id,invocation.id,entries);syncChoiceContent(c,entries);syncSourceSpells(c,entries);const id=planSourceSpells(c,entries).grants.find(row=>row.config.sourceGrant?.active)!.id;
 c.selections[0].level=1;expect(spellPayments(c,id).options).toEqual([]);syncChoiceContent(c,entries);syncSourceSpells(c,entries);expect(c.answers[learned.id][2]).toBe(invocation.id);expect(c.answers[choice.id]).toEqual([invocation.id]);
 c.selections[0].level=2;syncChoiceContent(c,entries);syncSourceSpells(c,entries);expect(spellPayments(c,id).options).toHaveLength(1);
 c.profile.enabledSources=['PHB'];expect(spellPayments(c,id).options).toEqual([]);syncChoiceContent(c,entries);syncSourceSpells(c,entries);c.profile.enabledSources=['XPHB'];syncChoiceContent(c,entries);syncSourceSpells(c,entries);expect(spellPayments(c,id).options).toHaveLength(1);
});
it('rejects corrupt activation answers and a broadened saved target constraint before any cast',()=>{
 const {c,entries,invocation,activation}=setup(),choice=activation()!;c.answers[choice.id]=[invocation.id,invocation.id];syncChoiceContent(c,entries);syncSourceSpells(c,entries);expect(planSourceSpells(c,entries).grants).toEqual([]);
 c.answers[choice.id]=[invocation.id];syncChoiceContent(c,entries);syncSourceSpells(c,entries);const id=planSourceSpells(c,entries).grants.find(row=>row.config.sourceGrant?.active)!.id;delete c.spellSettings!.special![id].sourceGrant!.target;expect(spellPayments(c,id).options).toEqual([]);syncSourceSpells(c,entries);expect(spellPayments(c,id).options).toHaveLength(1);
 (c.spellSettings!.special![id].sourceGrant as any).target='any';expect(()=>validateCharacter(JSON.parse(JSON.stringify(c)))).toThrow();
});
const inputRoot=process.env.DND_AUTOMATION_INPUTS;
it('exposes activation beside the learned record even when no other feature group is visible',()=>{
 const {c,entries,invocation,activation}=setup(),choice=activation()!;const render=()=>renderToStaticMarkup(createElement(ClassChoiceRecords,{c,catalog:entries,mode:'optional'}));
 expect(render()).toContain(`data-choice-id="${choice.id}"`);expect(render()).toContain('启用来源施法');chooseSheetOption(c,choice.id,invocation.id,entries);syncChoiceContent(c,entries);syncSourceSpells(c,entries);expect(render()).toContain('更改来源施法');
});
it.skipIf(!inputRoot)('grants the actual frozen XPHB Mage Armor reference without changing its stored range',()=>{
 const index=JSON.parse(readFileSync(join(inputRoot!,'index.json'),'utf8')),suffixes=['/data/optionalfeatures.json','/data/class/class-warlock.json','/data/spells/spells-xphb.json'];
 const bodies=suffixes.map(suffix=>{const row=index.rows.find((row:any)=>row.url.endsWith(suffix));expect(row).toBeDefined();const body=JSON.parse(readFileSync(join(inputRoot!,row.path),'utf8'));expect(createHash('sha256').update(JSON.stringify(body)).digest('hex')).toBe(row.sha256);if(suffix==='/data/optionalfeatures.json')expect(row.sha256).toBe('031970dfac1770a548549bd30535319c2493c47ebeaedfdb6a601651bbfc3844');return body;});
 const entries=bodies.flatMap(body=>normalizeData(body,'frozen-invocation-source')),c=newCharacter('2024');c.automation=newAutomationState();c.selections=[{id:'actual-warlock',entry:entries.find(row=>row.kind==='class'&&row.source==='XPHB')!,level:1,quantity:1,equipped:false}];
 const invocation=entries.find(row=>row.kind==='feature'&&row.english==='Armor of Shadows'&&row.source==='XPHB')!,learned=sheetChoices(c,entries).find(row=>row.sourceProgression==='optional')!;expect(learned).toBeDefined();setSheetChoiceSlot(c,learned.id,0,invocation.id,entries);
 const choice=sheetChoices(c,entries).find(row=>row.id.includes(':invocation-activation:'))!;expect(choice).toBeDefined();chooseSheetOption(c,choice.id,invocation.id,entries);syncChoiceContent(c,entries);syncSourceSpells(c,entries);
 const grant=planSourceSpells(c,entries).grants.find(row=>row.config.sourceGrant?.active)!;expect(grant.entry.english).toBe('Mage Armor');expect(grant.config.sourceGrant).toMatchObject({usage:'free',target:'self',canUseSlots:false});expect(grant.entry.raw.range).toEqual(entries.find(row=>row.id===grant.entry.id)!.raw.range);expect(spellPayments(validateCharacter(JSON.parse(JSON.stringify(c))),grant.id).options.map(row=>row.id)).toEqual(['free']);
});
