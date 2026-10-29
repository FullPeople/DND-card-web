import {expect,it,vi} from 'vitest';
vi.mock('../src/platform/workbench',()=>{const state={};return{inWorkbench:false,useWorkbench:()=>state,getWorkbench:()=>state,workbenchRequest:vi.fn(),requestInventory:vi.fn(),composeRoll:vi.fn()};});
vi.mock('../src/cloud/localRights',()=>({localGm:()=>false}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4',useSheetCaptureActive:()=>false}));
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ItemChargeUseControl} from '../src/ui/ItemChargeUseControl';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {ResourceModuleEditor} from '../src/ui/ResourceModuleEditor';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {itemChargeBoundReceipt,itemChargeKnownStateVersion,itemChargeOffers,itemChargeRequest,performItemChargeAction,itemChargeRule} from '../src/core/automation/itemChargeDebits';
import {evaluate} from '../src/core/engine';
import {readCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
import evidence from '../src/core/automation/nonunitItemChargeEvidence.json';
import {nonunitItemChargeFixture} from './helpers/nonunitItemChargeFlowFixture';
import {nonunitItemChargeSnapshot as snapshot} from './helpers/nonunitItemChargeSourceFixture';

const RING='kiwee:item:dmg:ring%20of%20the%20ram::::::',FANGS='kiwee-homebrew:item:humblewoodtales:fangs%20of%20guile::::::',authority={canEdit:true,gm:false};
const fixture=(id=RING,form:'canonical'|'merged'='canonical')=>nonunitItemChargeFixture(id,form);
const offer=(f:ReturnType<typeof fixture>)=>itemChargeOffers(f.c,authority).find(row=>row.ownerId===f.owner.id)!;
const leaf=(f:ReturnType<typeof fixture>,writable=true,canEdit=true)=>renderToStaticMarkup(createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit,open:()=>{},close:()=>{}}},createElement(ItemChargeUseControl,{c:f.c,ownerId:f.owner.id,edit:()=>{},writable})));
function acquire(f:ReturnType<typeof fixture>,remaining=offer(f).capacity!){expect(performItemChargeAction(f.c,itemChargeRequest(f.c,f.owner.id,'ui-known-balance',{kind:'acquire',knownRemaining:remaining,confirmedGenuineItem:true,confirmedKnownBalance:true}),authority).status).toBe('applied');return f;}
function debit(f:ReturnType<typeof fixture>,branchKey=offer(f).variableActions![0].key,cost=2){const branch=offer(f).variableActions!.find(row=>row.key===branchKey)!;expect(performItemChargeAction(f.c,itemChargeRequest(f.c,f.owner.id,'ui-source-units',{kind:'variable-debit',branchKey,cost,context:Object.fromEntries(branch.requiredContext.map(code=>[code,true])) as Record<string,true>}),authority).status).toBe('applied');}
const input=(html:string,label:string)=>html.match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0]||'';
const select=(html:string,label:string)=>html.match(new RegExp(`<select[^>]*aria-label="${label}"[^>]*>[\\s\\S]*?<\\/select>`))?.[0]||'';

it('actual previously held Ring offers both source branches with blank branch/fee/balance choices and no invented grant or arbitrary debit field',()=>{
 const f=fixture(),before=snapshot(f.c),current=offer(f),html=leaf(f);expect(itemChargeRule(f.entry)?.supported).toBe(false);expect(current.canAcquire).toBe(true);expect(current.variableActions?.map(row=>row.key)).toEqual(['ram-creature-attack','ram-object-breaking']);expect(html).toContain('data-variable-item-charge');expect(select(html,'物品充能来源分支')).toContain('<option value="" selected="">');expect(select(html,'物品充能来源费用')).toContain('<option value="" selected="">');expect(input(html,'物品充能当前已知剩余')).toContain('value=""');expect((html.match(/type="number"/g)||[])).toHaveLength(1);expect(html).toContain('不接受任意扣除数量');expect(html).toContain('不授予使用资格');expect(f.c.runtime.itemChargeDebits).toBeUndefined();expect(snapshot(f.c)).toBe(before);
});

