import {describe,it,expect} from 'vitest';
import {newCharacter,type Character} from '../src/core/model';
import {createDashboardDraft,commitDashboardDraft} from '../src/core/dashboardDraft';
import {RESOURCE_TEMPLATES,addResourceModule,dashboardOverlaps,ensureResourceWidget,freeDashboardLayout,moveWidget,normalizeModuleWidget,normalizeWidget,resourceModuleMinimum,resourceModules,setResourceWidgetStyle,type DashboardLayout} from '../src/core/resourceWidgets';

const resource=(name='原创资源')=>({name,current:3,max:5,type:'count',locked:false});
const template=(id:string)=>RESOURCE_TEMPLATES.find(t=>t.id===id)!;
function card():Character{
 const c=newCharacter();c.runtime.resources={a:resource('甲'),b:resource('乙')};
 c.quickbarLayout={order:[],hidden:[],attacks:normalizeWidget({x:0,y:0,w:4,h:6,resourceArea:true,split:.32}),widgets:{a:normalizeWidget({x:3,y:0,w:3,h:3,style:'orbit'}),b:normalizeWidget({x:6,y:0,w:3,h:3,style:'diamond'})}};
 return c;
}
function visible(c:Character){return freeDashboardLayout(resourceModules(Object.entries(c.runtime.resources),c.quickbarLayout?.widgets),c.quickbarLayout?.widgets,c.quickbarLayout?.attacks);}
describe('221 free dashboard placement',()=>{
 it('keeps intentional overlap, sparse pages and every neighbour fixed during movement and resizing',()=>{
  const c=card(),before=structuredClone(c.quickbarLayout!),saved={...before.widgets!,a:moveWidget(before.widgets!.a,3,0)};
  let shown=freeDashboardLayout(resourceModules(Object.entries(c.runtime.resources)),saved,before.attacks);
  expect(shown.widgets.a.x).toBe(6);expect(shown.widgets.b).toEqual(before.widgets!.b);expect(shown.attacks).toEqual(before.attacks);
  expect(dashboardOverlaps(shown)).toEqual({resources:['a','b'],attacks:false,count:1});
  saved.a={...moveWidget(before.widgets!.a,3,0,'e'),page:4};shown=freeDashboardLayout(resourceModules(Object.entries(c.runtime.resources)),saved,before.attacks);
  expect(shown.widgets.a).toMatchObject({page:4,w:6});expect(shown.widgets.b).toEqual(before.widgets!.b);expect(dashboardOverlaps(shown).count).toBe(0);
 });
 it('counts pairs but not touching edges or distinct pages, and never confuses an attacks-named resource',()=>{
  const layout:DashboardLayout={attacks:normalizeWidget({x:0,w:3,h:3}),widgets:{__attacks__:normalizeWidget({x:0,w:3,h:3}),a:normalizeWidget({x:0,w:3,h:3}),edge:normalizeWidget({x:3,w:3,h:3}),next:normalizeWidget({x:0,w:3,h:3,page:1})}};
  expect(dashboardOverlaps(layout)).toEqual({resources:['__attacks__','a'],attacks:false,count:1});
  layout.attacks={...layout.attacks,page:2};expect(dashboardOverlaps(layout)).toEqual({resources:['__attacks__','a'],attacks:false,count:1});
 });
 it('finds a position for missing attacks and resources without moving explicit saved coordinates',()=>{
  const rows:[string,ReturnType<typeof resource>][]=[['a',resource()],['b',resource()]],saved={a:normalizeWidget({w:12,h:6,page:0})},before=structuredClone(saved);
  const result=freeDashboardLayout(resourceModules(rows),saved);
  expect(result.widgets.a).toEqual(saved.a);expect(result.attacks.page).toBe(0);expect(result.widgets.b.page).toBe(1);expect(dashboardOverlaps(result).count).toBe(0);expect(saved).toEqual(before);
 });
 it('drops a new template exactly at a requested overlapping cell without moving existing content',()=>{
  const c=card(),before=structuredClone(c.quickbarLayout!),balances=structuredClone(c.runtime.resources);
  const added=addResourceModule(c,template('orbit'),0,()=> 'new',()=>0,{x:6,y:0});
  expect(added).toEqual({id:'new',page:0});expect(c.quickbarLayout!.widgets!.new).toMatchObject({x:6,y:0,w:3,h:3});
  for(const id of ['a','b']){expect(c.quickbarLayout!.widgets![id]).toEqual(before.widgets![id]);expect(c.runtime.resources[id]).toEqual(balances[id]);}
  expect(c.quickbarLayout!.attacks).toEqual(before.attacks);expect(dashboardOverlaps(visible(c)).count).toBe(1);
 });
 it('click adding and assigning a default never repair or shift an existing overlapping draft',()=>{
  const c=card();c.quickbarLayout!.widgets!.a.x=6;const before=structuredClone(c.quickbarLayout!);
  addResourceModule(c,template('ring'),0,()=> 'new');c.runtime.resources.fresh=resource();ensureResourceWidget(c,'fresh',()=>.9);setResourceWidgetStyle(c,'a','fraction');
  for(const id of ['a','b'])expect(c.quickbarLayout!.widgets![id]).toMatchObject({x:before.widgets![id].x,y:before.widgets![id].y,w:before.widgets![id].w,h:before.widgets![id].h,page:0});
  expect(c.quickbarLayout!.attacks).toEqual(before.attacks);expect(dashboardOverlaps(visible(c)).count).toBe(1);
 });
 it('materializes a detached deterministic draft and never spends or randomizes resources',()=>{
  const c=newCharacter();c.runtime.resources={a:resource()};const before=structuredClone(c),draft=createDashboardDraft(c);
  expect(draft).toEqual(createDashboardDraft(c));expect(draft.runtime).toEqual(c.runtime);expect(draft.quickbarLayout?.widgets?.a).toBeDefined();draft.quickbarLayout!.widgets!.a.x=8;draft.runtime.resources.a.current=1;expect(c).toEqual(before);
 });
 it('uses a group-aware resize minimum and displays the exact saved geometry after shrinking a custom group',()=>{
  const c=card();c.runtime.resources.extra=resource('丙');c.quickbarLayout!.widgets={a:normalizeWidget({x:3,y:0,w:6,h:5,style:'pool',members:['a','b','extra'],label:'组合资源'})};
  const draft=createDashboardDraft(c),module=resourceModules(Object.entries(draft.runtime.resources),draft.quickbarLayout!.widgets)[0],minimum=resourceModuleMinimum(module,'pool');
  expect(minimum).toEqual({w:6,h:3});draft.quickbarLayout!.widgets!.a=moveWidget(draft.quickbarLayout!.widgets!.a,-99,-99,'se',minimum);
  expect(draft.quickbarLayout!.widgets!.a).toMatchObject({x:3,y:0,w:6,h:3});
  const result=commitDashboardDraft(c,c,draft),shown=visible(result);expect(shown.widgets.a).toEqual(result.quickbarLayout!.widgets!.a);expect(shown.widgets.a).toEqual(draft.quickbarLayout!.widgets!.a);
 });
 it('grows a spell module for new levels without moving neighbours and keeps the resulting collision explicit',()=>{
  const c=card();delete c.runtime.resources.a;c.runtime.resources['spell-slot:1']={...resource('一环'),automatic:true};
  c.quickbarLayout!.widgets={'spell-slot:1':normalizeWidget({x:3,y:0,w:4,h:2,style:'pool'}),b:normalizeWidget({x:7,y:0,w:3,h:3,style:'orbit'})};
  for(let level=2;level<=9;level++)c.runtime.resources[`spell-slot:${level}`]={...resource(`${level}环`),automatic:true};
  const before=structuredClone(c),draft=createDashboardDraft(c),shown=visible(draft),modules=resourceModules(Object.entries(c.runtime.resources),c.quickbarLayout!.widgets),slots=modules.find(module=>module.slots)!;
  expect(slots.rows).toHaveLength(9);expect(resourceModuleMinimum(slots,'pool')).toEqual({w:8,h:5});expect(shown.widgets['spell-slot:1']).toMatchObject({x:3,y:0,w:8,h:5});expect(shown.widgets.b).toEqual(c.quickbarLayout!.widgets!.b);expect(shown.attacks).toEqual(c.quickbarLayout!.attacks);
  expect(dashboardOverlaps(shown).resources.sort()).toEqual(['b','spell-slot:1']);expect(dashboardOverlaps(shown).count).toBe(1);expect(c).toEqual(before);expect(()=>commitDashboardDraft(c,c,draft)).toThrow('模块有重叠');
  draft.quickbarLayout!.widgets!['spell-slot:1'].page=2;const result=commitDashboardDraft(c,c,draft);expect(visible(result).widgets).toEqual(result.quickbarLayout!.widgets);expect(result.runtime.resources).toEqual(c.runtime.resources);
 });
 it('normalizes only the dense module and does not silently shrink its requested presentation',()=>{
  const rows:[string,ReturnType<typeof resource>][]=[['a',resource()],['b',resource()],['c',resource()]],saved=normalizeWidget({x:8,y:4,w:4,h:2,style:'poolpips',members:['a','b','c']});
  const module=resourceModules(rows,{a:saved})[0];expect(resourceModuleMinimum(module,'poolpips')).toEqual({w:6,h:4});expect(normalizeModuleWidget(module,saved)).toMatchObject({x:6,y:2,w:6,h:4});expect(saved).toMatchObject({x:8,y:4,w:4,h:2});
 });
 it('keeps enough room for an attack heading and row without pushing any resource aside',()=>{
  const c=card();c.quickbarLayout!.attacks=normalizeWidget({x:4,y:4,w:2,h:2});const before=structuredClone(c),shown=visible(c);
  expect(shown.attacks).toMatchObject({x:0,y:0,w:4,h:6,page:0,resourceArea:true});expect(Object.keys(shown.widgets)).toEqual(['a','b']);expect(c).toEqual(before);
 });
});
describe('221 atomic dashboard save',()=>{
 it('retains remote balances, hit points, identity, notes and revision while applying local presentation changes',()=>{
  const base=card(),draft=createDashboardDraft(base),live=structuredClone(base);draft.quickbarLayout!.widgets!.a.color='#123456';draft.quickbarLayout!.widgets!.a.page=2;
  live.runtime.resources.a.current=1;live.runtime.hp=23;live.name='更新的名称';live.notes='远端编辑';live.revision++;live.updatedAt='2030-01-02';
  const snapshots=[base,draft,live].map(c=>structuredClone(c)),result=commitDashboardDraft(live,base,draft);
  expect(result.runtime).toEqual(live.runtime);expect(result.name).toBe(live.name);expect(result.notes).toBe(live.notes);expect(result.revision).toBe(live.revision);expect(result.updatedAt).toBe(live.updatedAt);
  expect(result.quickbarLayout!.widgets!.a).toMatchObject({color:'#123456',page:2});expect([base,draft,live]).toEqual(snapshots);
  result.runtime.resources.a.current=0;expect(live.runtime.resources.a.current).toBe(1);
 });
 it('does not mistake first-open materialization for a conflicting remote layout edit',()=>{
  const base=newCharacter();base.runtime.resources={a:resource(),b:resource()};const draft=createDashboardDraft(base),live=createDashboardDraft(base);
  draft.quickbarLayout!.widgets!.a.color='#123456';live.quickbarLayout!.widgets!.b.page=4;
  const result=commitDashboardDraft(live,base,draft);expect(result.quickbarLayout!.widgets!.a.color).toBe('#123456');expect(result.quickbarLayout!.widgets!.b.page).toBe(4);
 });
 it('merges independent resource settings with remote consumption and independent new resources',()=>{
  const base=card(),draft=createDashboardDraft(base),live=structuredClone(base);draft.runtime.resources.a.name='新名称';addResourceModule(draft,template('orbit'),1,()=> 'local');
  live.runtime.resources.a.current=2;live.runtime.resources.remote=resource('远端新增');
  const result=commitDashboardDraft(live,base,draft);expect(result.runtime.resources.a).toMatchObject({name:'新名称',current:2});expect(result.runtime.resources.local).toBeDefined();expect(result.runtime.resources.remote).toEqual(live.runtime.resources.remote);expect(dashboardOverlaps(visible(result)).count).toBe(0);
 });
 it('rejects same-field conflicts and leaves all three inputs unchanged',()=>{
  const base=card(),draft=createDashboardDraft(base),live=structuredClone(base);draft.runtime.resources.a.current=1;live.runtime.resources.a.current=2;const before=[base,draft,live].map(c=>structuredClone(c));
  expect(()=>commitDashboardDraft(live,base,draft)).toThrow('此字段已由其他玩家修改');expect([base,draft,live]).toEqual(before);
 });
 it('rejects direct draft collisions and collisions introduced by otherwise independent remote movement',()=>{
  const base=card(),draft=createDashboardDraft(base),live=structuredClone(base);draft.quickbarLayout!.widgets!.a.x=6;expect(()=>commitDashboardDraft(live,base,draft)).toThrow('模块有重叠');
  draft.quickbarLayout!.widgets!.a.x=9;live.quickbarLayout!.widgets!.b.x=9;const before=[base,draft,live].map(c=>structuredClone(c));expect(()=>commitDashboardDraft(live,base,draft)).toThrow('模块有重叠');expect([base,draft,live]).toEqual(before);
 });
 it('ignores hidden module geometry when checking visible collisions but refuses them after restoring the module',()=>{
  const base=card(),draft=createDashboardDraft(base);draft.quickbarLayout!.widgets!.a.x=6;draft.quickbarLayout!.hidden.push('resource:a');expect(()=>commitDashboardDraft(base,base,draft)).not.toThrow();
  draft.quickbarLayout!.hidden=[];expect(()=>commitDashboardDraft(base,base,draft)).toThrow('模块有重叠');
 });
 it('detects concurrent resource modifications before deletion, and permits an unchanged unlocked deletion',()=>{
  const base=card(),draft=createDashboardDraft(base),live=structuredClone(base);delete draft.runtime.resources.a;delete draft.quickbarLayout!.widgets!.a;live.runtime.resources.a.current=1;
  expect(()=>commitDashboardDraft(live,base,draft)).toThrow('此字段已由其他玩家修改');expect(commitDashboardDraft(base,base,draft).runtime.resources.a).toBeUndefined();
 });
 it('rechecks live locks for data changes while allowing presentation changes and explicit GM edits',()=>{
  const base=card(),draft=createDashboardDraft(base),live=structuredClone(base);live.runtime.resources.a.locked=true;draft.quickbarLayout!.widgets!.a.color='#123456';
  expect(commitDashboardDraft(live,base,draft).runtime.resources.a.locked).toBe(true);draft.runtime.resources.a.name='被修改';expect(()=>commitDashboardDraft(live,base,draft)).toThrow('资源已锁定');expect(commitDashboardDraft(live,base,draft,{gm:true}).runtime.resources.a).toMatchObject({name:'被修改',locked:true});
  delete draft.runtime.resources.a;expect(()=>commitDashboardDraft(live,base,draft)).toThrow('资源已锁定');
 });
 it('prevents automatic resource deletion and cross-character saving',()=>{
  const base=card();base.runtime.resources.a.automatic=true;const draft=createDashboardDraft(base);delete draft.runtime.resources.a;expect(()=>commitDashboardDraft(base,base,draft,{gm:true})).toThrow('自动资源');
  expect(()=>commitDashboardDraft({...base,id:'other'},base,createDashboardDraft(base))).toThrow('角色已切换');
 });
 it('rejects invalid draft geometry before normalization can conceal it',()=>{
  const base=card(),draft=createDashboardDraft(base);draft.quickbarLayout!.widgets!.a.x=30;expect(()=>commitDashboardDraft(base,base,draft)).toThrow('资源模块布局无效');
 });
});
