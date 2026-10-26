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
import {reviewedPassiveFeatData,reviewedPassiveFeatFixture} from './e2e/reviewedPassiveFeatFixture';

function setup(english='Tough'){
 const c=reviewedPassiveFeatFixture(),catalog=normalizeData(reviewedPassiveFeatData,'reviewed-passive-ui');syncFeatures(c,catalog);
 const choice=sheetChoices(c,catalog).find(row=>row.id.includes(':class-legacy-feat:'))!,entry=catalog.find(row=>row.english===english)!;
 setSheetChoiceSlot(c,choice.id,0,entry.id,catalog);
 const edit=vi.fn((fn:(draft:typeof c)=>void)=>fn(c));return {c,catalog,choice,entry,edit};
}
function render(state:ReturnType<typeof setup>,readOnly=false){return renderToStaticMarkup(createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:!readOnly,open:()=>{},close:()=>{}}},createElement(ClassChoiceRecords,{...state,mode:'feat'})));}
const button=(html:string,name:string)=>html.match(new RegExp(`<button[^>]*>${name}</button>`))?.[0]||'';

it('offers explicit Tough consent after an actual legacy class alternative, never changing HP on render',()=>{
 const state=setup(),before=JSON.stringify(state.c),html=render(state);
 expect(html).toContain('尚未确认健壮');expect(html).toContain('基础生命值或额外调整');expect(html).toContain('所有职业总等级');expect(html).toContain('不恢复当前生命值');expect(html).toContain('旧版客户端可能只保留本记录、不应用效果');expect(html).toContain('请先撤回，再核对并重新确认');
 expect(button(html,'确认健壮')).toContain('disabled');expect(html.match(/data-reviewed-feat-entry=/g)).toHaveLength(1);expect(state.c.selections.some(row=>row.entry.kind==='feat')).toBe(false);expect(JSON.stringify(state.c)).toBe(before);expect(state.edit).not.toHaveBeenCalled();
});
it('offers one Resilient ability and makes the same-save, cap and manual override rules explicit',()=>{
 const state=setup('Resilient'),before=JSON.stringify(state.c),html=render(state);
 expect(html).toContain('尚未确认强健');expect(html).toContain('强健提升属性');expect(html).toContain('同一属性');expect(html).toContain('上限 20');expect(html).toContain('重复获得熟练不会叠加');expect(html).toContain('手工取消');expect(button(html,'确认强健')).toContain('disabled');expect(JSON.stringify(state.c)).toBe(before);expect(state.edit).not.toHaveBeenCalled();
});
it('does not offer passive automation for an unreviewed alternative',()=>{const html=render(setup('Authored Replacement Record'));expect(html).not.toContain('data-reviewed-feat-entry');expect(html).not.toContain('确认健壮');expect(html).not.toContain('确认强健');});
it('uses live readonly context for both the confirmation and its explicit checkbox',()=>{const html=render(setup(),true);expect(html).toContain('当前角色卡只读');expect(button(html,'确认健壮')).toContain('disabled');expect(html).toMatch(/<input[^>]*aria-label="确认健壮未计入手工生命值"[^>]*disabled/);});
it('keeps a restricted saved Tough record visible and cleanup-only without duplicating the active slot',()=>{
 const state=setup();setReviewedFeatIntent(state.c,state.choice.id,state.entry.id,{kind:'tough',confirmedManualHpExcluded:true});state.c.profile.enabledSources=[];
 const before=JSON.stringify(state.c),html=render(state);expect(html.match(/data-reviewed-feat-entry=/g)).toHaveLength(1);expect(html).toContain('健壮记录已保留，当前不生效');expect(button(html,'确认健壮')).toContain('disabled');expect(button(html,'撤回健壮')).not.toContain('disabled');expect(JSON.stringify(state.c)).toBe(before);
 const readonly=render(state,true);expect(button(readonly,'撤回健壮')).toContain('disabled');
});
it('explicit replacement clears consent, while an imported stale binding still has exactly one cleanup-only control',()=>{
 const state=setup();setReviewedFeatIntent(state.c,state.choice.id,state.entry.id,{kind:'tough',confirmedManualHpExcluded:true});const retained=structuredClone(state.c.reviewedFeats);setSheetChoiceSlot(state.c,state.choice.id,0,state.catalog.find(row=>row.english==='Authored Replacement Record')!.id,state.catalog);
 expect(state.c.reviewedFeats?.bindings).toEqual([]);expect(render(state)).not.toContain('已保留被动专长记录');state.c.reviewedFeats=retained;
 const before=JSON.stringify(state.c),html=render(state);expect(html).toContain('已保留被动专长记录');expect(html.match(/data-reviewed-feat-entry=/g)).toHaveLength(1);expect(html).toContain('健壮记录已保留，当前不生效');expect(button(html,'确认健壮')).toContain('disabled');expect(button(html,'撤回健壮')).not.toContain('disabled');expect(JSON.stringify(state.c)).toBe(before);
});
it('missing source snapshots retain a clearly labeled cleanup-only control and honor readonly',()=>{
 const state=setup();setReviewedFeatIntent(state.c,state.choice.id,state.entry.id,{kind:'tough',confirmedManualHpExcluded:true});state.c.selections=[];state.c.classChoiceSnapshots={};state.catalog=[];
 const before=JSON.stringify(state.c),html=render(state);expect(html).toContain('原被动专长资料未载入或声明不再匹配');expect(html).not.toContain('确认健壮');expect(button(html,'撤回被动专长记录')).not.toContain('disabled');expect(button(render(state,true),'撤回被动专长记录')).toContain('disabled');expect(JSON.stringify(state.c)).toBe(before);
});
it('shows the exact saved Resilient ability and the false manual-save override without clearing it',()=>{
 const state=setup('Resilient');setReviewedFeatIntent(state.c,state.choice.id,state.entry.id,{kind:'resilient',ability:'wis',confirmedManualAbilityExcluded:true});const before=JSON.stringify(state.c),html=render(state);
 expect(html).toContain('强健已生效');expect(html).toContain('已保存：感知 +1；感知豁免熟练');expect(html).toContain('当前感知豁免已手工取消熟练');expect(button(html,'撤回强健')).not.toContain('disabled');expect(JSON.stringify(state.c)).toBe(before);
});
it.each([20,22])('preserves and explains a saved Resilient choice whose manual base became %i',base=>{
 const state=setup('Resilient');setReviewedFeatIntent(state.c,state.choice.id,state.entry.id,{kind:'resilient',ability:'dex',confirmedManualAbilityExcluded:true});state.c.abilities.dex=base;const before=JSON.stringify(state.c),html=render(state);
 expect(html).toContain('强健记录已保留，当前不生效');expect(html).toContain('上限 20');expect(html).toContain('已保存：敏捷 +1');expect(html).toContain('不会降低已有属性');expect(button(html,'撤回强健')).not.toContain('disabled');expect(JSON.stringify(state.c)).toBe(before);
});
it('keeps unknown future state visible and immutable even with no live class choices',()=>{
 const state=setup();(state.c as any).reviewedFeats={version:2,unknown:{keep:true}};state.c.selections=[];const before=JSON.stringify(state.c),html=render(state);expect(html).toContain('记录版本尚未支持');expect(html).not.toContain('<button');expect(JSON.stringify(state.c)).toBe(before);
});
it('explains a same-identity manual ambiguity instead of silently granting or overwriting it',()=>{
 const state=setup();state.c.selections.push({id:'manual-tough',entry:state.entry,level:1,quantity:1,equipped:false});const before=JSON.stringify(state.c),html=render(state);expect(html).toContain('归属不明确');expect(button(html,'确认健壮')).toContain('disabled');expect(JSON.stringify(state.c)).toBe(before);
});
