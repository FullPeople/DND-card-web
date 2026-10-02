import {describe,it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {createDashboardDraft,commitDashboardDraft} from '../src/core/dashboardDraft';
import {RESOURCE_TEMPLATES,addResourceModule,supportsWidgetStyle,freeDashboardLayout,normalizeWidget,resourceModules,validWidget,migrateDashboardWidgets} from '../src/core/resourceWidgets';
describe('capacity matched resource dashboard',()=>{
 it('keeps exact count styles only for bounded integer capacities 1 through 10',()=>{
  for(const max of [0,1,2,5,10,11,99999,2.5])for(const style of ['pips','orbit','segments','matrix'] as const){
   const rows:[string,{current:number;max:number}][]=[['r',{current:0,max}]];
   expect(supportsWidgetStyle(style,rows)).toBe(Number.isInteger(max)&&max>=1&&max<=10);
   expect(supportsWidgetStyle(style,[['r',{current:0,max,unlimited:true}]])).toBe(false);
  }
  expect(supportsWidgetStyle('ready',[['r',{current:0,max:1}]])).toBe(true);
  expect(supportsWidgetStyle('ready',[['r',{current:0,max:10}]])).toBe(false);
 });
 it('migrates hidden coordinates once, preserves values and restores them in the right canvas',()=>{
  const c=newCharacter();c.runtime.resources={visible:{current:2,max:3},hidden:{current:4,max:5}};
  c.quickbarLayout={order:[],hidden:['resource:hidden'],attacks:normalizeWidget({w:3,h:6}),widgets:{visible:normalizeWidget({x:3,w:3,page:0}),hidden:normalizeWidget({x:6,w:3,page:1,color:'#123456',icon:'leaf'})}};
  const before=structuredClone(c),draft=createDashboardDraft(c);
  expect(c).toEqual(before);expect(draft.quickbarLayout!.widgets!.hidden).toMatchObject({x:4,w:4,page:1,color:'#123456',icon:'leaf'});
  draft.quickbarLayout!.attacks!.split=.4;const committed=commitDashboardDraft(c,c,draft);
  expect(committed.runtime).toEqual(c.runtime);expect(createDashboardDraft(committed).quickbarLayout).toEqual(committed.quickbarLayout);
  committed.quickbarLayout!.hidden=[];
  const shown=freeDashboardLayout(resourceModules(Object.entries(committed.runtime.resources)),committed.quickbarLayout!.widgets,committed.quickbarLayout!.attacks);
  expect(shown.widgets.hidden).toMatchObject({x:4,w:4,page:1});
 });
 it('creates 2 to 12 independent pools and rejects invalid group counts before mutation',()=>{
  for(const count of [2,3,6,9,12]){
   const c=newCharacter();let next=0;addResourceModule(c,RESOURCE_TEMPLATES.find(t=>t.id==='poolpips'),0,()=>`id-${next++}`,undefined,undefined,{name:'多项',current:3,max:5,unlimited:false,count});
   expect(Object.keys(c.runtime.resources)).toHaveLength(count);expect(c.quickbarLayout!.widgets!['id-0'].members).toHaveLength(count);
   c.runtime.resources['id-1'].current=0;expect(c.runtime.resources['id-0'].current).toBe(3);
  }
  for(const count of [1,13,2.5]){const c=newCharacter(),before=structuredClone(c);expect(()=>addResourceModule(c,RESOURCE_TEMPLATES.find(t=>t.id==='pool'),0,()=>crypto.randomUUID(),undefined,undefined,{name:'多项',current:1,max:2,unlimited:false,count})).toThrow();expect(c).toEqual(before);}
 });
 it('validates and clamps divider preferences while leaving resource geometry untouched',()=>{
  expect(validWidget({...normalizeWidget(),resourceArea:true,split:.32})).toBe(true);
  for(const split of [NaN,Infinity,.1,.6])expect(validWidget({...normalizeWidget(),split})).toBe(false);
  const saved={r:normalizeWidget({x:4,w:5,page:3})},attacks=normalizeWidget({resourceArea:true,split:.55});
  expect(migrateDashboardWidgets(saved,attacks)).toEqual(saved);
 });
});
