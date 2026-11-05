import {expect,it} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {planSourceSpells,syncSourceSpells,setSourceSpellChoices} from '../src/core/automation/sourceSpells';
import {performSpellAction,spellActionRequest} from '../src/core/automation/actions';
import {specialSpellResource} from '../src/core/specialSpells';
const entry=(name:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id:'authored:'+name,name,english:name,kind,raw,entries:[],source:'PHB',edition:'2014',packId:'authored-boundary',revision:'1'});
function setup(list:unknown[],schedule='will'){
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.runtime.resources.manual={max:7,current:2};c.selections=[{id:'owner',entry:entry('Authored owner','race',{additionalSpells:[{ability:'wis',innate:{'_':{[schedule]:schedule==='daily'?{'1e':list}:list}}}]}),quantity:1,level:1,equipped:false}];return c;
}
const catalog=[entry('Fixed','spell',{level:1,school:'A'}),entry('Other','spell',{level:1,school:'N'})];
it('keeps existing fixed casting-level variants even when the same list has an unfilled filtered choice',()=>{
 const c=setup(['Fixed|PHB#1','Fixed|PHB#2',{choose:'level=1|school=N'}]);const plan=planSourceSpells(c,catalog);expect(plan.grants.map(grant=>grant.config.sourceGrant?.castLevel)).toEqual([1,2]);expect(plan.grants.every(grant=>grant.config.sourceGrant?.active)).toBe(true);
});
it('holds invalid duplicate choice intent without disabling or replenishing an unrelated fixed grant in the list',()=>{
 const c=setup(['Fixed|PHB',{choose:'level=1|school=N'},{choose:'level=1|school=N'}],'daily');syncSourceSpells(c,catalog);const fixed=c.selections.find(row=>row.entry.english==='Fixed')!;expect(fixed).toBeDefined();expect(performSpellAction(c,spellActionRequest(c,fixed.id,'source','authored-fixed-cast')).status).toBe('applied');const key=specialSpellResource(fixed.id,c);expect(c.runtime.resources[key].current).toBe(0);
 const first=JSON.stringify([JSON.stringify(['owner']),'source-spell:0/innate/_/daily/1e/choose:1']),second=JSON.stringify([JSON.stringify(['owner']),'source-spell:0/innate/_/daily/1e/choose:2']);c.automation!.spellChoices={[first]:['Other|PHB'],[second]:['Other|PHB']};const intent=JSON.stringify(c.automation!.spellChoices);syncSourceSpells(c,catalog);
 expect(c.spellSettings!.special![fixed.id].sourceGrant!.active).toBe(true);expect(c.runtime.resources[key].current).toBe(0);expect(c.runtime.resources.manual).toEqual({max:7,current:2});expect(JSON.stringify(c.automation!.spellChoices)).toBe(intent);expect(c.selections.filter(row=>row.entry.english==='Other'&&c.spellSettings?.special?.[row.id]?.sourceGrant?.active)).toEqual([]);
});
it('preserves explicit casting-level alternatives when a separate filtered choice is present',()=>{
 const c=setup([{choose:{from:['Fixed|PHB#1','Fixed|PHB#2'],count:2}},{choose:'level=1|school=N'}]);const choice=planSourceSpells(c,catalog).choices.find(choice=>choice.count===2)!;expect(choice).toBeDefined();setSourceSpellChoices(c,choice.key,['Fixed|PHB#1','Fixed|PHB#2'],catalog);syncSourceSpells(c,catalog);expect(planSourceSpells(c,catalog).grants.map(grant=>grant.config.sourceGrant?.castLevel)).toEqual([1,2]);
});
it('does not let a duplicate filtered intent suppress another valid explicit choice from that list',()=>{
 const third=entry('Third','spell',{level:1,school:'I'}),entries=[...catalog,third],c=setup(['Fixed|PHB',{choose:'level=1|school=N'},{choose:'level=1|school=N'},{choose:{from:['Third|PHB#1','Third|PHB#2'],count:1}}]);
 const key=(node:number)=>JSON.stringify([JSON.stringify(['owner']),`source-spell:0/innate/_/will/choose:${node}`]);c.automation!.spellChoices={[key(1)]:['Other|PHB'],[key(2)]:['Other|PHB'],[key(3)]:['Third|PHB#2']};const grants=planSourceSpells(c,entries).grants;expect(grants.map(grant=>grant.entry.english)).toEqual(['Fixed','Third']);expect(grants[1].config.sourceGrant?.castLevel).toBe(2);
});
it('recognizes native casting and an explicit matching level as the same choice while keeping the fixed grant',()=>{
 const c=setup(['Fixed|PHB#1',{choose:'level=1|school=A'}]);const key=JSON.stringify([JSON.stringify(['owner']),'source-spell:0/innate/_/will/choose:1']);c.automation!.spellChoices={[key]:['Fixed|PHB']};const plan=planSourceSpells(c,catalog);expect(plan.grants.map(grant=>grant.config.sourceGrant?.castLevel)).toEqual([1]);expect(plan.grants[0].config.sourceGrant?.active).toBe(true);
});
