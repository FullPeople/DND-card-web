import {expect,it} from 'vitest';
import {newCharacter,type Entry,type Raw} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {planSourceSpells,setSourceSpellChoices,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {performSpellAction,spellActionRequest} from '../src/core/automation/actions';
import {specialSpellResource} from '../src/core/specialSpells';
import {readCharacter} from '../src/core/validation';

const entry=(kind:Entry['kind'],name:string,source:string,raw:Raw={}):Entry=>({id:`authored-class-plan:${kind}:${source}:${name}`,kind,name,english:name,source,edition:'2014',packId:'authored-class-plan',revision:'1',entries:[],raw});
const wizard=()=>entry('class','Wizard','PHB');
const baseSpell=()=>entry('spell','Authored base spell','PHB',{level:0,school:'A',classes:{fromClassList:[{name:'Wizard',source:'PHB'}]}});
function setup(filter='level=0|class=Wizard'){
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB','TCE','LLMC'];
 c.selections=[{id:'source-owner',quantity:1,level:3,equipped:false,entry:entry('feat','Authored class-filter source','PHB',{additionalSpells:[{ability:'wis',innate:{'_':{daily:{'1e':[{choose:filter,count:1}]}}}}]})}];
 c.runtime.resources.manual={max:9,current:2};return c;
}
it('integrates the full catalog class context into actual source choices without selecting or mutating for the player',()=>{
 const c=setup(),catalog=[wizard(),baseSpell()],before=JSON.stringify(c),inputs=JSON.stringify(catalog),plan=planSourceSpells(c,catalog),choice=plan.choices.find(row=>row.spells)!;
 expect(choice?.spells).toEqual(['Authored base spell|PHB']);expect(plan.grants).toEqual([]);expect(JSON.stringify(c)).toBe(before);expect(JSON.stringify(catalog)).toBe(inputs);
 setSourceSpellChoices(c,choice.key,['Authored base spell|PHB'],catalog);syncSourceSpells(c,catalog);expect(planSourceSpells(c,catalog).grants).toHaveLength(1);
});
it('preserves spent grants and saved intent through an independent class-source disable and reopen',()=>{
 const c=setup('level=0|class=Authored caster (LLMag)'),owner=entry('class','Authored caster','LLMC',{classSpells:['Authored base spell|PHB']}),catalog=[owner,baseSpell()],choice=planSourceSpells(c,catalog).choices.find(row=>row.spells)!;
 expect(choice?.spells).toEqual(['Authored base spell|PHB']);setSourceSpellChoices(c,choice.key,['Authored base spell|PHB'],catalog);syncSourceSpells(c,catalog);
 const row=c.selections.find(row=>row.entry.kind==='spell')!,resource=specialSpellResource(row.id,c),cast=performSpellAction(c,spellActionRequest(c,row.id,'source','authored-class-filter-cast'));expect(cast.status,JSON.stringify(cast)).toBe('applied');expect(c.runtime.resources[resource].current).toBe(0);
 c.profile.enabledSources=['PHB','TCE'];syncSourceSpells(c,catalog);expect(c.automation!.spellChoices![choice.key]).toEqual(['Authored base spell|PHB']);expect(c.spellSettings!.special![row.id].sourceGrant!.active).toBe(false);
 const reopened=readCharacter(JSON.parse(JSON.stringify(c))).character;reopened.profile.enabledSources.push('LLMC');syncSourceSpells(reopened,catalog);syncSourceSpells(reopened,catalog);
 expect(reopened.spellSettings!.special![row.id].sourceGrant!.active).toBe(true);expect(reopened.runtime.resources[resource].current).toBe(0);expect(reopened.runtime.resources.manual).toEqual({max:9,current:2});
});
it('shows incomplete optional membership in the actual plan without dropping verified base choices',()=>{
 const c=setup(),optional=entry('spell','Authored optional spell','PHB',{level:0,classes:{fromClassListVariant:[{name:'Wizard',source:'PHB',definedInSource:'TCE'}]}}),plan=planSourceSpells(c,[wizard(),baseSpell(),optional]);
 expect(plan.choices.find(row=>row.spells)?.spells).toEqual(['Authored base spell|PHB']);expect(plan.issues.some(issue=>issue.message.includes('可选职业法表'))).toBe(true);expect(plan.grants).toEqual([]);
});
it('uses a saved class snapshot before a refreshed catalog copy with the same identity',()=>{
 const c=setup(),owner=wizard();owner.raw.classSpells=['Authored base spell|PHB'];
 c.selections.push({id:'class-owner',quantity:1,level:3,equipped:false,entry:owner});
 const refresh={...owner,revision:'2',raw:{classSpells:['Authored replacement spell|PHB']}},other=entry('spell','Authored replacement spell','PHB',{level:0});
 const before=JSON.stringify(c),plan=planSourceSpells(c,[refresh,{...baseSpell(),raw:{level:0}},other]);
 expect(plan.choices.find(row=>row.spells)?.spells).toEqual(['Authored base spell|PHB']);expect(JSON.stringify(c)).toBe(before);expect(c.selections.find(row=>row.id==='class-owner')!.entry.revision).toBe('1');
});
it('reopens and casts from the saved query context without a live catalog or a newly selected class',()=>{
 const c=setup(),catalog=[wizard(),baseSpell()],choice=planSourceSpells(c,catalog).choices.find(row=>row.spells)!;
 setSourceSpellChoices(c,choice.key,['Authored base spell|PHB'],catalog);syncSourceSpells(c,catalog);
 const reopened=readCharacter(JSON.parse(JSON.stringify(c))).character,before=JSON.stringify(reopened);
 expect(reopened.selections.some(row=>row.entry.kind==='class')).toBe(false);expect(planSourceSpells(reopened).grants).toHaveLength(1);expect(JSON.stringify(reopened)).toBe(before);
 const row=reopened.selections.find(row=>row.entry.kind==='spell')!,readonly=spellActionRequest(reopened,row.id,'source','authored-readonly-class-cast'),readonlyBefore=JSON.stringify(reopened);
 expect(performSpellAction(reopened,readonly,{canEdit:false}).status).toBe('rejected');expect(JSON.stringify(reopened)).toBe(readonlyBefore);
 expect(performSpellAction(reopened,spellActionRequest(reopened,row.id,'source','authored-offline-class-cast')).status).toBe('applied');
 expect(reopened.runtime.resources[specialSpellResource(row.id,reopened)].current).toBe(0);expect(reopened.runtime.resources.manual).toEqual({max:9,current:2});
});
it('preserves an unfamiliar saved-context version without executing it or overwriting its intent',()=>{
 const c=setup(),catalog=[wizard(),baseSpell()],choice=planSourceSpells(c,catalog).choices.find(row=>row.spells)!;
 setSourceSpellChoices(c,choice.key,['Authored base spell|PHB'],catalog);syncSourceSpells(c,catalog);
 const raw={...JSON.parse(JSON.stringify(c)),sourceSpellChoiceContexts:{version:2,futureIntent:{retained:true}}},reopened=readCharacter(raw).character,before=JSON.stringify(reopened);
 expect(planSourceSpells(reopened,catalog).grants).toEqual([]);expect(()=>setSourceSpellChoices(reopened,choice.key,['Authored base spell|PHB'],catalog)).toThrow();expect(JSON.stringify(reopened)).toBe(before);
 syncSourceSpells(reopened,catalog);expect(reopened.sourceSpellChoiceContexts).toEqual(raw.sourceSpellChoiceContexts);expect(reopened.automation!.spellChoices![choice.key]).toEqual(['Authored base spell|PHB']);
});
it('rejects a modified saved context before importing or replacing existing character data',()=>{
 const c=setup(),catalog=[wizard(),baseSpell()],choice=planSourceSpells(c,catalog).choices.find(row=>row.spells)!;
 setSourceSpellChoices(c,choice.key,['Authored base spell|PHB'],catalog);const before=JSON.stringify(c),bad=JSON.parse(before);
 expect(bad.sourceSpellChoiceContexts).toBeDefined();bad.sourceSpellChoiceContexts.records[choice.key].entries[0].raw.classSpells=['Authored injected spell|PHB'];const badBefore=JSON.stringify(bad);
 expect(()=>readCharacter(bad)).toThrow();expect(JSON.stringify(c)).toBe(before);expect(JSON.stringify(bad)).toBe(badBefore);
});
it('holds a changed source owner until explicit reconfirmation without refilling a spent grant',()=>{
 const c=setup(),catalog=[wizard(),baseSpell()],choice=planSourceSpells(c,catalog).choices.find(row=>row.spells)!;
 setSourceSpellChoices(c,choice.key,['Authored base spell|PHB'],catalog);syncSourceSpells(c,catalog);const row=c.selections.find(row=>row.entry.kind==='spell')!,resource=specialSpellResource(row.id,c);c.runtime.resources[resource].current=0;
 c.selections[0].entry.revision='2';const before=JSON.stringify(c.sourceSpellChoiceContexts),plan=planSourceSpells(c,catalog);expect(plan.grants).toEqual([]);expect(plan.choices.find(row=>row.spells)?.spells).toEqual(['Authored base spell|PHB']);expect(JSON.stringify(c.sourceSpellChoiceContexts)).toBe(before);
 setSourceSpellChoices(c,choice.key,['Authored base spell|PHB'],catalog);syncSourceSpells(c,catalog);expect(planSourceSpells(c).grants).toHaveLength(1);expect(c.runtime.resources[resource].current).toBe(0);expect(c.runtime.resources.manual).toEqual({max:9,current:2});
});
it('rejects an invalid catalog snapshot before changing either saved references or their context',()=>{
 const c=setup(),invalid={...wizard(),entries:'invalid authored snapshot' as unknown as Entry['entries']},catalog=[invalid,baseSpell()],choice=planSourceSpells(c,catalog).choices.find(row=>row.spells)!;
 expect(choice?.spells).toEqual(['Authored base spell|PHB']);const before=JSON.stringify(c);
 expect(()=>setSourceSpellChoices(c,choice.key,['Authored base spell|PHB'],catalog)).toThrow();expect(JSON.stringify(c)).toBe(before);
});
it('saves only reachable class-copy definitions and keeps them usable without selecting their classes',()=>{
 const c=setup('level=0|class=Authored caster (LLMag)'),root=entry('class','Authored caster','LLMC',{classSpells:[{className:'Wizard',classSource:'PHB'}]}),unused=entry('class','Authored unrelated caster','PHB'),catalog=[root,wizard(),unused,baseSpell()],choice=planSourceSpells(c,catalog).choices.find(row=>row.spells)!;
 setSourceSpellChoices(c,choice.key,['Authored base spell|PHB'],catalog);syncSourceSpells(c,catalog);const context=c.sourceSpellChoiceContexts!.records![choice.key];
 expect(new Set(context.entries.map(row=>row.id))).toEqual(new Set([root.id,wizard().id]));expect(c.selections.some(row=>row.entry.kind==='class')).toBe(false);
 const reopened=readCharacter(JSON.parse(JSON.stringify(c))).character,row=reopened.selections.find(row=>row.entry.kind==='spell')!;
 expect(performSpellAction(reopened,spellActionRequest(reopened,row.id,'source','authored-copied-class-cast')).status).toBe('applied');
});
it('saves an explicitly referenced spell group without copying unrelated catalog data',()=>{
 const c=setup('level=0|class=Authored caster (LLMag)'),root=entry('class','Authored caster','LLMC',{classSpells:[{groupName:'Authored group',groupSource:'LLMC'}]}),group=entry('rule','Authored group','LLMC',{source:'LLMC',_category:'spellList',spells:['Authored base spell|PHB']}),unused=entry('rule','Authored other group','LLMC',{source:'LLMC',_category:'spellList',spells:[]}),catalog=[root,group,unused,baseSpell()],choice=planSourceSpells(c,catalog).choices.find(row=>row.spells)!;
 setSourceSpellChoices(c,choice.key,['Authored base spell|PHB'],catalog);syncSourceSpells(c,catalog);
 expect(new Set(c.sourceSpellChoiceContexts!.records![choice.key].entries.map(row=>row.id))).toEqual(new Set([root.id,group.id]));
 const reopened=readCharacter(JSON.parse(JSON.stringify(c))).character,row=reopened.selections.find(row=>row.entry.kind==='spell')!;
 expect(performSpellAction(reopened,spellActionRequest(reopened,row.id,'source','authored-group-class-cast')).status).toBe('applied');
});
