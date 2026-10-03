import {irCharacter as newCharacter,irFixture} from './helpers/irFixture';
import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NumberInput} from '../src/ui/NumberInput';

import {evaluate} from '../src/core/engine';
import {traceForInput} from '../src/ui/ValueTrace';

it('renders the derived score in both normal and idle edit modes, retaining the stored base for tracing',()=>{
 const c=newCharacter('2014');c.abilities.con=14;c.selections=[{id:'race',entry:irFixture({id:'race',name:'原创建模种族',english:'Original Race',kind:'race',source:'PHB',edition:'2014',packId:'fixture',revision:'1',raw:{ability:[{con:2}]},entries:[]}),level:1,quantity:1,equipped:false}];
 const d=evaluate(c);
 for(const readOnly of [true,false]){
  const html=renderToStaticMarkup(createElement(NumberInput,{value:c.abilities.con,displayValue:d.abilities.con,readOnly,'aria-label':'体质基础值'}));
  expect(html).toContain('value="16"');expect(html).not.toContain('displayValue');
 }
 const trace=traceForInput({c,d,open:()=>{}},'体质基础值',c.abilities.con,()=>{});expect(trace).toMatchObject({value:14,result:16});expect(c.abilities.con).toBe(14);
});
it('keeps ordinary number input and zero-valued display semantics unchanged',()=>{
 expect(renderToStaticMarkup(createElement(NumberInput,{value:14}))).toContain('value="14"');
 expect(renderToStaticMarkup(createElement(NumberInput,{value:14,displayValue:0}))).toContain('value="0"');
});
