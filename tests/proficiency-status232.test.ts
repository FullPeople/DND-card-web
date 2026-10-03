import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {ProficiencyStatus} from '../src/ui/ProficiencyStatus';
import {evaluate} from '../src/core/engine';
import {newCharacter,type Entry} from '../src/core/model';
import {validateCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';

const render=(proficient:boolean,expertise=false,editing=true,kind:'skill'|'save'='skill')=>renderToStaticMarkup(createElement(ProficiencyStatus,{name:kind==='save'?'力量豁免':'察觉',proficient,expertise,editing,kind}));
describe('skill and saving-throw proficiency presentation',()=>{
 it.each([[false,false,'无熟练',''],[true,false,'熟练','trained'],[true,true,'专精','expert']] as const)('keeps one visible disabled marker for proficient=%s expertise=%s',(proficient,expertise,label,shape)=>{
  const html=render(proficient,expertise);
  expect(html.match(/type="checkbox"/g)).toHaveLength(1);expect(html).toContain('disabled=""');expect(html).toContain(`aria-label="察觉熟练状态：${label}"`);expect(html).toContain('aria-describedby=');expect(html).toContain('由规则和已选能力计算');expect(html).toContain(`class="proficiency-indicator ${shape}"`);expect(html.includes('checked=""')).toBe(proficient||expertise);
  const normal=render(proficient,expertise,false);expect(normal).not.toContain('<input');expect(normal).toContain(`aria-label="察觉${label}"`);expect(normal).toContain(`class="proficiency-mark ${shape}"`);
 });
 it('only opens manual choices when editing and both callbacks are available',()=>{
  const props={name:'察觉',proficient:true,expertise:false,editing:true,manualProficient:false,onProficiencyChange:()=>{},onExpertiseChange:()=>{}};
  const html=renderToStaticMarkup(createElement(ProficiencyStatus,props));expect(html.match(/type="checkbox"/g)).toHaveLength(2);expect(html).not.toContain('disabled');expect(html).not.toContain('checked=""');expect(html).toContain('察觉手动熟练');expect(html).toContain('察觉专精');expect(html).toContain('当前生效：熟练');expect(html).toContain('来源授予仍生效');
  expect(renderToStaticMarkup(createElement(ProficiencyStatus,{...props,editing:false}))).not.toContain('<input');
  const expert=renderToStaticMarkup(createElement(ProficiencyStatus,{...props,expertise:true}));expect(expert.match(/checked=""/g)).toHaveLength(2);
 });
 it.each([false,true])('renders a disabled saving throw status without erasing proficient=%s',proficient=>{
  const html=render(proficient,false,true,'save');expect(html).toContain('disabled=""');expect(html.includes('checked=""')).toBe(proficient);expect(html).toContain('豁免熟练由规则和已选能力自动计算');expect(html).not.toContain('expert');
 });
 it('follows source grant/revoke without mutating overrides, adjustments, resources or backups',()=>{
  const c=newCharacter();const entry:Entry={id:'status-grant',name:'原创熟练授予',english:'Authored Grant',kind:'class',edition:'2024',source:'XPHB',packId:'fixture',revision:'1',raw:{proficiency:['str'],startingProficiencies:{skills:[{perception:true}]}},entries:['原创的软件验收资料。']};
  c.selections=[{id:'grant',entry,level:1,quantity:1,equipped:false}];c.expertise={stealth:true};c.proficiencies={arcana:true,'save:con':true};c.skillBonuses={perception:3,stealth:-2};c.runtime.resources={focus:{name:'专注',current:1,max:4}};
  const before=structuredClone(c),derived=evaluate(c);expect(derived.skills.perception).toMatchObject({proficient:true,value:5});expect(derived.saves.str.proficient).toBe(true);expect(render(derived.skills.perception.proficient)).toContain('checked=""');expect(c).toEqual(before);
  c.profile.disabledEntries=[entry.id];const revoked=evaluate(c);expect(revoked.skills.perception).toMatchObject({proficient:false,value:3});expect(revoked.saves.str.proficient).toBe(false);expect(render(revoked.skills.perception.proficient)).not.toContain('checked=""');expect(revoked.skills.stealth.expertise).toBe(true);expect(revoked.saves.con.proficient).toBe(true);
  c.skillBonuses.perception=-3;const restored=validateCharacter(exportCharacter(c));expect(evaluate(restored).skills.perception.value).toBe(-3);expect(restored.proficiencies).toEqual(before.proficiencies);expect(restored.expertise).toEqual(before.expertise);expect(restored.runtime).toEqual(before.runtime);delete restored.profile.disabledEntries;expect(evaluate(restored).skills.perception.value).toBe(-1);expect(evaluate(restored).saves.str.proficient).toBe(true);
 });
});
