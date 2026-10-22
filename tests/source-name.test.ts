import {expect,test} from 'vitest';
import {mergeSourceRegistry,SOURCE_SEED,type SourceMeta} from '../src/ui/SourceName';

const original:SourceMeta={name:'Authored source',date:'2026-01-01',category:'第三方'};

test('empty and repeated effective metadata retain the registry and source references',()=>{
 const first=mergeSourceRegistry(SOURCE_SEED,{TEST_SOURCE:original}),entry=first.TEST_SOURCE;
 expect(mergeSourceRegistry(first,{})).toBe(first);
 expect(mergeSourceRegistry(first,{TEST_SOURCE:{...original}})).toBe(first);
 expect(first.TEST_SOURCE).toBe(entry);
 expect(SOURCE_SEED.TEST_SOURCE).toBeUndefined();
});

test.each([
 {name:'Updated source'},
 {date:'2026-02-01'},
 {category:'核心规则' as const},
])('a real SourceMeta change publishes a new immutable registry: %j',change=>{
 const before=mergeSourceRegistry(SOURCE_SEED,{TEST_SOURCE:original,TEST_OTHER:{name:'Other source'}});
 const after=mergeSourceRegistry(before,{TEST_SOURCE:{...original,...change}});
 expect(after).not.toBe(before);
 expect(after.TEST_SOURCE).toEqual({...original,...change});
 expect(after.TEST_SOURCE).not.toBe(before.TEST_SOURCE);
 expect(after.TEST_OTHER).toBe(before.TEST_OTHER);
 expect(before.TEST_SOURCE).toEqual(original);
 expect(mergeSourceRegistry(after,{TEST_SOURCE:{...original,...change}})).toBe(after);
});

test('seed names and categories keep precedence without notifying for ineffective overrides',()=>{
 const [id,meta]=Object.entries(SOURCE_SEED).find(([,meta])=>!!meta.category)!;
 const ignored={...meta,name:'Ignored authored name',category:'第三方' as const};
 expect(mergeSourceRegistry(SOURCE_SEED,{[id]:ignored})).toBe(SOURCE_SEED);
 const changed=mergeSourceRegistry(SOURCE_SEED,{[id]:{...ignored,date:'2099-01-01'}});
 expect(changed[id]).toEqual({...meta,date:'2099-01-01'});
});

test('an existing adventure classification survives a third-party update while other fields change',()=>{
 const before=mergeSourceRegistry({}, {TEST_ADVENTURE:{name:'Authored adventure',category:'模组内容',date:'2026-01-01'}});
 expect(mergeSourceRegistry(before,{TEST_ADVENTURE:{name:'Authored adventure',category:'第三方',date:'2026-01-01'}})).toBe(before);
 const after=mergeSourceRegistry(before,{TEST_ADVENTURE:{name:'Updated adventure',category:'第三方',date:'2026-02-01'}});
 expect(after.TEST_ADVENTURE).toEqual({name:'Updated adventure',category:'模组内容',date:'2026-02-01'});
});

test('equal display names retain distinct source IDs',()=>{
 const result=mergeSourceRegistry({}, {TEST_A:original,TEST_B:{...original,date:'2026-02-01'}});
 expect(Object.keys(result)).toEqual(['TEST_A','TEST_B']);
 expect(result.TEST_A.date).toBe('2026-01-01');
 expect(result.TEST_B.date).toBe('2026-02-01');
});

test('explicit undefined retains the original spread behavior and becomes idempotent',()=>{
 const before=mergeSourceRegistry({}, {TEST_SOURCE:original});
 const after=mergeSourceRegistry(before,{TEST_SOURCE:{name:original.name,date:undefined}});
 expect(after).not.toBe(before);
 expect(after.TEST_SOURCE).toEqual({name:original.name,date:undefined,category:'第三方'});
 expect(Object.hasOwn(after.TEST_SOURCE,'date')).toBe(true);
 expect(mergeSourceRegistry(after,{TEST_SOURCE:{name:original.name,date:undefined}})).toBe(after);
});

test('runtime metadata fields are retained and compared along with all typed fields',()=>{
 const next={...original,authoredTag:'first'},before=mergeSourceRegistry({}, {TEST_SOURCE:next});
 expect(mergeSourceRegistry(before,{TEST_SOURCE:{...next}})).toBe(before);
 const updated={...next,authoredTag:'second'},after=mergeSourceRegistry(before,{TEST_SOURCE:updated});
 expect(after).not.toBe(before);
 expect(after.TEST_SOURCE).toEqual({...original,authoredTag:'second'});
 expect(mergeSourceRegistry(after,{TEST_SOURCE:{...original}})).toBe(after);
});
