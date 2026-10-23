import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
import {InfusionControl} from '../src/ui/InfusionControl';
import {enhancedWeaponFixture} from './e2e/enhancedWeaponFixture';
import {setInfusionTarget} from '../src/core/automation/infusions';

function setup(){const state=enhancedWeaponFixture(),edit=vi.fn();return {...state,edit,props:{c:state.c,entry:state.entry,choiceId:state.choiceId,ownerId:'infusion-owner',unavailable:false,writable:true,edit}};}
const button=(html:string,label:string)=>html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0]||'';
it('offers only weapon targets and discloses manual-formula and magical-interaction boundaries',()=>{
 const {c,props,edit}=setup(),before=JSON.stringify(c),html=renderToStaticMarkup(createElement(InfusionControl,props));
 expect(html).toContain('灌注测试长矛');expect(html).toContain('灌注测试长弓');expect(html).not.toContain('灌注测试皮甲');expect(html).not.toContain('灌注测试盾牌');
 expect(html).toContain('手写公式、无伤害武器及法器类兼用武器仍手动处理');expect(html).toContain('抵抗、免疫');expect(button(html,'确认增强武器灌注')).toContain('disabled');expect(edit).not.toHaveBeenCalled();expect(JSON.stringify(c)).toBe(before);
});
it('does not label an unequipped weapon as an AC modifier',()=>{
 const {c,entry,choiceId,props}=setup();setInfusionTarget(c,choiceId,entry.id,'weapon-1');
 const html=renderToStaticMarkup(createElement(InfusionControl,props));expect(html).toContain('未装备，不生成自动攻击');expect(html).not.toContain('不计 AC');expect(button(html,'撤回增强武器灌注')).not.toContain('disabled');
});
it('keeps restricted bindings withdrawable but never presents confirmation as available',()=>{
 const {c,entry,choiceId,props}=setup();setInfusionTarget(c,choiceId,entry.id,'weapon-0');c.profile.enabledSources=['PHB'];
 const html=renderToStaticMarkup(createElement(InfusionControl,props));expect(html).toContain('原灌注记录保留');expect(button(html,'确认增强武器灌注')).toContain('disabled');expect(button(html,'撤回增强武器灌注')).not.toContain('disabled');
});
it('blocks both writes in read-only while retaining the target and boundary',()=>{
 const {c,entry,choiceId,props}=setup();setInfusionTarget(c,choiceId,entry.id,'weapon-0');props.writable=false;const before=JSON.stringify(c);
 const html=renderToStaticMarkup(createElement(InfusionControl,props));expect(button(html,'确认增强武器灌注')).toContain('disabled');expect(button(html,'撤回增强武器灌注')).toContain('disabled');expect(html).toContain('魔法武器交互仍需手动核对');expect(JSON.stringify(c)).toBe(before);
});
