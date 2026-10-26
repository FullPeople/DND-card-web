import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
vi.mock('../src/ui/Reference',()=>({Reference:({children}:any)=>createElement('span',null,children)}));
import {normalizeData} from '../src/data/catalog';
import {syncFeatures} from '../src/core/sheet';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {setReviewedFeatIntent} from '../src/core/automation/reviewedFeats';
import {ClassChoiceRecords} from '../src/ui/ClassChoiceRecords';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {reviewedArmorFeatData,reviewedArmorFeatFixture} from './e2e/reviewedArmorFeatFixture';

function setup(english='Lightly Armored',manualArmor?:string){
 const c=reviewedArmorFeatFixture(),catalog=normalizeData(reviewedArmorFeatData,'reviewed-armor-ui');if(manualArmor!==undefined)c.training!.armor=manualArmor;syncFeatures(c,catalog);
 const choice=sheetChoices(c,catalog).find(row=>row.id.includes(':class-legacy-feat:')&&row.grantLevel===4)!,entry=catalog.find(row=>row.english===english)!;
 setSheetChoiceSlot(c,choice.id,0,entry.id,catalog);const edit=vi.fn((fn:(draft:typeof c)=>void)=>fn(c));return {c,catalog,choice,entry,edit};
}
function render(state:ReturnType<typeof setup>,readOnly=false){return renderToStaticMarkup(createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:!readOnly,open:()=>{},close:()=>{}}},createElement(ClassChoiceRecords,{...state,mode:'feat'})));}
const button=(html:string,name:string)=>html.match(new RegExp(`<button[^>]*>${name}</button>`))?.[0]||'';

it('shows explicit Lightly Armored consent and exactly STR/DEX, without granting anything on render',()=>{
 const s=setup(),before=JSON.stringify(s.c),html=render(s);expect(html).toContain('尚未确认轻甲运用');expect(html).toContain('轻甲运用提升属性');expect(html).toContain('上限 20');expect(html).toContain('轻甲训练');expect(html).toContain('基础属性不改写');expect(html.match(/<option value="(?:str|dex)"/g)).toHaveLength(2);expect(html).not.toMatch(/<option value="(?:con|int|wis|cha)"/);expect(button(html,'确认轻甲运用')).toContain('disabled');expect(JSON.stringify(s.c)).toBe(before);expect(s.edit).not.toHaveBeenCalled();
});
it.each([['Moderately Armored','中甲运用','light','轻甲训练','中甲、盾牌训练'],['Heavily Armored','重甲运用','medium','中甲训练','重甲训练']])('shows %s exact prerequisite, effect and unsupported automation boundary',(english,name,training,required,gain)=>{
 const s=setup(english,training),html=render(s);expect(html).toContain(`尚未确认${name}`);expect(html).toContain(required);expect(html).toContain(gain);expect(html).toContain('施法限制、检定劣势和重甲力量／速度限制仍需人工核对');expect(html).toContain('2014 盾牌训练本身不额外增加 AC');if(english==='Heavily Armored'){expect(html).toContain('固定提升力量 +1');expect(html).not.toContain('<select');}expect(button(html,`确认${name}`)).toContain('disabled');
});
it.each(['','盾牌、手工保留记录'])('keeps a literal manual training override visible, including %j',manual=>{
 const s=setup('Lightly Armored',manual);setReviewedFeatIntent(s.c,s.choice.id,s.entry.id,{kind:'lightly-armored',ability:'dex',confirmedManualAbilityExcluded:true});const before=JSON.stringify(s.c),html=render(s);
 expect(html).toContain('轻甲运用已生效');expect(html).toContain('已保存：敏捷 +1；轻甲训练');expect(html).toContain('当前护甲训练由手工记录覆盖');if(manual==='')expect(html).toContain('（空记录）');expect(html).toContain('不自动追加轻甲训练');expect(s.c.training!.armor).toBe(manual);expect(JSON.stringify(s.c)).toBe(before);
});
it('displays lost prerequisites as preserved, cleanup-only intent and respects owner readonly',()=>{
 const s=setup('Moderately Armored','light');setReviewedFeatIntent(s.c,s.choice.id,s.entry.id,{kind:'moderately-armored',ability:'dex',confirmedManualAbilityExcluded:true});s.c.training!.armor='';const before=JSON.stringify(s.c),html=render(s);
 expect(html).toContain('中甲运用记录已保留，当前不生效');expect(html).toContain('前提');expect(button(html,'确认中甲运用')).toContain('disabled');expect(button(html,'撤回中甲运用')).not.toContain('disabled');expect(button(render(s,true),'撤回中甲运用')).toContain('disabled');expect(JSON.stringify(s.c)).toBe(before);
});
it.each([20,22])('explains a suspended armor ability at manual base %i without lowering it',base=>{
 const s=setup();setReviewedFeatIntent(s.c,s.choice.id,s.entry.id,{kind:'lightly-armored',ability:'dex',confirmedManualAbilityExcluded:true});s.c.abilities.dex=base;const before=JSON.stringify(s.c),html=render(s);expect(html).toContain('轻甲运用记录已保留，当前不生效');expect(html).toContain('上限 20');expect(html).toContain('不会降低已有属性');expect(button(html,'撤回轻甲运用')).not.toContain('disabled');expect(JSON.stringify(s.c)).toBe(before);
});
it('source disable preserves one visible record, while replacement removes consent and future stores stay immutable',()=>{
 const s=setup();setReviewedFeatIntent(s.c,s.choice.id,s.entry.id,{kind:'lightly-armored',ability:'dex',confirmedManualAbilityExcluded:true});s.c.profile.enabledSources=[];
 const restricted=render(s);expect(restricted.match(/data-reviewed-feat-entry=/g)).toHaveLength(1);expect(restricted).toContain('轻甲运用记录已保留，当前不生效');expect(button(restricted,'确认轻甲运用')).toContain('disabled');expect(button(restricted,'撤回轻甲运用')).not.toContain('disabled');
 s.c.profile.enabledSources=['PHB'];setSheetChoiceSlot(s.c,s.choice.id,0,s.catalog.find(row=>row.english==='Authored Armor Replacement')!.id,s.catalog);expect(s.c.reviewedFeats!.bindings).toEqual([]);expect(render(s)).not.toContain('data-reviewed-feat-entry');
 (s.c as any).reviewedFeats={version:2,future:{preserve:true}};const before=JSON.stringify(s.c),html=render(s);expect(html).toContain('记录版本尚未支持');expect(html).not.toContain('确认轻甲运用');expect(JSON.stringify(s.c)).toBe(before);
});
it('readonly blocks both initial armor consent and its explicit checkbox',()=>{
 const html=render(setup(),true);expect(html).toContain('当前角色卡只读');expect(button(html,'确认轻甲运用')).toContain('disabled');expect(html).toMatch(/<input[^>]*aria-label="确认轻甲运用未计入手工基础属性"[^>]*disabled/);
});
