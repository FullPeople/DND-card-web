import {expect,it} from 'vitest';
import type {Entry} from '../src/core/model';
import {catalogTrainingIndex} from '../src/ui/catalogTrainingIndex';

const entry=(name:string,english:string,kind:Entry['kind']='item',category?:string)=>({id:name+':'+english,source:'fixture',edition:'2024',packId:'fixture',revision:'1',entries:[],name,english,kind,raw:{_category:category}} satisfies Entry);
it('keeps source identity and ordering for labels shared across editions',()=>{
 const first=entry('共同名称','Shared'),second=entry('共同名称','SHARED');
 const index=catalogTrainingIndex([first,second]);expect(index.get('共同名称')).toEqual([first,second]);expect(index.get('shared')).toEqual([first,second]);
});
it('includes language entries and preserves repeated identical labels',()=>{
 const language=entry('Common','Common','background','language'),ignored=entry('Ignored','Ignored','background');
 const index=catalogTrainingIndex([language,ignored]);expect(index.get('common')).toEqual([language,language]);expect(index.has('ignored')).toBe(false);
});
it('shares an immutable catalog index across cards and invalidates a replacement catalog',()=>{
 const first=entry('First','First'),second=entry('Second','Second'),catalog=[first];
 const prepared=catalogTrainingIndex(catalog);expect(catalogTrainingIndex(catalog)).toBe(prepared);
 const replacement=catalogTrainingIndex([...catalog,second]);expect(replacement).not.toBe(prepared);expect(replacement.get('second')).toEqual([second,second]);expect(prepared.has('second')).toBe(false);expect(catalog).toEqual([first]);
});
