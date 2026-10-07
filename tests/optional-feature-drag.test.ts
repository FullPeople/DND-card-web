import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {entryDragPage} from '../src/ui/entryDragIntent';

it.each(['AI','EI'])('routes the actual normalized %s feature kind and preserves an active choice page',type=>{
 const [entry]=normalizeData({optionalfeature:[{name:'原创拖拽记录',source:type==='AI'?'TCE':'XPHB',featureType:[type],entries:[]}]},'authored-regression');
 expect(entry.kind).toBe('feature');expect(entry.raw._category).toBe('optionalfeature');
 expect(entryDragPage(entry,'entry')).toBe('特性');expect(entryDragPage(entry,'entry',true)).toBeUndefined();
});
