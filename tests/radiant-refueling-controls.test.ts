import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
import {InfusionControl} from '../src/ui/InfusionControl';
import {radiantRefuelingFixture} from './fixtures/radiantRefuelingFixture';
vi.mock('../src/ui/Reference',()=>({Reference:({children}:any)=>createElement('span',null,children)}));
const render=(english:string)=>{const state=radiantRefuelingFixture(english),before=JSON.stringify(state.c),edit=vi.fn(),html=renderToStaticMarkup(createElement(InfusionControl,{...state,ownerId:'artificer',unavailable:false,writable:true,edit}));expect(JSON.stringify(state.c)).toBe(before);expect(edit).not.toHaveBeenCalled();return html;};
it('Radiant Weapon exposes real binding and explicit charge controls without granting a balance',()=>{
 const html=render('Radiant Weapon');expect(html).toContain('光耀武器灌注目标');expect(html).toContain('记录光耀武器初始充能');expect(html).toContain('尚未记录当前充能');expect(html).toContain('豁免');expect(html).toContain('致盲');expect(html).not.toContain('无额外豁免');expect(html).not.toContain('确认当前持握此盾牌');
});
it('Spell-Refueling Ring exposes independent explicit daily use controls rather than charges or AC',()=>{
 const html=render('Spell-Refueling Ring');expect(html).toContain('法力恢复戒指灌注目标');expect(html).toContain('记录法力恢复戒指初始使用资格');expect(html).toContain('恢复一个法术位');expect(html).not.toContain('实际 d4');expect(html).not.toContain('不计 AC');expect(html).not.toContain('当前充能：');
});

import {setInfusionTarget,setInfusionHeld} from '../src/core/automation/infusions';
import {infusionChargeActionRequest,performInfusionChargeAction} from '../src/core/automation/infusionCharges';
import {syncAutoResources,setResource} from '../src/core/resources';
import {refuelingRingActionRequest,performRefuelingRingAction,type RefuelingRingReceipt} from '../src/core/automation/refuelingRing';
import {RefuelingRingFeedback} from '../src/ui/RefuelingRingControl';
import {FeedbackContext} from '../src/ui/InteractionFeedback';
const button=(html:string,label:string)=>html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0]||'';
function bound(english='Spell-Refueling Ring'){
 const state=radiantRefuelingFixture(english);setInfusionTarget(state.c,state.choiceId,state.entry.id,english==='Radiant Weapon'?'sword-a':'ring-a');syncAutoResources(state.c);const props={...state,ownerId:'artificer',unavailable:false,writable:true,edit:vi.fn()};return {...state,props};
}
function rendered(props:ReturnType<typeof bound>['props']){return renderToStaticMarkup(createElement(InfusionControl,props));}
it('Radiant weapon remains +1-active without held confirmation while its reaction requires holding',()=>{
 const {c,entry,choiceId,props}=bound('Radiant Weapon');performInfusionChargeAction(c,infusionChargeActionRequest(c,choiceId,entry.id,'ui-initialize',{kind:'initialize',initial:2}));let html=rendered(props);expect(button(html,'使用光耀武器反应充能')).toContain('disabled');expect(html).toContain('确认当前持握此武器');expect(html).toContain('当前已生效');expect(html).not.toContain('当前暂停生效');setInfusionHeld(c,choiceId,entry.id,true);html=rendered(props);expect(button(html,'使用光耀武器反应充能')).not.toContain('disabled');
});
it.each([0,1] as const)('Ring renders the explicitly recorded %s use and never offers reinitialization',initial=>{
 const {c,entry,choiceId,props}=bound();performRefuelingRingAction(c,refuelingRingActionRequest(c,choiceId,entry.id,'ui-ring-initialize',{kind:'initialize',initial}));const before=JSON.stringify(c),html=rendered(props);expect(html).toContain(initial?'当前使用资格：可用 · 1 / 1':'当前使用资格：已用 · 0 / 1');expect(html).not.toContain('记录法力恢复戒指初始使用资格');expect(button(html,'恢复法力恢复戒指黎明使用资格').includes('disabled')).toBe(initial===1);expect(JSON.stringify(c)).toBe(before);
});
it.each(['equipped','attuned','readonly','full','locked','manual'] as const)('Ring use fails closed for %s and rendering never repairs its pools',kind=>{
 const {c,entry,choiceId,props}=bound();performRefuelingRingAction(c,refuelingRingActionRequest(c,choiceId,entry.id,'ui-ring-initialize',{kind:'initialize',initial:1}));setResource(c,'spell-slot:1',3);if(kind==='equipped'||kind==='attuned')c.selections.find(row=>row.id==='ring-a')![kind]=false;else if(kind==='readonly')props.writable=false;else if(kind==='full')setResource(c,'spell-slot:1',4);else if(kind==='locked')c.runtime.resources['spell-slot:1'].locked=true;else delete c.runtime.resources['spell-slot:1'].automatic;const before=JSON.stringify(c),html=rendered(props);expect(button(html,'使用法力恢复戒指恢复法术位')).toContain('disabled');expect(JSON.stringify(c)).toBe(before);
});
it('Ring uses neither a charge namespace nor held-weapon or shield labels',()=>{
 const {props}=bound(),html=rendered(props);expect(html).toContain('穿戴并同调');expect(html).not.toContain('infusion-charge-control');expect(html).not.toContain('确认当前持握');expect(html).not.toContain('未装备，不计 AC');
});
it.each(['pending','unconfirmed','rejected'] as const)('Ring %s never borrows the previous save label as success',phase=>{
 const html=renderToStaticMarkup(createElement(FeedbackContext.Provider,{value:{scope:'card',saveLabel:'已保存到本机',announce:vi.fn()}},createElement(RefuelingRingFeedback,{action:{id:'r',scope:'card',phase}})));expect(html).not.toContain('已保存到本机');expect(html).not.toContain('已反映到当前卡');
});
it.each(['正在保存…','保存失败','待核对 · 本地修改已保留','已保存到本机'])('Ring observed receipt keeps application and actual %s separate',saveLabel=>{
 const receipt={id:'r',before:1,after:0,slot:{key:'spell-slot:1',kind:'ordinary',level:1,before:3,after:4}} as RefuelingRingReceipt;const html=renderToStaticMarkup(createElement(FeedbackContext.Provider,{value:{scope:'card',saveLabel,announce:vi.fn()}},createElement(RefuelingRingFeedback,{action:{id:'r',scope:'card',phase:'applied',receipt}})));expect(html).toContain(saveLabel);expect(html).toContain('普通 1 环：3 → 4');if(saveLabel!=='已保存到本机')expect(html).not.toContain('已保存到本机');
});
