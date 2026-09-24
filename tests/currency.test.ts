import {expect,it} from 'vitest';
import {normalizeCurrency,currencyRows} from '../src/core/currency';
import {importOwlbear} from '../src/core/validation';
it('reads stable 2014/2024 wallet objects without rendering or double-counting aggregate fields',()=>{
 const raw={wallet:{gp:12,pp:1,ep:0,sp:3,cp:4},total_gp:22.34,total_gp_raw:'22.34GP'},before=structuredClone(raw);
 expect(normalizeCurrency(raw)).toEqual({cp:4,sp:3,ep:0,gp:12,pp:1});expect(raw).toEqual(before);
 expect(currencyRows(raw)).toEqual([{coin:'cp',name:'铜币',amount:4},{coin:'sp',name:'银币',amount:3},{coin:'gp',name:'金币',amount:12},{coin:'pp',name:'铂金币',amount:1}]);
 expect(normalizeCurrency({wallet:{gp:0},total_gp:50})).toEqual({gp:0});
});
it('reads flat projections, nested wrappers and legacy numeric strings conservatively',()=>{
 expect(normalizeCurrency({gp:'12.5',sp:4})).toEqual({gp:12.5,sp:4});
 expect(normalizeCurrency({currency:{wallet:{pp:3}}})).toEqual({pp:3});
 expect(normalizeCurrency({coins:{cp:2}})).toEqual({cp:2});
 expect(normalizeCurrency('13.5 GP')).toEqual({gp:13.5});expect(normalizeCurrency('5sp')).toEqual({sp:5});
 expect(normalizeCurrency(7)).toEqual({gp:7});expect(normalizeCurrency('7')).toEqual({gp:7});
 expect(normalizeCurrency({total_gp:12})).toEqual({gp:12});expect(normalizeCurrency({total_gp_raw:'12GP'})).toEqual({gp:12});
});
it('never promotes arbitrary nested objects, arrays, booleans, invalid numbers or text into coin rows',()=>{
 for(const raw of [undefined,null,[],true,NaN,Infinity,-1,'','no gold','{"gp":2}',{gp:{value:4},sp:true,ep:-1,pp:Infinity,cp:'oops',other:{gp:2}}])expect(currencyRows(raw)).toEqual([]);
 expect(currencyRows({gp:{gp:2},cp:4})).toEqual([{coin:'cp',name:'铜币',amount:4}]);
 const cycle:Record<string,unknown>={};cycle.wallet=cycle;expect(currencyRows(cycle)).toEqual([]);
});
it('imports both stable spreadsheet wallet and native coin projections without discarding amounts',()=>{
 const document={schema_version:'0.3',identity:{character_name:'金币导入测试'},abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(key=>[key,{total:10}]))};
 const wallet={gp:19,pp:2,cp:1,sp:3,ep:4};
 expect(importOwlbear({...document,inventory:{currency:{wallet,total_gp:41.31}}}).inventory?.coins).toEqual(wallet);
 expect(importOwlbear({...document,inventory:{coins:wallet}}).inventory?.coins).toEqual(wallet);
});
