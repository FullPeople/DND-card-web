import {it,expect,vi} from 'vitest';
vi.mock('../src/platform/workbench',()=>({inWorkbench:false,workbenchRequest:vi.fn()}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4',useSheetCaptureActive:()=>false}));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {InfusionControl} from '../src/ui/InfusionControl';
import {SpellsPage} from '../src/ui/SpellsPage';
import {traceForInput} from '../src/ui/ValueTrace';
import {evaluate} from '../src/core/engine';
import {arcaneFocusFixture} from './e2e/arcaneFocusFixture';
import {setInfusionTarget,setInfusionHeld} from '../src/core/automation/infusions';

function setup(){const state=arcaneFocusFixture(),edit=vi.fn();return {...state,edit,props:{c:state.c,entry:state.entry,choiceId:state.choiceId,ownerId:'infusion-owner',unavailable:false,writable:true,edit}};}
const button=(html:string,label:string)=>html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0]||'';
const holding=(html:string)=>html.match(/<input[^>]*aria-label="确认当前持握此法器"[^>]*>/)?.[0]||'';
it('offers only reviewed focus identities and makes half-cover and hand/attunement limits explicitly manual',()=>{
 const {c,props,edit}=setup(),before=JSON.stringify(c),html=renderToStaticMarkup(createElement(InfusionControl,props));expect(html).toContain('法器测试权杖');expect(html).toContain('法器测试法杖');expect(html).toContain('法器测试魔杖');expect(html).not.toContain('法器测试水晶');expect(html).toContain('半身掩护仍需手动');expect(html).toContain('手部占用与同调总数仍需手动核对');expect(holding(html)).toBe('');expect(edit).not.toHaveBeenCalled();expect(JSON.stringify(c)).toBe(before);
});
it('offers an unchecked separate holding confirmation only after binding',()=>{
 const {c,entry,choiceId,props}=setup();setInfusionTarget(c,choiceId,entry.id,'focus-0');const html=renderToStaticMarkup(createElement(InfusionControl,props));expect(holding(html)).not.toContain('checked');expect(holding(html)).not.toContain('disabled');expect(html).toContain('未确认当前持握，法术攻击加值未生效');expect(html).not.toContain('不计 AC');
});
it.each(['equipped','attuned'] as const)('blocks new holding when %s is absent without claiming a spell bonus',key=>{
 const {c,entry,choiceId,props}=setup();setInfusionTarget(c,choiceId,entry.id,'focus-0');c.selections.find(row=>row.id==='focus-0')![key]=false;const html=renderToStaticMarkup(createElement(InfusionControl,props));expect(holding(html)).toContain('disabled');expect(html).toContain(`${key==='equipped'?'未装备':'未同调'}，法术攻击加值未生效`);expect(button(html,'撤回增强奥术法器灌注')).not.toContain('disabled');
});
it('permits clearing held intent and withdrawal while a source is disabled but cannot grant a new held confirmation',()=>{
 const {c,entry,choiceId,props}=setup();setInfusionTarget(c,choiceId,entry.id,'focus-0');setInfusionHeld(c,choiceId,entry.id,true);c.profile.enabledSources=['PHB'];let html=renderToStaticMarkup(createElement(InfusionControl,props));expect(holding(html)).toContain('checked');expect(holding(html)).not.toContain('disabled');expect(button(html,'撤回增强奥术法器灌注')).not.toContain('disabled');expect(html).toContain('原灌注记录保留');setInfusionHeld(c,choiceId,entry.id,false);html=renderToStaticMarkup(createElement(InfusionControl,props));expect(holding(html)).toContain('disabled');
});
it('protects holding, confirmation and withdrawal on a readonly sheet',()=>{
 const {c,entry,choiceId,props,edit}=setup();setInfusionTarget(c,choiceId,entry.id,'focus-0');setInfusionHeld(c,choiceId,entry.id,true);props.writable=false;const before=JSON.stringify(c),html=renderToStaticMarkup(createElement(InfusionControl,props));expect(holding(html)).toContain('disabled');expect(button(html,'撤回增强奥术法器灌注')).toContain('disabled');expect(button(html,'确认增强奥术法器灌注')).toContain('disabled');expect(edit).not.toHaveBeenCalled();expect(JSON.stringify(c)).toBe(before);
});
it('shows the same focus bonus for multiple casting classes without adding it to their DC',()=>{
 const {c,entry,choiceId}=setup();const owner=c.selections.find(row=>row.id==='infusion-owner')!;c.selections.push({...structuredClone(owner),id:'caster-wis',level:1,entry:{...structuredClone(owner.entry),id:'caster-wis-entry',name:'原创感知施法者',english:'Authored Wisdom Caster',source:'PHB',raw:{spellcastingAbility:'wis',casterProgression:'full'}}});setInfusionTarget(c,choiceId,entry.id,'focus-0');setInfusionHeld(c,choiceId,entry.id,true);const before=JSON.stringify(c),html=renderToStaticMarkup(createElement(SpellsPage,{c,d:evaluate(c),edit:()=>{},browse:()=>{},inspect:()=>{},onLink:()=>{},add:()=>{}}));expect(html).toContain('<td>智力</td><td>+8</td><td>16</td>');expect(html).toContain('<td>感知</td><td>+7</td><td>15</td>');expect(JSON.stringify(c)).toBe(before);
});
it('includes focus provenance only in the spell attack value trace and preserves the manual adjustment',()=>{
 const {c,entry,choiceId}=setup();setInfusionTarget(c,choiceId,entry.id,'focus-0');setInfusionHeld(c,choiceId,entry.id,true);const context={c,d:evaluate(c),open:()=>{}},attack=traceForInput(context,'法术攻击调整值',2,()=>{})!,dc=traceForInput(context,'法术DC调整值',3,()=>{})!;expect(attack).toMatchObject({value:2,result:8});expect(attack.rows.join(' ')).toContain('注法 +1');expect(attack.rows).toContain('手动调整 2');expect(dc).toMatchObject({value:3,result:16});expect(dc.rows.join(' ')).not.toContain('注法');
});
