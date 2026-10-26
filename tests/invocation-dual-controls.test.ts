import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {SourceSpellActions} from '../src/ui/SourceSpellActions';
import {SpellActionFeedback} from '../src/ui/SpellActionFeedback';
import {SpellsPage} from '../src/ui/SpellsPage';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {normalizeData} from '../src/data/catalog';
import {syncAutoResources} from '../src/core/resources';
import {specialSpellResource,setSpecialSpell,changeSpecialSpellUses} from '../src/core/specialSpells';
import {evaluate} from '../src/core/engine';
import {performSpellAction,spellActionRequest} from '../src/core/automation/actions';
import {confirmSpellPresentation,type SpellPresentation} from '../src/ui/spellActionPresentation';
import {invocationDualPaymentCases as cases,invocationDualPaymentData} from './fixtures/invocationDualPaymentData';
import {sync,learn,invocationFixture} from './fixtures/invocationFixture';
vi.mock('../src/platform/workbench',()=>({inWorkbench:false,workbenchRequest:vi.fn()}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4',useSheetCaptureActive:()=>false}));
function setup(){
 const entries=normalizeData(structuredClone(invocationDualPaymentData),'authored-dual-payment-ui'),c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'warlock',entry:entries.find(entry=>entry.kind==='class')!,level:15,quantity:1,equipped:false}];sync(c,entries);syncAutoResources(c);
 for(const [index,rule] of cases.entries())learn(c,entries,entries.find(entry=>entry.english===rule.english)!,index);
 const spells=cases.map(rule=>c.selections.find(row=>row.entry.english===rule.spellEnglish&&row.grantKey?.startsWith('source-spell:'))!);expect(spells.every(Boolean)).toBe(true);
 return {c,entries,spells,edit:vi.fn()};
}
function actions(state:ReturnType<typeof setup>,index=0,readOnly=false){return renderToStaticMarkup(createElement(SourceSpellActions,{c:state.c,id:state.spells[index].id,edit:state.edit,readOnly}));}
const button=(html:string,label:string)=>{const tag=html.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0];expect(tag,label).toBeTruthy();return tag!;};
const restoreLabel='确认已长休，恢复本祈唤次数';
it('renders all seven as one dual payment with two balances and the current pact level, never a free-or-slot choice',()=>{
 const state=setup(),before=JSON.stringify(state.c);
 for(let index=0;index<cases.length;index++){
  const html=actions(state,index);expect(html).toContain('本祈唤次数：1 / 1');expect(html).toContain('5环契约位：3 / 3');expect(html).toContain('以 5 环施法');expect(html.match(/data-payment-resource=/g)).toHaveLength(2);expect(html).not.toContain('role="radio');expect(html).not.toContain('免费');expect(button(html,'使用')).not.toContain('disabled');expect(button(html,restoreLabel)).toContain('disabled');expect(html).toContain('不豁免材料成分');expect(html).toContain('不会执行完整休息');
 }
 expect(JSON.stringify(state.c)).toBe(before);expect(state.edit).not.toHaveBeenCalled();
});
it.each(['invocation','pact'] as const)('shows the precise %s shortage without spending or offering ordinary slots',kind=>{
 const state=setup(),id=state.spells[0].id,key=kind==='pact'?'pact-slot:5':specialSpellResource(id,state.c);state.c.runtime.resources[key].current=0;state.c.runtime.resources['spell-slot:9']={max:9,current:9};const before=JSON.stringify(state.c),html=actions(state);
 expect(button(html,'使用')).toContain('disabled');expect(html).toContain(kind==='pact'?'契约位不足':'祈唤长休次数不足');expect(html.match(/data-payment-resource=/g)).toHaveLength(2);expect(html).not.toContain('9环法术位');expect(html).not.toContain('role="radio');expect(JSON.stringify(state.c)).toBe(before);expect(state.edit).not.toHaveBeenCalled();
});
it('read-only keeps balances visible but disables both casting and the single-counter restore',()=>{
 const state=setup();state.c.runtime.resources[specialSpellResource(state.spells[0].id,state.c)].current=0;const before=JSON.stringify(state.c),html=actions(state,0,true);
 expect(button(html,'使用')).toContain('disabled');expect(button(html,restoreLabel)).toContain('disabled');expect(html).toContain('当前为只读');expect(html).toContain('本祈唤次数：0 / 1');expect(button(actions(state),restoreLabel)).not.toContain('disabled');expect(JSON.stringify(state.c)).toBe(before);expect(state.edit).not.toHaveBeenCalled();
});
it('honors the live App permission context even when SpellsPage did not receive a readonly prop',()=>{
 const state=setup();state.c.runtime.resources[specialSpellResource(state.spells[0].id,state.c)].current=0;const before=JSON.stringify(state.c),html=renderToStaticMarkup(createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:false,open:vi.fn(),close:vi.fn()}},createElement(SourceSpellActions,{c:state.c,id:state.spells[0].id,edit:state.edit})));expect(button(html,'使用')).toContain('disabled');expect(button(html,restoreLabel)).toContain('disabled');expect(html).toContain('当前为只读');expect(JSON.stringify(state.c)).toBe(before);expect(state.edit).not.toHaveBeenCalled();
});
it('only new dual-payment badges change; an independent same-name manual counter still says free',()=>{
 const state=setup(),entry=state.entries.find(entry=>entry.english==='Bane')!;state.c.selections.push({id:'manual-bane',entry,level:1,quantity:1,equipped:false});setSpecialSpell(state.c,'manual-bane',{mode:'uses',max:3,recovery:'long'});changeSpecialSpellUses(state.c,'manual-bane',1);const before=JSON.stringify(state.c);
 const html=renderToStaticMarkup(createElement(SpellsPage,{c:state.c,d:evaluate(state.c),entries:state.entries,edit:state.edit,browse:vi.fn(),inspect:vi.fn(),onLink:vi.fn(),add:vi.fn()}));
 expect(html.match(/祈唤次数 1\/1 ＋ 契约位 · 长休/g)).toHaveLength(7);expect(html.match(/免费 1\/3/g)).toHaveLength(1);expect(JSON.stringify(state.c)).toBe(before);expect(state.edit).not.toHaveBeenCalled();
});
it('receipt rendering shows both real debits and never mislabels an atomic payment as resource-free',()=>{
 const state=setup(),id=state.spells[0].id,result=performSpellAction(state.c,spellActionRequest(state.c,id,'invocation-pact','ui-dual'));expect(result.status).toBe('applied');if(result.status==='rejected')throw Error(result.message);
 const waiting:SpellPresentation={id:'ui-dual',scope:state.c.id,title:'灾祸术',payment:'双资源支付',mode:'cast',phase:'pending'},confirmed=confirmSpellPresentation(waiting,state.c.id,result.receipt),before=JSON.stringify(state.c),html=renderToStaticMarkup(createElement(SpellActionFeedback,{action:confirmed}));
 expect(html).toContain('5 环施法 · 已同时扣除两项资源');expect(html.match(/data-spent-resource=/g)).toHaveLength(2);expect(html).toContain('本祈唤次数');expect(html).toContain('5环契约位');expect(html).toContain('<span>1</span><i>→</i><b>0</b>');expect(html).toContain('<span>3</span><i>→</i><b>2</b>');expect(html).not.toContain('不消耗资源');expect(JSON.stringify(state.c)).toBe(before);
 const restored=performSpellAction(state.c,spellActionRequest(state.c,id,'source','ui-restore','restore'));expect(restored.status).toBe('applied');if(restored.status==='rejected')throw Error(restored.message);
 const recovery=renderToStaticMarkup(createElement(SpellActionFeedback,{action:{...waiting,id:'ui-restore',mode:'restore',phase:'applied',receipt:restored.receipt}}));expect(recovery).toContain('<span>0</span><i>→</i><b>1</b>');expect(recovery).not.toContain('data-spent-resource');expect(state.c.runtime.resources['pact-slot:5'].current).toBe(2);
});
it('preserves the old free invocation offer and receipt presentation',()=>{
 const {c,entries,find}=invocationFixture();learn(c,entries,find('Eldritch Sight'));const row=c.selections.find(row=>row.entry.english==='Detect Magic'&&row.grantKey?.startsWith('source-spell:'))!,edit=vi.fn(),before=JSON.stringify(c),html=renderToStaticMarkup(createElement(SourceSpellActions,{c,id:row.id,edit}));
 expect(html).toContain('免费施法');expect(html).not.toContain('双资源余额');expect(html).not.toContain(restoreLabel);expect(JSON.stringify(c)).toBe(before);expect(edit).not.toHaveBeenCalled();
});
it('keeps the new restore confirmation and readonly boundary local, without wiring a full rest operation',()=>{
 const actions=readFileSync(new URL('../src/ui/SourceSpellActions.tsx',import.meta.url),'utf8'),page=readFileSync(new URL('../src/ui/SpellsPage.tsx',import.meta.url),'utf8');expect(actions).toContain("window.confirm('确认角色已经完成长休？");expect(actions).toContain('不恢复契约位、生命值或其他资源');expect(actions).not.toMatch(/performRest|sourceSpellRestRequest|restResources/);expect(page).toContain("readOnly={detailConfig.sourceGrant?.usage==='invocation-pact'}");
});
