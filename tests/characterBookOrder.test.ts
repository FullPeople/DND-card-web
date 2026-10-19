import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

describe('character book order preferences',()=>{
 let saved:Map<string,string>;
 const rows=()=>['a','b','c','d','e'].map(id=>({id,name:`Authored ${id}`,hp:12}));
 beforeEach(()=>{vi.resetModules();saved=new Map();vi.stubGlobal('localStorage',{getItem:(key:string)=>saved.get(key)??null,setItem:(key:string,value:string)=>saved.set(key,value)});});
 afterEach(()=>vi.unstubAllGlobals());
 it('keeps newly added characters stable and never changes character objects',async()=>{
  const {orderedCharacters}=await import('../src/ui/characterBookOrder');const input=rows(),before=JSON.stringify(input);
  expect(orderedCharacters(input,['c','a','removed']).map(row=>row.id)).toEqual(['c','a','b','d','e']);
  expect(JSON.stringify(input)).toBe(before);expect(orderedCharacters(input)[0]).toBe(input[0]);
 });
 it('persists a drop before or after a target without dropping hidden rows',async()=>{
  const {placeCharacter,orderedCharacters}=await import('../src/ui/characterBookOrder');const input=rows();
  placeCharacter(input,'a','d',true);expect(orderedCharacters(input).map(row=>row.id)).toEqual(['b','c','d','a','e']);
  expect(JSON.parse(saved.get('dnd-character-book-order:local')!)).toEqual(['b','c','d','a','e']);
  placeCharacter(input,'a','b',false);expect(orderedCharacters(input).map(row=>row.id)).toEqual(['a','b','c','d','e']);
 });
 it('ignores a card removed during dragging and an unavailable drop target',async()=>{
  const {placeCharacter,orderedCharacters}=await import('../src/ui/characterBookOrder');const input=rows();
  placeCharacter(input,'removed','a',false);placeCharacter(input,'a','removed',true);placeCharacter(input,'a','a',true);
  expect(saved.size).toBe(0);expect(orderedCharacters(input).map(row=>row.id)).toEqual(['a','b','c','d','e']);
 });
 it('supports keyboard movement and ignores boundary movement',async()=>{
  const {moveCharacter,orderedCharacters}=await import('../src/ui/characterBookOrder');const input=rows();
  moveCharacter(input,'a',-1);moveCharacter(input,'e',1);expect(saved.size).toBe(0);
  moveCharacter(input,'b',1);expect(orderedCharacters(input).map(row=>row.id)).toEqual(['a','c','b','d','e']);
 });
 it('restores the chosen order on reopening the application',async()=>{
  const first=await import('../src/ui/characterBookOrder');first.placeCharacter(rows(),'e','a',false);vi.resetModules();
  const restored=await import('../src/ui/characterBookOrder');expect(restored.orderedCharacters(rows()).map(row=>row.id)).toEqual(['e','a','b','c','d']);
 });
 it('keeps characters accessible if the preference is damaged or writing fails',async()=>{
  saved.set('dnd-character-book-order:local','not json');
  const {orderedCharacters,moveCharacter}=await import('../src/ui/characterBookOrder');
  expect(orderedCharacters(rows()).map(row=>row.id)).toEqual(['a','b','c','d','e']);
  vi.stubGlobal('localStorage',{setItem:()=>{throw Error('quota');}});moveCharacter(rows(),'b',1);
  expect(orderedCharacters(rows()).map(row=>row.id)).toEqual(['a','c','b','d','e']);
 });
});
