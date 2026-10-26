import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
import {InfusionControl} from '../src/ui/InfusionControl';
import {attunedInfusionFixture} from './e2e/attunedInfusionFixture';
import {setInfusionTarget} from '../src/core/automation/infusions';
vi.mock('../src/ui/Reference',()=>({Reference:({children}:any)=>createElement('span',null,children)}));
function setup(mind=false){
 const state=attunedInfusionFixture(),entry=state.options.find(row=>row.english==='Repulsion Shield')!;
 if(mind){entry.name='心灵锐化';entry.english='Mind Sharpener';entry.raw={...entry.raw,name:entry.name,ENG_name:entry.english};}
 const edit=vi.fn(),props={c:state.c,entry,choiceId:state.choiceId,ownerId:'attuned-owner',unavailable:false,writable:true,edit};
 return {...state,entry,edit,props};
}
const render=(props:ReturnType<typeof setup>['props'])=>renderToStaticMarkup(createElement(InfusionControl,props));
const button=(html:string,label:string)=>html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0]||'';
it('a learned shield with no balance never presents zero or full as a granted balance',()=>{
 const {c,entry,choiceId,props,edit}=setup();setInfusionTarget(c,choiceId,entry.id,'attuned-item-1');const before=JSON.stringify(c),html=render(props);
 expect(html).toContain('尚未记录当前充能');expect(html).toContain('初始余额必须由玩家核对');expect(button(html,'记录斥力盾牌初始充能')).not.toContain('disabled');expect(html).not.toContain('当前充能：4 / 4');expect(html).not.toContain('当前充能：0 / 4');expect(edit).not.toHaveBeenCalled();expect(JSON.stringify(c)).toBe(before);
});
it('read-only charge controls explain no-write without changing the original card',()=>{
 const {c,entry,choiceId,props}=setup();setInfusionTarget(c,choiceId,entry.id,'attuned-item-1');props.writable=false;const before=JSON.stringify(c),html=render(props);
 expect(button(html,'记录斥力盾牌初始充能')).toContain('disabled');expect(html).toContain('当前角色卡只读，不能修改充能');expect(JSON.stringify(c)).toBe(before);
});
it('Mind Sharpener is a worn armor reaction, not a default AC or attunement infusion',()=>{
 const {c,entry,choiceId,props}=setup(true);setInfusionTarget(c,choiceId,entry.id,'attuned-item-0');c.selections.find(row=>row.id==='attuned-item-0')!.attuned=false;const html=render(props);
 expect(html).toContain('维持法术专注的体质豁免失败');expect(html).toContain('无需同调');expect(html).toContain('不增加 AC');expect(html).not.toContain('未装备，不计 AC');expect(html).not.toContain('确认当前持握此盾牌');expect(html).toContain('手动');
});
it('charge boundary separates actual dawn and 1d4 from short or long rest and game-state automation',()=>{
 const {props}=setup();const html=render(props);expect(html).toContain('每日黎明恢复');expect(html).toContain('实际 d4');expect(html).toContain('不会移动敌人');expect(html).toContain('每轮反应');expect(html).toContain('普通枭熊导出不是完整备份');
});

