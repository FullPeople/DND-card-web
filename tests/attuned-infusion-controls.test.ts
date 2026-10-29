import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
// Node SSR needs an authored browser URL for the real authority module.
// Keep workbench/room/permission implementations intact; no mocked access.
vi.hoisted(()=>vi.stubGlobal('location',new URL('https://attuned-controls.invalid/')));
import {InfusionControl} from '../src/ui/InfusionControl';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {evaluate} from '../src/core/engine';
import {setInfusionTarget,setInfusionHeld,INFUSION_DAMAGE_TYPES} from '../src/core/automation/infusions';
import {attunedInfusionFixture} from './e2e/attunedInfusionFixture';
vi.mock('../src/ui/Reference',()=>({Reference:({children}:any)=>createElement('span',null,children)}));
function setup(name='Resistant Armor'){
 const state=attunedInfusionFixture(),entry=state.options.find(row=>row.english===name)!,edit=vi.fn();
 return {...state,entry,edit,props:{c:state.c,entry,choiceId:state.choiceId,ownerId:'attuned-owner',unavailable:false,writable:true,edit}};
}
const render=(props:ReturnType<typeof setup>['props'])=>renderToStaticMarkup(createElement(InfusionControl,props));
const button=(html:string,label:string)=>html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0]||'';
it('offers exactly ten damage types and no implicit default or mutation',()=>{
 const {c,props,edit}=setup(),before=JSON.stringify(c),html=render(props);
 expect(html).toContain('<option value="" selected="">请选择一种伤害类型</option>');
 for(const type of INFUSION_DAMAGE_TYPES)expect(html).toContain(`<option value="${type}">`);
 expect(html).not.toContain('value="bludgeoning"');expect(button(html,'确认抗性护甲灌注')).toContain('disabled');expect(html).toContain('不增加 AC');expect(html).toContain('死亡后的失效时点仍需手动撤回');expect(edit).not.toHaveBeenCalled();expect(JSON.stringify(c)).toBe(before);
});
it('does not invent a damage type for a legacy binding missing its choice',()=>{
 const {c,entry,choiceId,props}=setup();c.infusions={version:1,bindings:[{choiceId,entryId:entry.id,targetId:'attuned-item-0'}]};const before=JSON.stringify(c),html=render(props);
 expect(html).toContain('已选抗性：尚未选择');expect(html).toContain('当前暂停生效');expect(button(html,'确认抗性护甲灌注')).toContain('disabled');expect(button(html,'撤回抗性护甲灌注')).not.toContain('disabled');expect(JSON.stringify(c)).toBe(before);
});
it.each(['equipped','attuned','level','source','choice','automation'] as const)('shows retained resistance as suspended when %s is unavailable',mode=>{
 const {c,entry,choiceId,props}=setup();setInfusionTarget(c,choiceId,entry.id,'attuned-item-0',{damageType:'fire'});
 if(mode==='equipped'||mode==='attuned')c.selections.find(row=>row.id==='attuned-item-0')![mode]=false;
 else if(mode==='level')c.selections[0].level=5;else if(mode==='source')c.profile.enabledSources=['PHB'];else if(mode==='choice')c.answers[choiceId]=[];else c.automation!.enabled=false;
 const before=JSON.stringify(c),html=render(props);expect(html).toContain('已选抗性：火焰');expect(html).toContain('当前暂停生效');expect(button(html,'撤回抗性护甲灌注')).not.toContain('disabled');expect(html).toContain('至少 6 级');expect(JSON.stringify(c)).toBe(before);
});
it('readonly protects writes without incorrectly suspending an active resistance',()=>{
 const {c,entry,choiceId,props}=setup();setInfusionTarget(c,choiceId,entry.id,'attuned-item-0',{damageType:'cold'});props.writable=false;const html=render(props);
 expect(html).toContain('当前已生效');expect(button(html,'撤回抗性护甲灌注')).toContain('disabled');expect(html.match(/<select[^>]*aria-label="抗性护甲抗性伤害类型"[^>]*>/)?.[0]).toContain('disabled');
});
it('preserves unknown versions with no reads of assumed fields or modification controls',()=>{
 const {c,props}=setup();(c as any).infusions={version:19,future:'retained'};const before=JSON.stringify(c),html=render(props);
 expect(html).toContain('版本尚未支持');expect(button(html,'确认抗性护甲灌注')).toContain('disabled');expect(html).not.toContain('撤回灌注');expect(JSON.stringify(c)).toBe(before);
});
it('requires an independent shield holding confirmation and permits clearing it with the source disabled',()=>{
 const {c,entry,choiceId,props}=setup('Repulsion Shield');setInfusionTarget(c,choiceId,entry.id,'attuned-item-1');let html=render(props);
 expect(html).toContain('aria-label="确认当前持握此盾牌"');expect(html).toContain('未确认当前持握');expect(html).toContain('每日黎明恢复');expect(html).not.toContain('确认当前持握此法器');
 setInfusionHeld(c,choiceId,entry.id,true);expect(render(props)).toContain('当前已生效');c.profile.enabledSources=['PHB'];html=render(props);
 expect(html.match(/<input[^>]*aria-label="确认当前持握此盾牌"[^>]*>/)?.[0]).not.toContain('disabled');expect(html).toContain('当前暂停生效');expect(button(html,'撤回斥力盾牌灌注')).not.toContain('disabled');
});
it('explains ranged-only repeating shot and manual ammunition without falsely claiming an unattuned bonus',()=>{
 const {c,entry,choiceId,props}=setup('Repeating Shot');setInfusionTarget(c,choiceId,entry.id,'attuned-item-2');c.selections.find(row=>row.id==='attuned-item-2')!.attuned=false;const html=render(props);
 expect(html).toContain('远程攻击');expect(html).toContain('未同调');expect(html).toContain('不修改弹药数量或资源');expect(html).not.toContain('确认当前持握此盾牌');
});
it('lists only bounded current derived resistances and labels damage application as manual',()=>{
 const {c,entry,choiceId,entries}=setup();setInfusionTarget(c,choiceId,entry.id,'attuned-item-0',{damageType:'fire'});const d=evaluate(c);d.resistances!.push('unknown');
 const html=renderToStaticMarkup(createElement(AutomationPanel,{c,d,entries,edit:()=>{}}));expect(html).toContain('data-testid="automation-resistances">fire</p>');expect(html).toContain('实际伤害结算与减免仍需手动处理');
 c.selections[0].level=5;const suspended=renderToStaticMarkup(createElement(AutomationPanel,{c,d:evaluate(c),entries,edit:()=>{}}));expect(suspended).toContain('data-testid="automation-resistances">无</p>');
});

it.each([{type:'M',property:['A']},{type:'M',property:['A','T','V'],dmg2:'1d8'},{type:'R',property:['A','T']}])('does not claim Repeating Shot is active for unsupported attack modes %j',raw=>{
 const {c,entry,choiceId,props}=setup('Repeating Shot'),target=c.selections.find(row=>row.id==='attuned-item-2')!;
 Object.assign(target.entry.raw,raw);setInfusionTarget(c,choiceId,entry.id,target.id);const before=JSON.stringify(c),html=render(props);
 expect(html).toContain('当前暂停生效');expect(html).toContain('没有受支持的远程攻击模式');expect(html).not.toContain('当前已生效');expect(button(html,'撤回连发射击灌注')).not.toContain('disabled');expect(JSON.stringify(c)).toBe(before);
});
it('shows a supported ammunition ranged attack as active without changing its saved binding',()=>{
 const {c,entry,choiceId,props}=setup('Repeating Shot');setInfusionTarget(c,choiceId,entry.id,'attuned-item-2');const before=JSON.stringify(c);
 expect(render(props)).toContain('当前已生效');expect(render(props)).not.toContain('没有受支持的远程攻击模式');expect(JSON.stringify(c)).toBe(before);
});
