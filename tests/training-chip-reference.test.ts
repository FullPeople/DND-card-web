import {it,expect,vi} from 'vitest';
vi.mock('../src/ui/SheetEdit',async()=>({SheetEditContext:(await import('react')).createContext(false)}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:()=>()=>{},landingWithin:()=>({})}));
vi.mock('../src/platform/workbench',()=>({inWorkbench:false,workbenchRequest:()=>Promise.resolve(),composeRoll:()=>{}}));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {trainingChipReference} from '../src/core/trainingChipReference';
import {resolveEntryReference} from '../src/core/entryReferences';
import type {Entry} from '../src/core/model';
import {TrainingChips} from '../src/ui/TrainingChips';
import {ReferenceContext} from '../src/ui/Reference';
const names=[['battleaxe','战斧'],['handaxe','手斧'],['light hammer','轻锤'],['warhammer','战锤'],['dagger','匕首']] as const;
const entries:Entry[]=names.map(([english,name])=>({id:`fixture:${english}`,kind:'item',name,english,source:'PHB',edition:'2014',packId:'fixture',revision:'1',raw:{type:'M'},entries:['原创熟练标签验收。']}));
const resolve=(reference:string)=>resolveEntryReference(reference,entries,'item');
it.each(names)('resolves the %s entity label without changing its qualified reference', (english,name)=>{
 for(const value of [`${english}|PHB`,`{@item ${english}|PHB}`]){
  const before=trainingChipReference(value,'item');expect(before).toMatchObject({reference:`${english}|PHB`,kind:'item',label:english});
  const after=trainingChipReference(value,'item',resolve);expect(after).toMatchObject({reference:`${english}|PHB`,kind:'item',label:name,entry:entries.find(e=>e.english===english)});
 }
});
it('honors explicit captions and sources, and does not invent unknown translations',()=>{
 expect(trainingChipReference('battleaxe|PHB|我的斧头','item',resolve).label).toBe('我的斧头');
 expect(trainingChipReference('battleaxe|XPHB','item',resolve)).toMatchObject({reference:'battleaxe|XPHB',label:'battleaxe',entry:undefined});
 expect(trainingChipReference('原创未知武器|HOME','item',resolve)).toMatchObject({reference:'原创未知武器|HOME',label:'原创未知武器',entry:undefined});
 expect(trainingChipReference('玩家手写的熟练说明','item',resolve).label).toBe('玩家手写的熟练说明');
});
it('renders updated labels when the catalog arrives while retaining raw UID links and save values',()=>{
 const value=names.map(([english])=>`${english}|PHB`).join('、'),saved:string[]=[];
 const render=(ready:boolean)=>renderToStaticMarkup(createElement(ReferenceContext.Provider,{value:{resolve:ready?resolve:()=>undefined,show:()=>{},move:()=>{},leave:()=>{},close:()=>{}}},createElement(TrainingChips,{label:'武器',value,onChange:value=>saved.push(value)})));
 const before=render(false),after=render(true);
 for(const [english,name] of names){expect(before).toContain(`>${english}</button>`);expect(after).toContain(`>${name}</button>`);expect(after).toContain(`data-reference="item:${english}|PHB"`);}
 expect(after).not.toContain('>battleaxe|PHB<');expect(saved).toEqual([]);
});
