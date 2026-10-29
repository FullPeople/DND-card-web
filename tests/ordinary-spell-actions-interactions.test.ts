// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {SpellsPage} from '../src/ui/SpellsPage';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {FeedbackContext} from '../src/ui/InteractionFeedback';
import {RetainedCardVisibility} from '../src/ui/RetainedCardVisibility';
import {evaluate} from '../src/core/engine';
import type {Character} from '../src/core/model';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {syncFeatures} from '../src/core/sheet';
import {syncAutoResources} from '../src/core/resources';
import {learnActiveSpell} from '../src/core/spellWorkspace';
import {ordinarySpellFixture,ordinarySnapshot} from './helpers/ordinarySpellCastingFixture';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let dispose:(()=>Promise<void>)|undefined;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.unstubAllGlobals();});

/** Actual frozen catalog, acquisition, page, context menu and actions. Only the
 * host edit/persistence boundary is authored; no core/role/session is mocked. */
async function setup(options:Parameters<typeof ordinarySpellFixture>[0]={}){
 await dispose?.();
 const source=ordinarySpellFixture(options);let c=source.c,readOnly=false,writable=true,active=true,defer=false,submit=true,saveLabel='已保存到本机';
 let pending:((draft:Character)=>void)|undefined,root:Root|undefined;
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const edit=vi.fn((action:(draft:Character)=>void)=>{if(!submit)return;if(defer){pending=action;return;}const draft=structuredClone(c);action(draft);c=draft;draw();});
 function draw(){root?.render(createElement(RetainedCardVisibility.Provider,{value:active},createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:writable,open:()=>{},close:()=>{}}},createElement(FeedbackContext.Provider,{value:{scope:c.id,saveLabel,announce:()=>{}}},createElement(SheetEditContext.Provider,{value:false},createElement(SpellsPage,{c,d:evaluate(c),edit,entries:source.entries,readOnly,browse:()=>{},inspect:()=>{},onLink:()=>{},add:()=>{}}))))));}
 const render=async()=>{c={...c};await act(draw);};
 const click=async(node:HTMLElement)=>act(()=>node.click());
 const button=(name:string)=>{const rows=[...document.querySelectorAll<HTMLButtonElement>('button')].filter(n=>n.textContent===name||n.getAttribute('aria-label')===name);expect(rows,`unique authored button ${name}`).toHaveLength(1);return rows[0];};
 const open=async()=>{const tile=host.querySelector<HTMLElement>(`[data-spell-id="${source.row.id}"]`);expect(tile).not.toBeNull();await act(()=>tile!.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:30,clientY:30})));await click(button('普通施法'));};
 const unmount=async()=>{if(root)await act(()=>root!.unmount());root=undefined;};
 dispose=async()=>{await unmount();host.remove();};await render();
 return {source,host,edit,button,click,open,render,unmount,get c(){return c;},replace:(next:Character)=>{c=next;},get pending(){return pending;},set defer(v:boolean){defer=v;},set submit(v:boolean){submit=v;},set readOnly(v:boolean){readOnly=v;},set writable(v:boolean){writable=v;},set active(v:boolean){active=v;},set saveLabel(v:string){saveLabel=v;}};
}

