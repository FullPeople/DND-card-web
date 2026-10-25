import {expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LibraryFilters} from '../src/ui/LibraryFilters';
import type {Entry} from '../src/core/model';

it('does not enumerate catalog facets while the filter dialog is closed',()=>{
 let reads=0;
 const entries:Entry[]=Array.from({length:2000},(_,index)=>({id:`authored-${index}`,kind:'spell',name:`Authored ${index}`,english:'Authored',source:'XPHB',edition:'2024',packId:'authored',revision:'1',entries:[],get raw(){reads++;return {level:index%10};}}));
 const html=renderToStaticMarkup(createElement(LibraryFilters,{tab:'spell',entries,filters:{level:{include:['1'],exclude:[]}},change:()=>{},names:{}}));
 expect(html).toContain('筛选');
 expect(html).not.toContain('<dialog');
 expect(reads).toBe(0);
});