it('actual acquisition staysv1, source fee2 becomes knownv2, and readonly summary/native reopening preserve exact events and all unrelated resources',()=>{
 const f=acquire(fixture()),protectedBefore=snapshot([f.c.notes,f.c.runtime.hp,f.c.runtime.resources.manual,f.c.selections]);expect(f.c.runtime.itemChargeDebits?.version).toBe(1);const first=snapshot(f.c.runtime.itemChargeDebits!.records[0].events);debit(f);expect(f.c.runtime.itemChargeDebits?.version).toBe(2);expect(offer(f).remaining).toBe(1);expect(f.c.runtime.itemChargeDebits!.records[0].spent).toBe(2);expect(snapshot(f.c.runtime.itemChargeDebits!.records[0].events.slice(0,1))).toBe(first);expect(itemChargeBoundReceipt(f.c,f.owner.id)?.id).toBe('ui-source-units');for(const mode of ['snapshot','policy']){const altered=structuredClone(f.c);if(mode==='snapshot')altered.runtime.itemChargeDebits!.records[0].snapshotSha256='0'.repeat(64);else (altered.runtime.itemChargeDebits!.records[0].events.at(-1)as any).policySha256='0'.repeat(64);const frozen=snapshot(altered);expect(itemChargeBoundReceipt(altered,f.owner.id)).toBeUndefined();expect(snapshot(altered)).toBe(frozen);}const before=snapshot(f.c),html=leaf(f);expect(html).toContain('当前已记录剩余 1 / 3');expect(html).not.toContain('记录固定费用分支 · 扣 1 充能');expect(html).toContain('旧客户端将 v2 作为未知版本只读保留');expect(html).toContain('保留字段不等于可安全编辑');expect(html).not.toContain('data-item-charge-phase="applied"');expect(snapshot(f.c)).toBe(before);expect(snapshot(readCharacter(exportCharacter(f.c)).character)).toBe(before);expect(snapshot([f.c.notes,f.c.runtime.hp,f.c.runtime.resources.manual,f.c.selections])).toBe(protectedBefore);
});

it('actual merged XDMG Ring keeps its source-specific magic-action and nonmagical-object branch conditions, not the DMG route',()=>{
 const f=fixture('kiwee:item:xdmg:ring%20of%20the%20ram::::::','merged'),before=snapshot(f.c),branches=offer(f).variableActions!;expect(branches).toHaveLength(2);expect(branches.find(row=>row.key==='ram-object-breaking')!.requiredContext).toContain('nonmagical-object');expect(branches.every(row=>row.requiredContext.includes('magic-action-used'))).toBe(true);expect(branches.some(row=>row.requiredContext.includes('action-used'))).toBe(false);expect(leaf(f)).toContain('ram-object-breaking');expect(snapshot(f.c)).toBe(before);
});

it('the actual source-fee selection and executable-balance predicate retain Fangs fee3 while refusing it at capacity3/minAfter1',()=>{
 const f=acquire(fixture(FANGS)),current=offer(f),branch=current.variableActions![0],source=readFileSync('src/ui/ItemChargeUseControl.tsx','utf8');expect(branch.allowedCosts).toEqual([1,2,3]);expect(branch.minAfter).toBe(1);expect(branch.canDebit).toBe(true);
 const costExpression=source.match(/cost=(branch\?\.allowedCosts\.find\([^\n]*\));/)?.[1];expect(costExpression).toBeDefined();const pick=new Function('branch','costChoice',`return (${costExpression});`);expect(pick(branch,'3')).toBe(3);for(const value of ['4','01','-1','1.5',''])expect(pick(branch,value)).toBeUndefined();
 const expression=source.match(/const canVariableDebit=([^;]+);/)?.[1];expect(expression).toBeDefined();const canDebit=new Function('offer','branch','restricted','busy','cost','contextsConfirmed',`return (${expression});`);expect(canDebit(current,branch,false,false,2,true)).toBe(true);expect(canDebit(current,branch,false,false,3,true)).toBe(false);expect(canDebit(current,branch,false,false,2,false)).toBe(false);expect(canDebit(current,branch,true,false,2,true)).toBe(false);const before=snapshot(f.c);expect(leaf(f)).toContain('请选择本次来源费用');expect(snapshot(f.c)).toBe(before);
});

it('actual readonly, current workspace denial, card lock and owned-resource lock all block new-family actions without native mutation',()=>{
 for(const mode of ['readonly','context','card-lock','resource-lock']){const f=acquire(fixture());if(mode==='card-lock')f.c.locked=true;if(mode==='resource-lock')f.c.runtime.resources[offer(f).key].locked=true;const before=snapshot(f.c),html=leaf(f,mode!=='readonly',mode!=='context');expect(html.match(/<button[^>]*>记录所选来源分支<\/button>/)?.[0]).toContain('disabled');if(mode==='readonly'||mode==='context')expect(html.match(/<fieldset[^>]*>/)?.[0]).toContain('disabled');else expect(offer(f).variableActions!.every(row=>!row.canDebit)).toBe(true);expect(snapshot(f.c)).toBe(before);}
});

