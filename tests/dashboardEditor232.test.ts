import {describe,it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {createDashboardDraft,commitDashboardDraft} from '../src/core/dashboardDraft';
import {RESOURCE_TEMPLATES,addResourceModule,dashboardSplit,ensureResourceWidget,freeDashboardLayout,normalizeWidget,resourceModules,supportsWidgetStyle,validWidget} from '../src/core/resourceWidgets';
import {validateCharacter} from '../src/core/validation';
const row=(max:number,unlimited=false)=>[['a',{name:'手动法术位',current:0,max,unlimited}]] as Parameters<typeof supportsWidgetStyle>[1];
describe('232 explicitly configured manual dashboard',()=>{
 it('filters single/multi independently from capacity without substituting fixed styles',()=>{
  expect(supportsWidgetStyle('ready',row(1))).toBe(true);expect(supportsWidgetStyle('ready',row(3))).toBe(false);
  for(const style of ['pool','poolchips','poolbars','poolpips'] as const)expect(supportsWidgetStyle(style,row(3),false)).toBe(false);
  expect(supportsWidgetStyle('pips',row(999))).toBe(false);expect(supportsWidgetStyle('poolpips',[...row(3),['b',{current:0,max:99}]],true)).toBe(false);
  expect(supportsWidgetStyle('counter',row(0,true))).toBe(true);
 });
 it('creates separately named and independently capped children without touching real spell slots',()=>{
  const c=newCharacter();c.spellSettings={ability:'int',attackBonus:0,dcBonus:0,mode:'prepared',capacity:0,prepared:[],slots:{1:{max:4,used:1}}};let sequence=0;
  addResourceModule(c,RESOURCE_TEMPLATES.find(t=>t.id==='poolbars')!,0,()=>`manual-${++sequence}`,undefined,undefined,{name:'法术位',current:3,max:3,unlimited:false,children:[{name:'一环',current:1,max:4,unlimited:false},{name:'二环',current:12,max:0,unlimited:true}]});
  expect(c.runtime.resources['manual-1']).toMatchObject({name:'一环',current:1,max:4});expect(c.runtime.resources['manual-2']).toMatchObject({name:'二环',current:12,unlimited:true});expect(c.spellSettings.slots[1]).toEqual({max:4,used:1});
  expect(c.quickbarLayout!.widgets!['manual-1']).toMatchObject({style:'poolbars',label:'法术位',members:['manual-1','manual-2']});expect(()=>validateCharacter(c)).not.toThrow();
 });
 it('retains selected identity and internal scale across capacity changes, draft save, and validation',()=>{
  const c=newCharacter();c.runtime.resources.a={name:'充能',current:1,max:3};ensureResourceWidget(c,'a');c.quickbarLayout!.widgets!.a.contentScale=1.35;const before=structuredClone(c);
  const draft=createDashboardDraft(c);draft.runtime.resources.a.max=1000;draft.quickbarLayout!.widgets!.a.page=3;
  const committed=commitDashboardDraft(c,c,draft,{gm:true});expect(c).toEqual(before);expect(committed.quickbarLayout!.widgets!.a).toMatchObject({style:'orbit',contentScale:1.35,page:3});
  expect(freeDashboardLayout(resourceModules(Object.entries(committed.runtime.resources)),committed.quickbarLayout!.widgets,committed.quickbarLayout!.attacks).widgets.a.style).toBe('orbit');
 });
 it('keeps opening state untouched on cancellation and merges unrelated remote counters',()=>{
  const live=newCharacter();live.runtime.resources={a:{name:'A',current:1,max:3},b:{name:'B',current:2,max:4}};ensureResourceWidget(live,'a');ensureResourceWidget(live,'b');const before=structuredClone(live),draft=createDashboardDraft(live);
  draft.runtime.resources.a.current=0;expect(live).toEqual(before);const remote=structuredClone(live);remote.runtime.resources.b.current=1;
  const result=commitDashboardDraft(remote,live,draft,{gm:true});expect(result.runtime.resources.a.current).toBe(0);expect(result.runtime.resources.b.current).toBe(1);expect(live).toEqual(before);
  remote.runtime.resources.a.current=2;expect(()=>commitDashboardDraft(remote,live,draft,{gm:true})).toThrow();
 });
 it('removes a module only from layout while preserving resource values for restoration',()=>{
  const c=newCharacter();c.runtime.resources.a={name:'保留',current:2,max:3};ensureResourceWidget(c,'a');const draft=createDashboardDraft(c);draft.quickbarLayout!.hidden.push('resource:a');const result=commitDashboardDraft(c,c,draft,{gm:true});expect(result.runtime.resources).toEqual(c.runtime.resources);expect(result.quickbarLayout!.hidden).toContain('resource:a');
 });
 it('validates bounded content scale and preserves saved split preferences',()=>{
  expect(dashboardSplit()).toBe(.4);expect(dashboardSplit(.32)).toBe(.32);
  expect(validWidget(normalizeWidget({contentScale:2}))).toBe(true);expect(validWidget({...normalizeWidget(),contentScale:NaN})).toBe(false);expect(validWidget({...normalizeWidget(),contentScale:2.1})).toBe(false);
 });
});
