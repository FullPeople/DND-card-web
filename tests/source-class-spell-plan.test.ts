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