describe('fresh actual-source ordinary casting controls',()=>{
 it('prepared PHB Wizard uses the real page route and automatic pool through exhaustion, native reopen and no duplicate callback debit',async()=>{
  const s=await setup(),manual=ordinarySnapshot(s.c.runtime.resources.manual),base=ordinarySnapshot(s.c.abilities);await s.open();
  const cast=s.button('记录普通施法');expect(cast.disabled).toBe(false);const initial=s.c.runtime.resources['spell-slot:1'].current;
  for(let n=initial;n>0;n--){await s.click(s.button('记录普通施法'));expect(s.c.runtime.resources['spell-slot:1'].current).toBe(n-1);expect(s.c.runtime.automationActions?.sequence).toBe(initial-n+1);}
  expect(s.button('记录普通施法').disabled).toBe(true);expect(ordinarySnapshot(s.c.runtime.resources.manual)).toBe(manual);expect(ordinarySnapshot(s.c.abilities)).toBe(base);
  const reopened=readCharacter(exportCharacter(s.c)).character;expect(reopened.runtime.resources).toEqual(s.c.runtime.resources);expect(reopened.runtime.automationActions).toEqual(s.c.runtime.automationActions);
 });
 it('actually learned PHB Sorcerer casts only the explicit class allocation and never creates a source/special grant',async()=>{
  const s=await setup({caster:'Sorcerer'});await s.open();const before=s.c.runtime.resources['spell-slot:1'].current;
  await s.click(s.button('记录普通施法'));expect(s.c.runtime.resources['spell-slot:1'].current).toBe(before-1);expect(s.c.spellSettings?.special?.[s.source.row.id]).toBeUndefined();
  expect(s.c.runtime.automationActions?.last?.selectionId).toBe(s.source.row.id);expect(document.querySelector('[role=dialog]')?.textContent).toContain('效果');
 });
 it('explicitly selected PHB Fire Bolt records one real zero-cost receipt without any resource debit',async()=>{
  const s=await setup({cantrip:true}),resources=ordinarySnapshot(s.c.runtime.resources);await s.open();await s.click(s.button('记录普通施法'));
  expect(s.c.runtime.automationActions?.sequence).toBe(1);expect(s.c.runtime.automationActions?.last?.resourceId).toBeUndefined();expect(ordinarySnapshot(s.c.runtime.resources)).toBe(resources);expect(document.body.textContent).toContain('不消耗资源');
 });
 it('real PHB Warlock known spell uses the owned pact pool, not an unrelated manual slot-shaped counter',async()=>{
  const s=await setup({caster:'Warlock'});s.c.runtime.resources['spell-slot:9']={name:'authored manual slot collision',max:5,current:3};const manual=ordinarySnapshot(s.c.runtime.resources['spell-slot:9']);await s.render();await s.open();
  const before=s.c.runtime.resources['pact-slot:2'].current;await s.click(s.button('记录普通施法'));expect(s.c.runtime.resources['pact-slot:2'].current).toBe(before-1);expect(s.c.runtime.automationActions?.last?.resourceId).toBe('pact-slot:2');expect(ordinarySnapshot(s.c.runtime.resources['spell-slot:9'])).toBe(manual);
 });
 it('two genuine prepared/known class allocations require an explicit current caster choice without a primary-ability fallback',async()=>{
  const s=await setup(),owner={id:'second-real-owner',entry:s.source.find('class','Sorcerer'),level:3,quantity:1,equipped:false};s.c.selections.push(owner);syncFeatures(s.c,s.source.entries);syncAutoResources(s.c);
  const learned=learnActiveSpell(s.c,s.source.entry,owner.id);expect(learned.error).toBeUndefined();await s.render();await s.open();expect(s.button('记录普通施法').disabled).toBe(true);
  const select=document.querySelector<HTMLSelectElement>('select[aria-label="普通施法职业"]');expect(select).not.toBeNull();expect([...select!.options].map(x=>x.value)).toContain(owner.id);
  await act(()=>{select!.value=owner.id;select!.dispatchEvent(new Event('change',{bubbles:true}));});expect(s.button('记录普通施法').disabled).toBe(false);await s.click(s.button('记录普通施法'));
  expect(JSON.parse(s.c.runtime.automationActions!.last!.fingerprint).at(-1)).toBe(owner.id);const dialog=document.querySelector('[role=dialog]')!;expect(dialog.textContent).not.toContain('攻击 ');expect(dialog.textContent).not.toContain('DC ');
 });
 it('the actual solo owner GM contract bypasses only a lock; readonly and a manual-only counter still deny without writes',async()=>{
  const s=await setup();s.c.runtime.resources['spell-slot:1'].locked=true;await s.render();await s.open();expect(s.button('记录普通施法').disabled).toBe(false);await s.click(s.button('记录普通施法'));
  expect(s.c.runtime.resources['spell-slot:1'].current).toBe(3);s.readOnly=true;await s.render();const before=ordinarySnapshot(s.c);expect(s.button('记录普通施法').disabled).toBe(true);await s.click(s.button('记录普通施法'));expect(ordinarySnapshot(s.c)).toBe(before);
  s.readOnly=false;for(const value of Object.values(s.c.runtime.resources))delete value.automatic;await s.render();expect(s.button('记录普通施法').disabled).toBe(true);const held=ordinarySnapshot(s.c);await s.click(s.button('记录普通施法'));expect(ordinarySnapshot(s.c)).toBe(held);
 });
 it('queued actual callbacks are revoked by readonly, retained hide, close and unmount; replay of one applied callback cannot redebit',async()=>{
  for(const mode of ['readonly','hide','close','unmount','source','apply'] as const){
   const s=await setup();await s.open();s.defer=true;await s.click(s.button('记录普通施法'));await s.click(s.button('记录普通施法'));expect(s.edit).toHaveBeenCalledTimes(1);const pending=s.pending!;
   if(mode==='readonly'){s.writable=false;await s.render();}else if(mode==='hide'){s.active=false;await s.render();}else if(mode==='close')await s.click(s.button('关闭施放详情'));else if(mode==='unmount')await s.unmount();
   const draft=structuredClone(s.c);if(mode==='source')draft.profile.enabledSources=[];const before=ordinarySnapshot(draft);
   await act(()=>pending(draft));if(mode==='apply'){expect(draft.runtime.resources['spell-slot:1'].current).toBe(3);const once=ordinarySnapshot(draft);await act(()=>pending(draft));expect(ordinarySnapshot(draft)).toBe(once);}else expect(ordinarySnapshot(draft)).toBe(before);
  }
 });
 it('observed receipts and actual save labels stay honest; rejected host edits do not claim a debit and ordinary route never replaces special casting',async()=>{
  const s=await setup();s.saveLabel='保存失败：authored failure';await s.render();await s.open();await s.click(s.button('记录普通施法'));expect(document.body.textContent).toContain('保存失败：authored failure');expect(document.body.textContent).not.toContain('已保存到本机');
  const x=await setup();x.submit=false;await x.open();const before=ordinarySnapshot(x.c);await x.click(x.button('记录普通施法'));expect(ordinarySnapshot(x.c)).toBe(before);expect(document.querySelector('[data-phase=applied]')).toBeNull();
  await x.click(x.button('关闭施放详情'));x.c.spellSettings!.special={[x.source.row.id]:{mode:'locked'}};await x.render();const tile=x.host.querySelector<HTMLElement>(`[data-spell-id="${x.source.row.id}"]`)!;await act(()=>tile.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true})));expect([...document.querySelectorAll('button')].some(b=>b.textContent==='普通施法')).toBe(false);
 });
});