import {infusionChargeActionRequest,performInfusionChargeAction} from '../src/core/automation/infusionCharges';
import {setInfusionHeld} from '../src/core/automation/infusions';
function initialized(mind=false,current=2){const state=setup(mind);setInfusionTarget(state.c,state.choiceId,state.entry.id,mind?'attuned-item-0':'attuned-item-1');const result=performInfusionChargeAction(state.c,infusionChargeActionRequest(state.c,state.choiceId,state.entry.id,'initial-ui',{kind:'initialize',initial:current}));expect(result.status).toBe('applied');return state;}
it.each([0,1,2,3,4])('renders the explicit saved %s/4 and never offers a second initialization',current=>{
 const {c,props,edit}=initialized(false,current),before=JSON.stringify(c),html=render(props);expect(html).toContain(`当前充能：${current} / 4`);expect(html).not.toContain('记录斥力盾牌初始充能');expect(button(html,'恢复斥力盾牌黎明充能').includes('disabled')).toBe(current===4);expect(edit).not.toHaveBeenCalled();expect(JSON.stringify(c)).toBe(before);
});
it.each(['equipped','attuned','held'] as const)('a missing %s blocks use but leaves dawn available',key=>{
 const {c,entry,choiceId,props}=initialized();setInfusionHeld(c,choiceId,entry.id,true);if(key==='held')setInfusionHeld(c,choiceId,entry.id,false);else c.selections.find(row=>row.id==='attuned-item-1')![key]=false;
 const before=JSON.stringify(c),html=render(props);expect(button(html,'使用斥力盾牌反应充能')).toContain('disabled');expect(button(html,'恢复斥力盾牌黎明充能')).not.toContain('disabled');expect(JSON.stringify(c)).toBe(before);
});
it('a worn Mind Sharpener works without attunement but unworn still only permits dawn',()=>{
 const {c,props}=initialized(true);const target=c.selections.find(row=>row.id==='attuned-item-0')!;target.attuned=false;let html=render(props);expect(button(html,'使用心灵锐化反应充能')).not.toContain('disabled');target.equipped=false;html=render(props);expect(button(html,'使用心灵锐化反应充能')).toContain('disabled');expect(button(html,'恢复心灵锐化黎明充能')).not.toContain('disabled');expect(html).toContain('未穿戴，不能使用反应充能');expect(html).not.toContain('未装备，不计 AC');
});
it.each(['source','level','learned','automation','unavailable'] as const)('restricts all new charge writes when %s changes, without repairing history',kind=>{
 const {c,props}=initialized();if(kind==='source')c.profile.enabledSources=['PHB'];else if(kind==='level')c.selections[0].level=5;else if(kind==='learned')c.answers[props.choiceId]=[];else if(kind==='automation')c.automation!.enabled=false;else props.unavailable=true;
 const before=JSON.stringify(c),html=render(props);expect(button(html,'使用斥力盾牌反应充能')).toContain('disabled');expect(button(html,'恢复斥力盾牌黎明充能')).toContain('disabled');expect(JSON.stringify(c)).toBe(before);
});
it.each([{version:999,future:'retain'}, {version:1,sequence:0,records:{bad:{current:8,max:4}}}])('future or malformed charge state is visible, fail-closed and unchanged',state=>{
 const {c,props}=initialized();(c.runtime as any).infusionCharges=state;const before=JSON.stringify(c),html=render(props);expect(html).toContain('原记录保留');for(const label of ['记录斥力盾牌初始充能','使用斥力盾牌反应充能','恢复斥力盾牌黎明充能'])expect(button(html,label)).toContain('disabled');expect(JSON.stringify(c)).toBe(before);
});
it('a genuine unrelated infusion does not render charge controls',()=>{
 const state=attunedInfusionFixture(),entry=state.options.find(row=>row.english==='Resistant Armor')!,html=renderToStaticMarkup(createElement(InfusionControl,{c:state.c,entry,choiceId:state.choiceId,ownerId:'attuned-owner',unavailable:false,writable:true,edit:vi.fn()}));expect(html).not.toContain('infusion-charge-control');
});

import {InfusionChargeFeedback} from '../src/ui/InfusionChargeControl';
import {FeedbackContext} from '../src/ui/InteractionFeedback';
import type {InfusionChargePresentation} from '../src/ui/infusionChargePresentation';
it.each(['pending','unconfirmed','rejected'] as const)('never borrows an earlier saved label for this %s operation',phase=>{
 const action:InfusionChargePresentation={id:'request',scope:'card',title:'斥力之盾',phase},html=renderToStaticMarkup(createElement(FeedbackContext.Provider,{value:{scope:'card',saveLabel:'已保存到本机',announce:vi.fn()}},createElement(InfusionChargeFeedback,{action})));expect(html).not.toContain('已保存到本机');expect(html).not.toContain('充能操作已反映到当前卡');
});
it.each(['正在保存…','保存失败','待核对 · 本地修改已保留','已保存到本机'])('observed application shows actual persistence state %s without changing it',saveLabel=>{
 const action:InfusionChargePresentation={id:'request',scope:'card',title:'斥力之盾',phase:'applied',receipt:{id:'request',before:2,after:1}},html=renderToStaticMarkup(createElement(FeedbackContext.Provider,{value:{scope:'card',saveLabel,announce:vi.fn()}},createElement(InfusionChargeFeedback,{action})));expect(html).toContain(saveLabel);expect(html).toContain('充能操作已反映到当前卡');if(saveLabel!=='已保存到本机')expect(html).not.toContain('已保存到本机');
});
