import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
import {InfusionControl} from '../src/ui/InfusionControl';
import {returningWeaponFixture} from './e2e/returningWeaponFixture';
import {setInfusionTarget} from '../src/core/automation/infusions';

function setup(){const state=returningWeaponFixture(),edit=vi.fn();return {...state,edit,props:{c:state.c,entry:state.entry,choiceId:state.choiceId,ownerId:'infusion-owner',unavailable:false,writable:true,edit}};}
const button=(html:string,label:string)=>html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0]||'';
it('offers only supported thrown targets and explicitly keeps returning the weapon to hand manual',()=>{
 const {c,props,edit}=setup(),before=JSON.stringify(c),html=renderToStaticMarkup(createElement(InfusionControl,props));
 expect(html).toContain('灌注测试长矛');expect(html).toContain('回力测试飞镖');expect(html).not.toContain('灌注测试长弓');expect(html).not.toContain('灌注测试皮甲');
 expect(html).toContain('目标必须具有明确记录的投掷属性');expect(html).toContain('未记录持手／投出状态');expect(html).toContain('不会自动移动物品或结算回手');expect(button(html,'确认回力武器灌注')).toContain('disabled');expect(edit).not.toHaveBeenCalled();expect(JSON.stringify(c)).toBe(before);
});
it('retains an unequipped target as intent rather than claiming an attack or automatic return',()=>{
 const {c,entry,choiceId,props}=setup();setInfusionTarget(c,choiceId,entry.id,'weapon-2');const html=renderToStaticMarkup(createElement(InfusionControl,props));
 expect(html).toContain('回力测试飞镖（未装备，不生成自动攻击）');expect(html).toContain('回到持用者手中的动作仍需手动处理');expect(button(html,'撤回回力武器灌注')).not.toContain('disabled');
});
it('allows only withdrawal after the source becomes unavailable',()=>{
 const {c,entry,choiceId,props}=setup();setInfusionTarget(c,choiceId,entry.id,'weapon-0');c.profile.enabledSources=['PHB'];const html=renderToStaticMarkup(createElement(InfusionControl,props));
 expect(button(html,'确认回力武器灌注')).toContain('disabled');expect(button(html,'撤回回力武器灌注')).not.toContain('disabled');expect(html).toContain('原灌注记录保留');
});
it('preserves the full record and disallows confirmation and withdrawal while read-only',()=>{
 const {c,entry,choiceId,props}=setup();setInfusionTarget(c,choiceId,entry.id,'weapon-0');props.writable=false;const before=JSON.stringify(c),html=renderToStaticMarkup(createElement(InfusionControl,props));
 expect(button(html,'确认回力武器灌注')).toContain('disabled');expect(button(html,'撤回回力武器灌注')).toContain('disabled');expect(JSON.stringify(c)).toBe(before);
});