it('the actual App and AutomationPanel writable callsites propagate readonly to the real new-family leaf without filtering on legacy supported',()=>{
 const f=fixture(),before=snapshot(f.c),app=readFileSync('src/ui/App.tsx','utf8'),panel=readFileSync('src/ui/AutomationPanel.tsx','utf8'),appTag=[...app.matchAll(/<AutomationPanel\b[\s\S]*?\/>/g)];expect(appTag).toHaveLength(1);const expression=appTag[0][0].match(/writable=\{([^}]+)\}/)?.[1];expect(expression).toBeDefined();const writable=new Function('readOnly','inWorkbench','wb',`return (${expression});`);expect(writable(false,false,{})).toBe(true);expect(writable(true,false,{})).toBe(false);expect(writable(false,true,{target:{write:false}})).toBe(false);expect(writable(false,true,{target:{write:true}})).toBe(true);const leafTag=[...panel.matchAll(/<ItemChargeUseControl\b[^>]*\/>/g)];expect(leafTag).toHaveLength(1);expect(leafTag[0][0]).toContain('writable={writable}');const html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d:evaluate(f.c),entries:f.entries,edit:()=>{},writable:writable(true,false,{})}));expect(html).toContain('data-variable-item-charge');expect(html.match(/<fieldset[^>]*data-item-charge-owner[^>]*>/)?.[0]).toContain('disabled');expect(snapshot(f.c)).toBe(before);
});

it('knownv2 pool remains readonly in generic resource editor, while source pause and future history preserve spent state without reinitialization',()=>{
 const f=acquire(fixture());debit(f);const key=offer(f).key,before=snapshot(f.c),editor=renderToStaticMarkup(createElement(ResourceModuleEditor,{c:f.c,id:key,edit:()=>{},close:()=>{},disabled:false,gm:true}));expect(input(editor,'资源剩余')).toMatch(/\b(?:readonly|disabled)/i);expect(input(editor,'资源上限')).toMatch(/\b(?:readonly|disabled)/i);expect(editor).not.toContain('>移除</button>');expect(snapshot(f.c)).toBe(before);f.c.profile.enabledSources=[];let frozen=snapshot(f.c),html=leaf(f);expect(html).toContain('当前已记录剩余 1 / 3');expect(html.match(/<button[^>]*>确认记录物品充能<\/button>/)?.[0]).toContain('disabled');expect(snapshot(f.c)).toBe(frozen);expect(performItemChargeAction(f.c,itemChargeRequest(f.c,f.owner.id,'ui-variable-withdraw',{kind:'withdraw'}),authority).status).toBe('applied');expect(offer(f).eligible).toBe(false);expect(itemChargeBoundReceipt(f.c,f.owner.id)?.id).toBe('ui-variable-withdraw');f.c.runtime.itemChargeDebits!.version=9;frozen=snapshot(f.c);html=leaf(f);expect(html).toContain('只读');expect(html).not.toContain('data-item-charge-phase="applied"');expect(snapshot(f.c)).toBe(frozen);
});

it('actual three held sources remain unacquirable and the leaf retains legacyv1 ACK while accepting only closed known1/2 history versions',()=>{
 for(const held of evidence.holds){const f=fixture(held.id),before=snapshot(f.c),html=leaf(f);expect(offer(f).canAcquire).toBe(false);expect(offer(f).variableActions||[]).toEqual([]);expect(html).not.toContain('data-variable-item-charge');expect(snapshot(f.c)).toBe(before);}expect(itemChargeKnownStateVersion(1)).toBe(true);expect(itemChargeKnownStateVersion(2)).toBe(true);for(const version of [undefined,0,3,9,'2'])expect(itemChargeKnownStateVersion(version)).toBe(false);
 const source=readFileSync('src/ui/ItemChargeUseControl.tsx','utf8');expect(source).toContain('c.runtime.itemChargeDebits?.version===1&&offer?.record?.ownerId===ownerId');expect(source).toContain('itemChargeKnownStateVersion(c.runtime.itemChargeDebits?.version)');expect(source).toContain('itemChargeBoundReceipt(c,ownerId)');expect(source).toContain('offer.record.events.some(event=>event.id===last.id&&event.sequence===last.sequence)');expect(source).toContain('feedback.liveAuthority()');expect(source).toContain('current.ownerId!==ownerId');expect(source).toContain('rows[0].basis!==expected');expect(source).toContain("{kind,branchKey:branch!.key,cost:cost!,context:");
});
