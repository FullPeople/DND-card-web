// @vitest-environment jsdom
// Actual client createRoot coverage; no SSR of the client-only workbench hook.
// Authored jsdom client checks. Only six unrelated Overview children are mocked.
import {afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {act,createElement,type ReactElement} from 'react';
import {createRoot} from 'react-dom/client';
vi.mock('../src/ui/TrainingChips',()=>({TrainingChips:()=>null}));
vi.mock('../src/ui/HitDiceResources',()=>({HitDiceResources:()=>null}));
vi.mock('../src/ui/Quickbar',()=>({Quickbar:()=>null}));
vi.mock('../src/ui/Portrait',()=>({Portrait:()=>null}));
vi.mock('../src/ui/FeaturePanel',()=>({FeaturePanel:()=>null}));
vi.mock('../src/ui/OverviewChoiceOverlay',()=>({OverviewChoiceOverlay:()=>null}));
import {ItemAffineHpControl} from '../src/ui/ItemAffineHpControl';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {Overview} from '../src/ui/Overview';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {ValueTraceProvider} from '../src/ui/ValueTrace';
import {evaluate} from '../src/core/engine';
import {itemAffineHpOffer,itemAffineHpRequest,performItemAffineHpAction} from '../src/core/automation/itemAffineHp';
import {itemAffineHpFixture} from './helpers/itemAffineHpFlowFixture';
import {itemAffineHpSpecs,itemAffineHpSourceEvidence,itemAffineHpSnapshot as snapshot} from './helpers/itemAffineHpSourceFixture';

beforeAll(()=>{itemAffineHpSourceEvidence();},30000);
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const noop=()=>{},authority={canEdit:true,gm:true},ackKey='item-affine-hp:acknowledgements';
const admitted=()=>{const keys=new Set(itemAffineHpSourceEvidence().rules.map(rule=>rule.key));return itemAffineHpSpecs.filter(spec=>keys.has(spec.key));};
async function clientMarkup(element:ReactElement,check?:(host:HTMLDivElement)=>void){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);try{await act(()=>root.render(element));check?.(host);return host.innerHTML;}finally{await act(()=>root.unmount());host.remove();}}
const leaf=(f:ReturnType<typeof itemAffineHpFixture>,edit=vi.fn())=>clientMarkup(createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:false,open:noop,close:noop}},createElement(ItemAffineHpControl,{c:f.c,selectionId:f.owner.id,edit,writable:false})),host=>{const input=host.querySelector<HTMLInputElement>('input[aria-label="确认本件物品未计入手工生命值上限"]');expect(input!==null).toBe(true);expect(input!.checked).toBe(false);expect([...host.querySelectorAll('input,button,select,textarea')].every(node=>node.matches(':disabled'))).toBe(true);});
function panel(f:ReturnType<typeof itemAffineHpFixture>,edit=vi.fn()){return clientMarkup(createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:false,open:noop,close:noop}},createElement(AutomationPanel,{c:f.c,d:evaluate(f.c),entries:f.catalog,edit,writable:false})));}
function overview(f:ReturnType<typeof itemAffineHpFixture>,edit=vi.fn()){const d=evaluate(f.c);return clientMarkup(createElement(ValueTraceProvider,{c:f.c,d,enabled:false,children:createElement(SheetEditContext.Provider,{value:false},createElement(Overview,{c:f.c,d,catalog:f.catalog,statusRibbon:null,addEntry:noop,edit,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}))}));}
const shownHp=(html:string)=>{const found=html.match(/<strong[^>]*data-stat="hp"[^>]*>(-?\d+)<\/strong>/);expect(found!==null).toBe(true);return Number(found![1]);};
const escape=(value:string)=>value.replace(/[&<>"']/g,key=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}as Record<string,string>)[key]);
function confirm(f:ReturnType<typeof itemAffineHpFixture>){const request=itemAffineHpRequest(f.c,f.owner.id,crypto.randomUUID(),{kind:'confirm',confirmedManualHpExcluded:true});expect(performItemAffineHpAction(f.c,request,authority).status).toBe('applied');}

it('all 15 actual canonical/cold-App item owners mount an unchecked readonly confirmation in the actual AutomationPanel, and merely opening either component never increases HP or writes acknowledgement state',async()=>{
 expect(admitted()).toHaveLength(15);
 for(const form of ['canonical','app']as const)for(const spec of admitted()){const f=itemAffineHpFixture(spec.key,form),before=snapshot(f.c),edit=vi.fn(),html=await leaf(f,edit),parent=await panel(f,edit);expect(html.includes('data-item-affine-hp-owner="'+f.owner.id+'"')).toBe(true);expect(html.includes('aria-label="确认本件物品未计入手工生命值上限"')).toBe(true);expect(html.includes('checked=""')).toBe(false);expect(html.includes(' disabled=""')).toBe(true);expect(html.includes('未确认不应用')).toBe(true);expect(html.includes('不恢复当前生命值、临时生命值、生命骰或其他已消耗资源')).toBe(true);expect(html.includes('data-item-affine-hp-phase="applied"')).toBe(false);expect(parent.includes('data-item-affine-hp-owner="'+f.owner.id+'"')).toBe(true);expect(evaluate(f.c).maxHp).toBe(42);expect(f.c.answers[ackKey]).toBeUndefined();expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);}
});

it('the real Overview renders confirmed axe and armor HP with provenance while readonly locks, changed manual bases and future records preserve current HP and expose conservative state',async()=>{
 for(const key of ['14:72','15:73','named:2316','33:59','34:59']){const f=itemAffineHpFixture(key);confirm(f);f.c.locked=true;const before=snapshot(f.c),d=evaluate(f.c),edit=vi.fn(),html=await overview(f,edit),control=await leaf(f,edit),bonus=f.rule.constant+7;expect(shownHp(html)).toBe(42+bonus);expect(d.trace.hp.some(row=>row.includes(f.entry.name))).toBe(true);for(const line of d.trace.hp)expect(html.includes(escape(line))).toBe(true);expect(control.includes(f.rule.sourceCondition==='attuned-only'?'当前明确同调（不另要求持用或装备）':'当前明确穿戴且同调')).toBe(true);expect(control.includes('常数 '+f.rule.constant+' + 当前角色总等级 7 × 1')).toBe(true);expect(control.includes('本件物品生命值上限加值已确认并生效')).toBe(true);expect(control.includes(' disabled=""')).toBe(true);expect(control.includes('data-item-affine-hp-phase="applied"')).toBe(false);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(7);expect(f.c.runtime.tempHp).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(1);}
 for(const mode of ['manual','final','future']as const){const f=itemAffineHpFixture();confirm(f);if(mode==='manual')f.c.baseHp=41;if(mode==='final')f.c.adjustments=[{id:'authored-final-hp',target:'hp',value:90,reason:'Authored final HP'}];if(mode==='future'){const store=JSON.parse(f.c.answers[ackKey][0]);f.c.answers[ackKey]=[JSON.stringify({...store,version:999,opaque:{keep:true}})];}const before=snapshot(f.c),offer=itemAffineHpOffer(f.c,f.owner.id,authority),edit=vi.fn(),html=await leaf(f,edit);expect(offer?.active).toBe(false);expect(!!offer?.reason).toBe(true);expect(html.includes(escape(offer!.reason!))).toBe(true);expect(shownHp(await overview(f,edit))).toBe(mode==='manual'?43:mode==='final'?92:42);expect(html.includes('字段保留不代表可安全编辑')).toBe(true);expect(html.includes(' disabled=""')).toBe(true);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);}
});
