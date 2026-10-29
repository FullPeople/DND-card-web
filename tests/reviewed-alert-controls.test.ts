// @vitest-environment jsdom
import {afterEach,describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ClassChoiceRecords} from '../src/ui/ClassChoiceRecords';
import {syncFeatures} from '../src/core/sheet';
import {setSheetChoiceSlot} from '../src/core/automation/choices';
import {reviewedAlertRule,reviewedAlertStatus} from '../src/core/automation/reviewedAlert';
import {evaluate} from '../src/core/engine';
import {alertDirectory,alertSnapshot,setupAlert} from './helpers/reviewedAlertCore';
import {setupAlertUI} from './reviewed-alert-ui-fixture';

let current:Awaited<ReturnType<typeof setupAlertUI>>|undefined;
afterEach(async()=>{await current?.cleanup();current=undefined;});
async function setup(){return current=await setupAlertUI(4,0,true);}
describe.skipIf(!alertDirectory)('actual-source Alert class choice records',()=>{
 it('renders exactly one owned bounded control, one exclusion, natural/final totals and manual rules, without changing the card',async()=>{
  const s=await setup(),before=alertSnapshot(s.c);expect(s.host.querySelectorAll('[data-reviewed-feat-kind=alert]')).toHaveLength(1);
  expect(s.manual()).not.toBeNull();expect(s.text()).toContain('PHB 2014');expect(s.text()).toContain('不提升属性');expect(s.text()).toContain('突袭');expect(s.text()).toContain('未见攻击者');expect(s.text()).toContain('仍手工');expect(s.text()).toContain('XPHB');expect(s.text()).toContain('先撤回');
  expect(s.host.querySelector('select[aria-label*=警觉]')).toBeNull();expect(alertSnapshot(s.c)).toBe(before);
 });
 it('level suspension retains a single read-only-safe withdrawal control and original confirmation',async()=>{
  const s=await setup();await s.confirm();s.c.selections[0].level=3;syncFeatures(s.c,s.catalog);const before=alertSnapshot(s.c);await s.render();
  expect(s.host.querySelectorAll('[data-reviewed-feat-kind=alert]')).toHaveLength(1);expect(s.text()).toContain('警觉记录已保留');expect(s.button('确认警觉').disabled).toBe(true);expect(s.button('撤回警觉').disabled).toBe(false);
  s.writable=false;await s.render();expect(s.button('撤回警觉').disabled).toBe(true);expect(alertSnapshot(s.c)).toBe(before);
 });
 it.each(['missing','deformed','duplicate'])('retained %s source has explicit atomic fallback withdrawal without granting from manual feat entries',async mode=>{
  const s=await setup();await s.confirm();if(mode==='duplicate')s.c.reviewedAlert!.bindings.push(structuredClone(s.c.reviewedAlert!.bindings[0]));
  s.c.selections=[];if(mode==='missing'){s.c.classChoiceSnapshots={};s.catalog.splice(0);}else s.c.classChoiceSnapshots![s.entry.id].raw.page=999;
  const before=alertSnapshot(s.c),manual=structuredClone({...s.c,reviewedAlert:undefined});await s.render();expect(s.text()).toContain('原警觉资料未载入或声明不再匹配');expect(s.buttons('撤回警觉记录')).toHaveLength(1);expect(alertSnapshot(s.c)).toBe(before);
  s.writable=false;await s.render();expect(s.button('撤回警觉记录').disabled).toBe(true);s.writable=true;await s.render();await s.click(s.button('撤回警觉记录'));
  expect(s.c.reviewedAlert!.bindings).toEqual([]);expect({...s.c,reviewedAlert:undefined}).toEqual(manual);
 });
 it.each(['present','missing'])('snapshot key/embedded-ID mismatch with %s owner exposes original-ID cleanup, never an unowned alias control',async owner=>{
  const s=await setup();await s.confirm();const original=s.entry.id,snapshot=s.c.classChoiceSnapshots![original];snapshot.id='authored:retained-alert-alias';
  if(owner==='missing')s.c.selections=[];s.catalog.splice(0);
  expect(!!reviewedAlertRule(snapshot)).toBe(true);expect(reviewedAlertStatus(s.c,s.choice.id,original).active).toBe(false);
  const before=alertSnapshot(s.c),manual=structuredClone({...s.c,reviewedAlert:undefined});await s.render();
  expect(s.host.querySelectorAll('[data-reviewed-feat-kind=alert]')).toHaveLength(0);expect(s.buttons('撤回警觉记录')).toHaveLength(1);expect(alertSnapshot(s.c)).toBe(before);
  s.writable=false;await s.render();expect(s.button('撤回警觉记录').disabled).toBe(true);s.writable=true;await s.render();await s.click(s.button('撤回警觉记录'));
  expect(s.c.reviewedAlert!.bindings).toEqual([]);expect({...s.c,reviewedAlert:undefined}).toEqual(manual);
 });
 it('a coherently keyed authenticated alias still has one real confirmation and withdrawal control',async()=>{
  const s=await setup(),alias=structuredClone(s.entry);alias.id='authored:coherent-alert-alias';s.catalog.push(alias);setSheetChoiceSlot(s.c,s.choice.id,0,alias.id,s.catalog);await s.render();
  expect(s.host.querySelectorAll('[data-reviewed-feat-kind=alert]')).toHaveLength(1);expect(s.host.querySelector('[data-reviewed-feat-kind=alert]')!.getAttribute('data-reviewed-feat-entry')).toBe(alias.id);expect(s.buttons('撤回警觉记录')).toHaveLength(0);
  const before=structuredClone({...s.c,reviewedAlert:undefined});await s.confirm();expect(s.c.reviewedAlert!.bindings[0].entryId).toBe(alias.id);expect(reviewedAlertStatus(s.c,s.choice.id,alias.id).active).toBe(true);expect(evaluate(s.c).initiative).toBe(7);
  await s.click(s.button('撤回警觉'));expect(s.c.reviewedAlert!.bindings).toEqual([]);expect({...s.c,reviewedAlert:undefined}).toEqual(before);
 });
 it.each(['card','binding','readonly','hide','unmount'])('fallback queued withdrawal rejects a stale %s draft',async mode=>{
  const s=await setup();await s.confirm();s.c.selections=[];s.c.classChoiceSnapshots={};s.catalog.splice(0);await s.render();s.defer=true;await s.click(s.button('撤回警觉记录'));
  const draft=structuredClone(s.c);if(mode==='card')draft.id='different-card';else if(mode==='binding')draft.reviewedAlert!.bindings[0].selectionId='changed';else if(mode==='readonly'){s.writable=false;await s.render();}else if(mode==='hide'){s.active=false;await s.render();}else await s.unmount();
  const before=alertSnapshot(draft);expect(()=>s.pending!(draft)).toThrow();expect(alertSnapshot(draft)).toBe(before);
 });
 it('fallback rejected edit remains honestly retryable, and the replacement attempt revokes its earlier queued callback',async()=>{
  const s=await setup();await s.confirm();s.c.selections=[];s.c.classChoiceSnapshots={};s.catalog.splice(0);await s.render();
  s.submit=false;const before=alertSnapshot(s.c);await s.click(s.button('撤回警觉记录'));expect(s.text()).toContain('修改未提交');expect(alertSnapshot(s.c)).toBe(before);expect(s.button('撤回警觉记录').disabled).toBe(false);
  s.submit=true;s.defer=true;await s.click(s.button('撤回警觉记录'));const old=s.pending!;await s.click(s.button('撤回警觉记录'));const latest=s.pending!,draft=structuredClone(s.c);
  expect(latest).not.toBe(old);expect(()=>old(draft)).toThrow('草稿');expect(alertSnapshot(draft)).toBe(before);latest(draft);expect(draft.reviewedAlert!.bindings).toEqual([]);
 });
 it('unknown future store is retained and explained even with no owner, without any editable fallback',()=>{
  const s=setupAlert();(s.c as any).reviewedAlert={version:9,opaque:{keep:true}};s.c.selections=[];const before=alertSnapshot(s.c),html=renderToStaticMarkup(createElement(ClassChoiceRecords,{c:s.c,catalog:[],mode:'feat',edit:()=>{throw Error('must not edit');}}));
  expect(html).toContain('警觉记录版本尚未支持');expect(html).not.toContain('<button');expect(alertSnapshot(s.c)).toBe(before);
 });
 it('independent manual PHB feat and genuine modern choice do not acquire an owned PHB control',async()=>{
  const s=await setup();setSheetChoiceSlot(s.c,s.choice.id,0,undefined,s.catalog);s.c.selections.push({id:'manual-alert',entry:s.entry,level:1,quantity:1,equipped:false});await s.render();expect(s.host.querySelector('[data-reviewed-feat-kind=alert]')).toBeNull();
  s.c.selections.pop();const modern=s.catalog.find(row=>row.kind==='feat'&&row.english==='Alert'&&row.source==='XPHB')!;
  // Preserve a historical modern answer as inert in this classic slot. It may
  // remain visible, but must never be reinterpreted as the PHB fixed+5 control.
  s.c.answers[s.choice.id]=[modern.id];s.c.classChoiceSnapshots![modern.id]=structuredClone(modern);await s.render();expect(s.host.querySelector('[data-reviewed-feat-kind=alert]')).toBeNull();
 });
});
