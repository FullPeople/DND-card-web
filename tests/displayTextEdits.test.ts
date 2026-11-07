// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import {isValidElement,type ReactNode} from 'react';
import {BackgroundPage,type Edit,type PageProps} from '../src/ui/CharacterPages';
import {newCharacter,type Character} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {applyDisplayCharacterEdit,sameCharacterMechanics} from '../src/core/displayCharacterEdit';
import {runtimeCharacterBase,applyRuntimeCharacterEdit,resourceBalanceEdit} from '../src/core/runtimeCharacterEdit';
import {standaloneCardViews,prepareStandaloneCards} from '../src/platform/standaloneCardViews';
import {snapshotMemo} from '../src/platform/snapshotMemo';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {applyCharacterHistoryPatch} from '../src/ui/characterHistoryPatch';
import {readCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
import {displayBiographyEdit,displayIdentityEdit,displayCharacterEdit} from '../src/core/displayCharacterEdit';
import {syncFeatures} from '../src/core/sheet';
import {syncAutoResources} from '../src/core/resources';

function card(){
 const c=newCharacter();c.automation=newAutomationState();c.notes='Original fallback story';
 c.runtime.resources.manual={name:'Authored reserve',current:2,max:9};
 c.selections=[{id:'authored-feature',entry:{id:'authored-feature',kind:'feature',name:'Authored feature',english:'Authored feature',source:'XPHB',edition:'2024',revision:'1',packId:'fixture',entries:['Authored regression text.'],raw:{}},level:1,quantity:1,equipped:false}];
 (c as any).futurePrivateField={preserve:'opaque'};return c;
}
function actionFor(c:Character,label:string,value:string){
 let action:Parameters<Edit>[0]|undefined;
 const element=BackgroundPage({c,edit:next=>{action=next;}} as PageProps);
 function visit(node:ReactNode){
  if(Array.isArray(node)){node.forEach(visit);return;}
  if(!isValidElement(node))return;
  const props=node.props as {label?:string;change?:(value:string)=>void;children?:ReactNode};
  if(props.label===label&&props.change)props.change(value);
  else visit(props.children);
 }
 visit(element);expect(action,`BackgroundPage must wire ${label}`).toBeDefined();return action!;
}
const fields=[['角色名','name'],['玩家','player'],['背景故事','biography.story'],['故乡','biography.hometown'],['身高','biography.height'],['体重','biography.weight'],['个性','biography.traits'],['理念','biography.ideals'],['羁绊','biography.bonds'],['缺陷','biography.flaws'],['背景描述','biography.backgroundDescription'],['年龄','identity.age'],['性别','identity.gender'],['阵营','identity.alignment'],['人物形象','identity.description']];

it.each(fields)('the actual %s field changes only its declared text and preserves mechanics (%s)',(label,path)=>{
 const c=card(),original=structuredClone(c),next=applyDisplayCharacterEdit(c,actionFor(c,label,'Authored changed text'));
 expect(next,`${label} must use the explicit display route`).toBeDefined();
 const expected=structuredClone(original),[key,nested]=path.split('.');if(nested)((expected as any)[key]||={})[nested]='Authored changed text';else (expected as any)[key]='Authored changed text';
 expect(next).toEqual(expected);expect(c).toEqual(original);expect(next!.selections).toBe(c.selections);expect(next!.runtime).toBe(c.runtime);expect(next!.profile).toBe(c.profile);
 expect(sameCharacterMechanics(c,next!)).toBe(true);expect(runtimeCharacterBase(next!)).toBe(c);
 expect(applyDisplayCharacterEdit(next!,actionFor(next!,label,'Authored changed text'))).toBe(next);
});

it('typing text reuses completed construction, choices and reconciliation within the same rule context',async()=>{
 const c=card(),memo=snapshotMemo(),counts:Record<string,number>={};
 const remember:ReturnType<typeof snapshotMemo>=(scope,snapshot,compute)=>memo(scope,snapshot,()=>{counts[scope]=(counts[scope]||0)+1;return compute();});
 const entries=c.selections.map(row=>row.entry),views=standaloneCardViews(entries,undefined,[],remember),sync=vi.fn(syncSourceSpells);
 await prepareStandaloneCards([c],views,{signal:new AbortController().signal,current:()=>true,yield:async()=>{}});views.warmReconciliation(c,sync);
 const build=views.build(c),before={...counts};let live=c;
 for(const text of ['一','一段','一段新的故事']){
  live=applyDisplayCharacterEdit(live,actionFor(live,'背景故事',text))!;expect(live).toBeDefined();
  expect(views.build(live)).toBe(build);expect(views.display(live).biography?.story).toBe(text);
  expect(views.ready(live)).toBe(true);expect(views.reconciliationReady(live)).toBe(true);
  await prepareStandaloneCards([live],views,{signal:new AbortController().signal,current:()=>true,yield:async()=>{}});views.warmReconciliation(live,sync);
 }
 expect(counts).toEqual({...before,display:before.display+3});expect(sync).toHaveBeenCalledTimes(1);expect(c.biography).toBeUndefined();
 const nextContext=standaloneCardViews(entries,{...c.profile,enabledSources:[]},[],snapshotMemo());
 expect(nextContext.ready(live)).toBe(false);expect(nextContext.reconciliationReady(live)).toBe(false);expect(nextContext.build(live).profile.enabledSources).toEqual([]);
});

it('interleaves text and spent balances without reviving old text, resources, or unknown data',()=>{
 const c=card(),first=applyDisplayCharacterEdit(c,actionFor(c,'背景故事','First text'))!;expect(first).toBeDefined();
 const spent=applyRuntimeCharacterEdit(first,resourceBalanceEdit('manual',1))!,last=applyDisplayCharacterEdit(spent,actionFor(spent,'人物形象','New description'))!;
 const views=standaloneCardViews([],undefined,[],snapshotMemo()),display=views.display(last);
 expect(display.biography?.story).toBe('First text');expect(display.identity.description).toBe('New description');expect(display.runtime.resources.manual.current).toBe(1);expect(c.runtime.resources.manual.current).toBe(2);
 const reopened=readCharacter(exportCharacter(last)).character;expect(reopened.biography).toEqual(last.biography);expect(reopened.identity).toEqual(last.identity);expect(reopened.runtime.resources.manual.current).toBe(1);expect((reopened as any).futurePrivateField).toEqual({preserve:'opaque'});
});

it('text Undo and Redo preserve unchanged references and concurrent balances and reject stale field overwrites',()=>{
 const c=card(),after=applyDisplayCharacterEdit(c,actionFor(c,'背景故事','New text'))!;expect(after).toBeDefined();
 const live=applyRuntimeCharacterEdit(after,resourceBalanceEdit('manual',1))!,before=JSON.stringify(live),authority=()=>({canEdit:true,gm:false});
 const undo=applyCharacterHistoryPatch(live,after,c,authority);
 expect(undo.biography).toBeUndefined();expect(undo.selections).toBe(live.selections);expect(undo.runtime).toBe(live.runtime);expect(runtimeCharacterBase(undo)).toBe(runtimeCharacterBase(live));
 const redo=applyCharacterHistoryPatch(undo,c,after,authority);expect(redo.biography?.story).toBe('New text');expect(redo.runtime.resources.manual.current).toBe(1);expect(redo.selections).toBe(live.selections);expect(JSON.stringify(live)).toBe(before);
 const concurrent=applyDisplayCharacterEdit(live,actionFor(live,'背景故事','Concurrent text'))!;expect(()=>applyCharacterHistoryPatch(concurrent,after,c,authority)).toThrow();expect(concurrent.biography?.story).toBe('Concurrent text');
});

it('unknown future identity/biography data still invalidates mechanics and ordinary callbacks stay untrusted',()=>{
 const c=card();expect(sameCharacterMechanics(c,{...c,identity:{...c.identity,futureMechanic:'new'}} as Character)).toBe(false);
 expect(sameCharacterMechanics(c,{...c,biography:{futureMechanic:'new'}} as Character)).toBe(false);
 expect(applyDisplayCharacterEdit(c,d=>{d.identity.age='99';d.baseHp=99;})).toBeUndefined();
 expect(applyDisplayCharacterEdit(c,displayCharacterEdit('profile' as never,{} as never))).toBeUndefined();
 expect(applyDisplayCharacterEdit(c,displayBiographyEdit('futureMechanic' as never,'new'))).toBeUndefined();
 expect(applyDisplayCharacterEdit(c,displayIdentityEdit('futureMechanic' as never,'new'))).toBeUndefined();
});

it('does not overlay an uninitialized stored runtime over the completed legacy view',()=>{
 const c=card();delete c.automation;const changed=applyDisplayCharacterEdit(c,displayBiographyEdit('story','Legacy text'))!;
 const views=standaloneCardViews([],undefined,[],snapshotMemo()),built=views.build(c),display=views.display(changed);
 expect(built.automation).toBeDefined();expect(display.automation).toEqual(built.automation);expect(display.runtime).toBe(built.runtime);expect(display.biography?.story).toBe('Legacy text');expect(c.automation).toBeUndefined();
});

it('text history reads current authority and does not mutate a denied or conflicting live snapshot',()=>{
 const c=card(),after=applyDisplayCharacterEdit(c,displayBiographyEdit('story','New text'))!,before=JSON.stringify(after);let reads=0;
 for(const authority of [{canEdit:false,gm:true},{canEdit:'true',gm:false}] as any[]){expect(()=>applyCharacterHistoryPatch(after,after,c,()=>{reads++;return authority;})).toThrow(/权限|只读/);expect(JSON.stringify(after)).toBe(before);}
 expect(reads).toBe(2);
});

it('text undo preserves a concurrently added biography field and uses no whole-card clone or normalization',()=>{
 const c=card(),after=applyDisplayCharacterEdit(c,displayBiographyEdit('story','Story'))!,live=applyDisplayCharacterEdit(after,displayBiographyEdit('hometown','Concurrent town'))!;
 const normalize=vi.fn(()=>{throw Error('Text history must not normalize unrelated sources');}),clone=vi.spyOn(globalThis,'structuredClone');
 try{const undone=applyCharacterHistoryPatch(live,after,c,()=>({canEdit:true}),{normalize});expect(undone.biography).toEqual({hometown:'Concurrent town'});expect(undone.runtime).toBe(live.runtime);expect(normalize).not.toHaveBeenCalled();expect(clone).not.toHaveBeenCalled();}finally{clone.mockRestore();}
});

it('a genuine level change after text still invalidates construction and grants features without restoring spent uses',()=>{
 const c=card(),owner={id:'authored-class',entry:{...c.selections[0].entry,id:'authored-class',kind:'class' as const,name:'Authored class',english:'Authored class',raw:{classFeatures:['Later|Authored class|XPHB|2'],casterProgression:'full',hd:{faces:8}}},level:1,quantity:1,equipped:false};
 const feature={...c.selections[0].entry,id:'later-feature',name:'Later',english:'Later',raw:{className:'Authored class',classSource:'XPHB',level:2}},entries=[owner.entry,feature];
 c.selections.push(owner);syncFeatures(c,entries);syncAutoResources(c);c.runtime.resources['spell-slot:1'].current=1;
 const text=applyDisplayCharacterEdit(c,displayBiographyEdit('story','Keep this story'))!,views=standaloneCardViews(entries,undefined,[],snapshotMemo()),built=views.build(text);
 const changed=structuredClone(text);changed.selections.find(row=>row.id===owner.id)!.level=2;syncFeatures(changed,entries);syncAutoResources(changed,text);
 expect(runtimeCharacterBase(changed)).toBe(changed);expect(views.build(changed)).not.toBe(built);expect(changed.selections.some(row=>row.entry.id===feature.id)).toBe(true);
 const slots=changed.runtime.resources['spell-slot:1'];expect(slots.max).toBe(3);expect(slots.max-slots.current).toBe(c.runtime.resources['spell-slot:1'].max-c.runtime.resources['spell-slot:1'].current);
 const reference=structuredClone(c);reference.selections.find(row=>row.id===owner.id)!.level=2;syncFeatures(reference,entries);syncAutoResources(reference,c);expect(changed.runtime).toEqual(reference.runtime);
 expect(changed.runtime.resources.manual.current).toBe(2);expect(changed.biography?.story).toBe('Keep this story');expect(c.selections.find(row=>row.id===owner.id)!.level).toBe(1);
});
