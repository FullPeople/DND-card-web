// @vitest-environment jsdom
import {afterEach,describe,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {setAsiAllocation} from '../src/core/automation/asi';
import {setSheetChoiceSlot} from '../src/core/automation/choices';
import {reviewedAlertStatus,setReviewedAlertIntent} from '../src/core/automation/reviewedAlert';
import {alertDirectory,alertIntent,alertSnapshot} from './helpers/reviewedAlertCore';
import {setupAlertUI} from './reviewed-alert-ui-fixture';

let current:Awaited<ReturnType<typeof setupAlertUI>>|undefined;
afterEach(async()=>{await current?.cleanup();current=undefined;});
async function setup(level=4,slot=0){return current=await setupAlertUI(level,slot);}
describe.skipIf(!alertDirectory)('actual-source Alert control interactions',()=>{
 it('one explicit manual exclusion precedes one atomic +5 and grants no ability, resource or other statistic',async()=>{
  const s=await setup(),before=structuredClone(s.c),plain=evaluate(before);
  expect(s.host.querySelectorAll('input[type=checkbox]')).toHaveLength(1);expect(s.host.querySelector('select')).toBeNull();
  expect(s.text()).toContain('尚未确认警觉');expect(s.button('确认警觉').disabled).toBe(true);expect(plain.initiative).toBe(2);
  await s.click(s.button('确认警觉'));expect(s.edit).not.toHaveBeenCalled();
  await s.confirm();expect(s.c.reviewedAlert!.bindings).toHaveLength(1);expect(evaluate(s.c).initiative).toBe(7);
  expect({...s.c,reviewedAlert:undefined}).toEqual({...before,reviewedAlert:undefined});
  const derived=evaluate(s.c);expect({...derived,initiative:plain.initiative,trace:plain.trace,issues:plain.issues}).toEqual(plain);
  expect(s.manual().checked).toBe(false);await s.click(s.button('确认警觉'));expect(s.edit).toHaveBeenCalledTimes(1);
  expect(s.text()).toContain('当前自然先攻 7');expect(s.text()).toContain('卡面最终先攻 7');
 });
 it('cancel clears review without writing; explicit withdrawal removes only the derived grant',async()=>{
  const s=await setup();await s.click(s.manual());await s.click(s.button('取消警觉编辑'));expect(s.manual().checked).toBe(false);expect(s.edit).not.toHaveBeenCalled();
  await s.confirm();const before=structuredClone(s.c);await s.click(s.button('撤回警觉'));
  expect(s.c.reviewedAlert!.bindings).toEqual([]);expect(evaluate(s.c).initiative).toBe(2);
  expect({...s.c,reviewedAlert:undefined}).toEqual({...before,reviewedAlert:undefined});
 });
 it('discloses natural subtotal separately from last manual absolute final and signed sheet offset',async()=>{
  const s=await setup();s.c.jackOfAllTrades=true;s.c.adjustments=[{id:'first',target:'initiative',value:12,reason:'旧先攻'},{id:'last',target:'initiative',value:17,reason:'手工最终值'},{id:'blank',target:'initiative',value:99,reason:'  '}];
  s.c.sheetBonuses={...s.c.sheetBonuses,initiative:2,proficiency:2};await s.render();const before=structuredClone(s.c);await s.confirm();
  expect(evaluate(s.c).initiative).toBe(19);expect(s.text()).toContain('当前自然先攻 9');expect(s.text()).toContain('卡面最终先攻 19');expect(s.text()).toContain('手工最终值 17');expect(s.text()).toContain('卡面调整 2');
  expect({...s.c,reviewedAlert:undefined}).toEqual({...before,reviewedAlert:undefined});
  s.c.sheetBonuses.initiative=-3;await s.render();expect(s.text()).toContain('卡面最终先攻 14');
 });
 it.each([0,1])('uses final DEX from the other ordered ASI when Alert owns slot %s; no ability cap belongs to Alert',async slot=>{
  const s=await setup(8,slot),other=s.source.choices()[1-slot],asi=other.options.find(row=>row.entry.raw._classAbilityRecord)!;
  setSheetChoiceSlot(s.c,other.id,0,asi.value,s.catalog);setAsiAllocation(s.c,other.id,{dex:2});s.c.abilities.int=22;await s.render();
  await s.confirm();expect(evaluate(s.c)).toMatchObject({abilities:{dex:16,int:22},initiative:8});expect(s.text()).toContain('当前自然先攻 8');
  setAsiAllocation(s.c,other.id,null);await s.render();expect(s.text()).toContain('当前自然先攻 7');expect(s.c.abilities.dex).toBe(14);
 });
 it.each([[1,0],[20,10],[22,11]])('DEX%s has no Alert ability-cap event and derives natural initiative%s without rewriting the score',async(dex,natural)=>{
  const s=await setup();s.c.abilities.dex=dex;await s.render();await s.confirm();expect(s.c.abilities.dex).toBe(dex);expect(evaluate(s.c).initiative).toBe(natural);expect(s.text()).toContain(`当前自然先攻 ${natural}`);
 });
 it.each(['dex','jack','proficiency','offset','absolute','earlierAsi','earlierFeat','linguist','observant','profile','automation','answer','owner','source','binding','card'])('rejects a delayed actual edit after %s changed without rerender',async mode=>{
  const s=await setup();await s.click(s.manual());const before=alertSnapshot(s.c);
  s.mutate=draft=>{
   if(mode==='dex')draft.abilities.dex=16;
   else if(mode==='jack')draft.jackOfAllTrades=true;
   else if(mode==='proficiency')draft.sheetBonuses={...draft.sheetBonuses,proficiency:1};
   else if(mode==='offset')draft.sheetBonuses={...draft.sheetBonuses,initiative:5};
   else if(mode==='absolute')draft.adjustments=[{id:'late',target:'initiative',value:17,reason:'迟到手工值'}];
   else if(mode==='earlierAsi')draft.asiAllocations={version:1,bindings:[]};
   else if(mode==='earlierFeat')draft.reviewedFeats={version:1,bindings:[]};
   else if(mode==='linguist')draft.reviewedLinguist={version:1,bindings:[]};
   else if(mode==='observant')draft.reviewedObservant={version:1,bindings:[]};
   else if(mode==='profile')draft.profile.optional.feats=false;
   else if(mode==='automation')draft.automation!.enabled=false;
   else if(mode==='answer')draft.answers[s.choice.id]=[];
   else if(mode==='owner')draft.selections[0].id='different-owner';
   else if(mode==='source')draft.classChoiceSnapshots![s.entry.id].raw.page=999;
   else if(mode==='binding')setReviewedAlertIntent(draft,s.choice.id,s.entry.id,alertIntent(),s.catalog);
   else draft.id='another-card';
  };
  await s.click(s.button('确认警觉'));expect(s.host.querySelector('[role=alert]')).not.toBeNull();expect(alertSnapshot(s.c)).toBe(before);expect(s.manual().checked).toBe(false);
 });
 it.each(['display','raw','canonical'])('catalog %s family mutations invalidate queued confirmation even when no render occurs',async mode=>{
  const s=await setup();if(mode!=='display')s.catalog.push({...structuredClone(s.entry),id:mode==='canonical'?'kiwee:feat:xphb:alert::::::':'authored-raw-only-alert',english:'Renamed',kind:'feature',raw:{...s.entry.raw,ENG_name:'Alert'}});
  await s.render();await s.click(s.manual());s.defer=true;await s.click(s.button('确认警觉'));const draft=structuredClone(s.c),before=alertSnapshot(draft);
  const target=mode==='display'?s.catalog.find(row=>row.id===s.entry.id)!:s.catalog.at(-1)!;target.raw.page=999;
  expect(()=>s.pending!(draft)).toThrow('已变化');expect(alertSnapshot(draft)).toBe(before);
 });
 it('unrelated consumed runtime changes remain safe and are never refilled by confirmation',async()=>{
  const s=await setup();await s.click(s.manual());s.mutate=draft=>{draft.runtime.hp=1;draft.runtime.resources.manual.current=0;};await s.click(s.button('确认警觉'));
  expect(reviewedAlertStatus(s.c,s.choice.id,s.entry.id).active).toBe(true);expect(s.c.runtime.hp).toBe(1);expect(s.c.runtime.resources.manual.current).toBe(0);
 });
 it.each(['cancel','hide','readonly','unmount','unavailable','card'])('a queued confirmation cannot run after %s revokes its local review',async mode=>{
  const s=await setup();await s.click(s.manual());s.defer=true;await s.click(s.button('确认警觉'));const draft=structuredClone(s.c),before=alertSnapshot(draft);
  if(mode==='cancel')await s.click(s.button('取消警觉编辑'));
  else if(mode==='hide'){s.active=false;await s.render();}
  else if(mode==='readonly'){s.writable=false;await s.render();}
  else if(mode==='unavailable'){s.unavailable=true;await s.render();}
  else if(mode==='card'){const other=structuredClone(s.c);other.id='other-card';s.replace(other);await s.render();}
  else await s.unmount();
  expect(()=>s.pending!(draft)).toThrow('草稿');expect(alertSnapshot(draft)).toBe(before);
 });
 it('one queued callback may apply once only; repeated clicks and replayed callback cannot duplicate a grant',async()=>{
  const s=await setup();await s.click(s.manual());s.defer=true;await s.click(s.button('确认警觉'));await s.click(s.button('确认警觉'));
  expect(s.edit).toHaveBeenCalledTimes(1);const draft=structuredClone(s.c);s.pending!(draft);const before=alertSnapshot(draft);
  expect(()=>s.pending!(draft)).toThrow();expect(alertSnapshot(draft)).toBe(before);expect(draft.reviewedAlert!.bindings).toHaveLength(1);
 });
 it('rerender, retained hide and A→B→A clear consent; runtime-only rerender does not',async()=>{
  const s=await setup();await s.click(s.manual());s.c.runtime.hp=1;await s.render();expect(s.manual().checked).toBe(true);
  s.c.sheetBonuses={...s.c.sheetBonuses,initiative:1};await s.render();expect(s.manual().checked).toBe(false);
  await s.click(s.manual());const original=s.c,other=structuredClone(original);other.id='other-card';s.replace(other);await s.render();s.replace(original);await s.render();expect(s.manual().checked).toBe(false);
  await s.click(s.manual());s.active=false;await s.render();s.active=true;await s.render();expect(s.manual().checked).toBe(false);
 });
 it('source suspension keeps intent but only permits explicit withdrawal; read-only permits no writes',async()=>{
  const s=await setup();await s.confirm();const saved=alertSnapshot(s.c.reviewedAlert);s.c.profile.enabledSources=[];await s.render();
  expect(s.text()).toContain('警觉记录已保留');expect(s.button('确认警觉').disabled).toBe(true);expect(s.button('撤回警觉').disabled).toBe(false);expect(evaluate(s.c).initiative).toBe(2);expect(alertSnapshot(s.c.reviewedAlert)).toBe(saved);
  s.writable=false;await s.render();for(const name of ['确认警觉','取消警觉编辑','撤回警觉'])expect(s.button(name).disabled).toBe(true);
  s.writable=true;await s.render();await s.click(s.button('撤回警觉'));expect(s.c.reviewedAlert!.bindings).toEqual([]);
 });
 it('rejected host edit reports no submitted change and does not replace saved state',async()=>{
  const s=await setup();s.submit=false;const before=alertSnapshot(s.c);await s.confirm();expect(s.text()).toContain('修改未提交');expect(alertSnapshot(s.c)).toBe(before);
 });
 it.each(['保存失败：空间不足','待核对 · 本地修改已保留','正在保存…'])('reports the real scoped persistence label %s without synthetic saved claims',async message=>{
  const s=await setup();await s.confirm();s.saveLabel=message;await s.render();expect(s.host.querySelector('[data-testid=alert-save-status]')!.textContent).toBe(message);expect(s.text()).not.toContain('已保存到本机');
  s.feedbackScope='other-card';await s.render();expect(s.host.querySelector('[data-testid=alert-save-status]')!.textContent).toBe('保存与同步结果请查看卡面状态');
 });
 it('unknown future state remains opaque and inert, without writable controls or fabricated confirmation',async()=>{
  const s=await setup();(s.c as any).reviewedAlert={version:9,opaque:{keep:['unchanged']}};const before=alertSnapshot(s.c);await s.render();
  expect(s.text()).toContain('警觉记录版本尚未支持');expect(s.manual().disabled).toBe(true);for(const button of s.host.querySelectorAll<HTMLButtonElement>('button'))expect(button.disabled).toBe(true);expect(alertSnapshot(s.c)).toBe(before);expect(evaluate(s.c).initiative).toBe(2);
 });
});
