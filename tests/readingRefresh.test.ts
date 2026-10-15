import {expect,test} from 'vitest';
import {ReadingRefresh} from '../src/data/readingRefresh';

test('a completed explicit update does not force later reading-tab navigation to download again',()=>{
 const refresh=new ReadingRefresh(),revision=refresh.request(['entry:a']);
 expect(refresh.pending('entry:a')).toBe(revision);refresh.complete('entry:a',revision);
 expect(refresh.pending('entry:a')).toBeUndefined();expect(refresh.pending('entry:b')).toBeUndefined();
});
test('an interrupted read keeps its explicit update intent for the same target but not other books',()=>{
 const refresh=new ReadingRefresh(),revision=refresh.request(['book:list','book:a']);
 refresh.complete('book:list',revision);
 expect(refresh.pending('book:list')).toBeUndefined();expect(refresh.pending('book:a')).toBe(revision);expect(refresh.pending('book:b')).toBeUndefined();
});
test('a late completion cannot consume a newer requested update',()=>{
 const refresh=new ReadingRefresh(),first=refresh.request(['entry:a']),second=refresh.request(['entry:a']);
 refresh.complete('entry:a',first);expect(refresh.pending('entry:a')).toBe(second);
 refresh.complete('entry:a',second);expect(refresh.pending('entry:a')).toBeUndefined();
});
test('a newly selected explicit update replaces older cancelled targets',()=>{
 const refresh=new ReadingRefresh();refresh.request(['book:list','book:a']);const latest=refresh.request(['book:list','book:b']);
 expect(refresh.pending('book:a')).toBeUndefined();expect(refresh.pending('book:list')).toBe(latest);expect(refresh.pending('book:b')).toBe(latest);
});
