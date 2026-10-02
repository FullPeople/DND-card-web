import {describe,it,expect,vi} from 'vitest';
import {newCharacter} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {exportCharacter,exportOwlbear,exportLinkedOwlbear} from '../src/core/export';
import {readCharacter,importOwlbear,validateCharacter} from '../src/core/validation';
import {ATTACKS_WIDGET_ID,RESOURCE_TEMPLATES,WIDGET_STYLES,addResourceModule,chooseDefaultWidgetStyle,dashboardLayout,ensureResourceWidget,normalizeWidget,resourceModules,setResourceWidgetStyle,validWidget,type ResourceWidgetLayout} from '../src/core/resourceWidgets';

const value=(max=5)=>({name:'原创资源',current:Math.min(2,max),max,locked:true,type:'count'});
function expectNoOverlap(widgets:ResourceWidgetLayout[]){
 for(const [i,a] of widgets.entries()){
  expect(validWidget(a)).toBe(true);
  for(const b of widgets.slice(i+1))expect(a.page!==b.page||a.x>=b.x+b.w||a.x+a.w<=b.x||a.y>=b.y+b.h||a.y+a.h<=b.y).toBe(true);
 }
}
describe('220 approved dashboard persistence and shared canvas',()=>{
 it('retains exactly the approved sixteen faces and excludes the nine rejected examples',()=>{
  expect(WIDGET_STYLES).toEqual(['ring','pips','pool','half','orbit','square','segments','reservoir','matrix','fraction','counter','poolchips','poolbars','poolpips','ready','diamond']);
  expect(RESOURCE_TEMPLATES.map(t=>t.id)).toEqual(WIDGET_STYLES);
 });
 it.each([
  [0,['orbit','diamond']],[6,['orbit','diamond']],[7,['orbit','segments','diamond']],
  [12,['orbit','segments','diamond']],[13,['segments','fraction']],[100,['segments','fraction']],[101,['fraction']],[2.5,['fraction']],
 ] as const)('chooses a suitable randomized default for maximum %s', (max,expected)=>{
  const actual=new Set(Array.from({length:30},(_,i)=>chooseDefaultWidgetStyle({max},()=>i/30)));
  expect([...actual]).toEqual(expected);
  expect(chooseDefaultWidgetStyle({max,unlimited:true},()=>0)).toBe('fraction');
 });
 it('chooses only once during creation and preserves the choice across maximum changes and native/linked backups',()=>{
  const c=newCharacter();c.runtime.resources.a=value(6);const rng=vi.fn(()=>.9);ensureResourceWidget(c,'a',rng);
  expect(c.quickbarLayout?.widgets?.a.style).toBe('diamond');expect(rng).toHaveBeenCalledTimes(1);
  c.runtime.resources.a.max=1000;ensureResourceWidget(c,'a',rng);expect(rng).toHaveBeenCalledTimes(1);
  const before=structuredClone(c.runtime.resources),shown=dashboardLayout(resourceModules(Object.entries(c.runtime.resources)),c.quickbarLayout?.widgets,c.quickbarLayout?.attacks);
  expect(shown.widgets.a.style).toBe('diamond');expect(c.runtime.resources).toEqual(before);
  for(const restored of [readCharacter(exportCharacter(c)).character,importOwlbear(exportLinkedOwlbear(c,evaluate(c)))])expect(restored.quickbarLayout).toEqual(c.quickbarLayout);
 });
 it('never randomizes or mutates unsaved old cards while repeatedly projecting their dashboard',()=>{
  const c=newCharacter();c.runtime.resources={a:value(4),b:value(18),c:value(200)};const before=structuredClone(c);
  const rng=vi.spyOn(Math,'random').mockImplementation(()=>{throw Error('render must not randomize');});
  try {const modules=resourceModules(Object.entries(c.runtime.resources));expect(dashboardLayout(modules)).toEqual(dashboardLayout(modules));expect(c).toEqual(before);}finally{rng.mockRestore();}
 });
 it('reserves a movable attacks box, relocates collisions, and preserves an intentional empty page',()=>{
  const modules=resourceModules([['a',value()],['b',value()]]),initial=dashboardLayout(modules);
  expect(initial.attacks).toMatchObject({x:0,y:0,w:3,h:6,page:0});expectNoOverlap([initial.attacks,...Object.values(initial.widgets)]);
  const moved=dashboardLayout(modules,{...initial.widgets,a:{...initial.widgets.a,x:0,y:0,w:6}},initial.attacks,'a');
  expect(moved.widgets.a).toMatchObject({x:0,y:0,w:6});expect(moved.attacks.x).toBeGreaterThan(0);expectNoOverlap([moved.attacks,...Object.values(moved.widgets)]);
  const next=dashboardLayout(modules,moved.widgets,{...moved.attacks,page:3},ATTACKS_WIDGET_ID);
  expect(next.attacks.page).toBe(3);expect(dashboardLayout(modules,next.widgets,next.attacks)).toEqual(next);
 });
 it('persists tone, flat icons and independent attacks geometry through both native and legacy formats',()=>{
  const c=newCharacter();c.runtime.resources.a=value();ensureResourceWidget(c,'a',()=>0);
  c.quickbarLayout!.widgets!.a={...c.quickbarLayout!.widgets!.a,color:'#A17e56',icon:'leaf'};
  c.quickbarLayout!.attacks=normalizeWidget({x:8,y:0,w:4,h:4,page:2,color:'#526A80'});
  const before=structuredClone(c.runtime);
  const legacy=exportOwlbear(c,evaluate(c));expect(legacy.web_quickbar_attacks).toEqual(c.quickbarLayout!.attacks);
  for(const copy of [readCharacter(exportCharacter(c)).character,importOwlbear(legacy),importOwlbear(exportLinkedOwlbear(c,evaluate(c)))]){
   expect(copy.quickbarLayout).toEqual(c.quickbarLayout);expect(copy.runtime.resources).toEqual(before.resources);
  }
  const linked=exportLinkedOwlbear(c,evaluate(c)) as any;linked.web_quickbar_attacks=normalizeWidget({page:0});
  expect(importOwlbear(linked).quickbarLayout!.attacks!.page).toBe(2);
 });
 it('changing style preserves the chosen page, tone, icon and live balances',()=>{
  const c=newCharacter();c.runtime.resources={a:value(),b:value(20)};ensureResourceWidget(c,'a',()=>0);ensureResourceWidget(c,'b',()=>0);
  c.quickbarLayout!.widgets!.a={...c.quickbarLayout!.widgets!.a,page:3,color:'#A27861',icon:'bottle'};
  const before=structuredClone(c.runtime.resources);setResourceWidgetStyle(c,'a','fraction');
  expect(c.quickbarLayout!.widgets!.a).toMatchObject({page:3,style:'fraction',color:'#A27861',icon:'bottle'});expect(c.runtime.resources).toEqual(before);
  expectNoOverlap([c.quickbarLayout!.attacks!,...Object.values(c.quickbarLayout!.widgets!)]);
 });
 it('rejects malicious or invalid appearance metadata and prevents attacks from becoming a resource group',()=>{
  for(const extra of [{color:'red'},{color:'#abc'},{color:'url(javascript:test)'},{icon:'<svg>'},{w:1},{page:3000}])expect(validWidget({...normalizeWidget(),...extra})).toBe(false);
  const c=newCharacter();c.quickbarLayout={order:[],hidden:[],attacks:{...normalizeWidget(),members:['a','b']}};
  expect(()=>validateCharacter(c)).toThrow('攻击模块布局无效');
 });
 it('preserves legacy choices while normalizing their display and keeps arbitrary resource IDs safe',()=>{
  const rows:any=[['__proto__',value()],['constructor',value()],['__attacks__',value()]];
  const saved=JSON.parse('{"__proto__":{"x":3,"y":0,"w":3,"h":2,"page":0,"style":"bar"},"constructor":{"x":6,"y":0,"w":3,"h":2,"page":0,"style":"icon"}}');
  const result=dashboardLayout(resourceModules(rows),saved);expect(result.widgets['__proto__'].style).toBe('segments');expect(result.widgets['constructor'].style).toBe('pips');
  expect(Object.keys(result.widgets)).toHaveLength(3);expect(Object.getPrototypeOf(result.widgets)).toBeNull();expect(saved.__proto__.style).toBe('bar');expectNoOverlap([result.attacks,...Object.values(result.widgets)]);
 });
 it('creates each approved module without overlapping attacks or changing any existing balance',()=>{
  const c=newCharacter();c.runtime.resources.existing=value(9);ensureResourceWidget(c,'existing',()=>0);const existing=structuredClone(c.runtime.resources.existing);let id=0;
  for(const template of RESOURCE_TEMPLATES){const added=addResourceModule(c,template,0,()=>`manual-${id++}`);expect(c.quickbarLayout!.widgets![added.id].style).toBe(template.style);expect(c.runtime.resources.existing).toEqual(existing);}
  const result=dashboardLayout(resourceModules(Object.entries(c.runtime.resources),c.quickbarLayout!.widgets),c.quickbarLayout!.widgets,c.quickbarLayout!.attacks);
  expect(Object.keys(result.widgets)).toHaveLength(17);expectNoOverlap([result.attacks,...Object.values(result.widgets)]);
  const ready=Object.entries(c.quickbarLayout!.widgets!).find(([,w])=>w.style==='ready')!;
  expect(c.runtime.resources[ready[0]]).toMatchObject({current:1,max:1});
 });
 it('creates configured bounded and unbounded modules while preserving automatic resources and rejects invalid creation atomically',()=>{
  const c=newCharacter();c.runtime.resources.existing={...value(9),automatic:true};const existing=structuredClone(c.runtime.resources.existing);let serial=0;
  const bounded=addResourceModule(c,RESOURCE_TEMPLATES.find(t=>t.id==='pips')!,0,()=>`custom-${serial++}`,undefined,undefined,{name:' 远行储备 ',current:4,max:8,unlimited:false});
  expect(c.runtime.resources[bounded.id]).toMatchObject({name:'远行储备',current:4,max:8,unlimited:false});
  const unbounded=addResourceModule(c,RESOURCE_TEMPLATES.find(t=>t.id==='counter')!,0,()=>`custom-${serial++}`,undefined,undefined,{name:'金币记录',current:100000,max:0,unlimited:true});
  expect(c.runtime.resources[unbounded.id]).toMatchObject({current:100000,max:0,unlimited:true,type:'number'});expect(c.runtime.resources.existing).toEqual(existing);
  const before=structuredClone(c);
  for(const invalid of [{name:'',current:2,max:3,unlimited:false},{name:'无效',current:4,max:3,unlimited:false},{name:'小数',current:.5,max:3,unlimited:false}]){
   expect(()=>addResourceModule(c,RESOURCE_TEMPLATES[0],0,()=>`invalid-${serial++}`,undefined,undefined,invalid)).toThrow('检查名称、当前值与上限');expect(c).toEqual(before);
  }
 });
 it('keeps nine standard spell levels and a pact pool separate, readable and unchanged after presentation edits',()=>{
  const c=newCharacter();c.runtime.resources=Object.fromEntries(Array.from({length:9},(_,i)=>[`spell-slot:${i+1}`,value(4)]));c.runtime.resources['pact-slot:5']=value(2);
  const before=structuredClone(c.runtime.resources),modules=resourceModules(Object.entries(c.runtime.resources));
  const saved={'spell-slot:1':normalizeWidget({style:'poolpips',color:'#789ABC',icon:'shield'})};
  const result=dashboardLayout(modules,saved);expect(modules).toHaveLength(2);expect(modules[0].rows).toHaveLength(9);expect(modules[1].rows).toHaveLength(1);
  expect(result.widgets['spell-slot:1']).toMatchObject({style:'poolpips',w:8,h:5,color:'#789ABC',icon:'shield'});expectNoOverlap([result.attacks,...Object.values(result.widgets)]);expect(c.runtime.resources).toEqual(before);
 });
});
