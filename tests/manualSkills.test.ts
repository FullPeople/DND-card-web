import {describe,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {newCharacter,type Entry} from '../src/core/model';
import {setManualSkillExpertise,setManualSkillProficiency} from '../src/core/manualSkills';
import {setAutomationEnabled} from '../src/core/automation/state';
import {syncFeatures} from '../src/core/sheet';
import {syncChoiceContent} from '../src/core/automation/choices';
import {exportCharacter} from '../src/core/export';
import {validateCharacter} from '../src/core/validation';

const source:Entry={id:'manual-skill-source',name:'原创技能来源',english:'Original skill source',kind:'background',edition:'2024',source:'XPHB',packId:'fixture',revision:'1',entries:[],raw:{skillProficiencies:[{perception:true}]}};
function fixture(){const c=newCharacter();c.selections=[{id:'source',entry:source,level:1,quantity:1,equipped:false}];c.runtime.resources={spent:{name:'已用资源',current:1,max:4}};return c;}
describe('manual skills supplement source grants',()=>{
 it('never suppresses source proficiency, including historical false flags',()=>{
  const c=fixture();c.proficiencies={perception:false};expect(evaluate(c).skills.perception).toMatchObject({proficient:true,value:2,sources:['原创技能来源 · XPHB']});
  setManualSkillProficiency(c,'perception',true);expect(evaluate(c).skills.perception.sources).toEqual(['原创技能来源 · XPHB','手动记录']);
  setManualSkillProficiency(c,'perception',false);expect(evaluate(c).skills.perception.proficient).toBe(true);
  c.profile.disabledEntries=[source.id];expect(evaluate(c).skills.perception.proficient).toBe(false);
  setManualSkillProficiency(c,'perception',true);expect(evaluate(c).skills.perception.proficient).toBe(true);
  delete c.profile.disabledEntries;expect(evaluate(c).skills.perception.sources).toHaveLength(2);
 });
 it('expertise implies proficiency; removing expertise retains manual proficiency; clearing proficiency removes manual expertise',()=>{
  const c=fixture();setManualSkillExpertise(c,'stealth',true);expect(c.proficiencies?.stealth).toBe(true);expect(evaluate(c).skills.stealth).toMatchObject({proficient:true,expertise:true,value:4});
  setManualSkillExpertise(c,'stealth',false);expect(evaluate(c).skills.stealth).toMatchObject({proficient:true,expertise:false,value:2});
  setManualSkillExpertise(c,'perception',true);setManualSkillProficiency(c,'perception',false);expect(evaluate(c).skills.perception).toMatchObject({proficient:true,expertise:false,value:2});
  setManualSkillProficiency(c,'stealth',false);expect(evaluate(c).skills.stealth).toMatchObject({proficient:false,expertise:false,value:0});
 });
 it('retains both records through recompute, automation off/on and native save/reload without refilling resources',()=>{
  const c=fixture();setManualSkillExpertise(c,'perception',true);setManualSkillProficiency(c,'arcana',true);const before=structuredClone(c);
  for(const enabled of [true,false,true]){setAutomationEnabled(c,enabled);syncFeatures(c,[]);syncChoiceContent(c,[]);const restored=validateCharacter(exportCharacter(c));expect(restored.proficiencies).toEqual(before.proficiencies);expect(restored.expertise).toEqual(before.expertise);expect(restored.runtime).toEqual(before.runtime);expect(evaluate(restored).skills.perception).toMatchObject({proficient:true,expertise:true,value:4});expect(evaluate(restored).skills.arcana.value).toBe(2);}
 });
 it('only accepts skills and does not modify saving throws',()=>{const c=fixture(),before=structuredClone(c);for(const key of ['save:str','unknown','__proto__']){setManualSkillExpertise(c,key,true);setManualSkillProficiency(c,key,true);}expect(c).toEqual(before);});
});
