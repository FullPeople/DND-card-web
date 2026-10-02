import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {WIDGET_STYLES,type ResourceModule,type ResourceWidgetLayout} from '../src/core/resourceWidgets';
import {ResourceModuleFace} from '../src/ui/ResourceModuleFace';

const resource={name:'充能',current:1,max:3};
function render(style:ResourceWidgetLayout['style'],extra:Partial<typeof resource>&{unlimited?:boolean}={},layout:Partial<ResourceWidgetLayout>={}){
 const module:ResourceModule={id:'charge',name:'充能',slots:false,rows:[['charge',{...resource,...extra}]]};
 return renderToStaticMarkup(createElement(ResourceModuleFace,{module,style,layout:{x:0,y:0,w:3,h:3,page:0,style,...layout}}));
}
const visible=(html:string)=>html.replace(/<[^>]*>/g,'');
describe('fixed resource artwork and honest numeric display',()=>{
 it.each(WIDGET_STYLES)('%s keeps its selected identity when capacity changes',style=>{
  for(const value of [{current:0,max:1},{current:1,max:3},{current:99998,max:99999},{current:123456789,max:0,unlimited:true}])expect(render(style,value)).toContain(`data-module-style="${style}"`);
 });
 it.each(['pips','matrix'] as const)('%s uses exact icons without a duplicate fraction',style=>{
  const html=render(style);expect(html.match(/data-resource-unit=/g)).toHaveLength(3);expect(html.match(/is-filled/g)).toHaveLength(1);expect(visible(html)).toBe('充能');expect(html).toContain('title="充能：1 / 3"');
 });
 it('segments keep the fraction as well as exact countable units',()=>{
  const html=render('segments');expect(html.match(/data-resource-unit=/g)).toHaveLength(3);expect(visible(html)).toBe('充能1 / 3');
 });
 it.each(['orbit','segments','pips','matrix'] as const)('%s never creates false units for high, zero or unbounded capacity',style=>{
  for(const value of [{current:99998,max:99999},{current:0,max:0},{current:1.5,max:3},{current:5,max:3},{current:123456789,max:0,unlimited:true}]){
   const html=render(style,value);expect(html).not.toContain('data-resource-unit=');expect(visible(html)).toContain(String(value.current));expect(html).not.toContain('∞');if(value.unlimited)expect(visible(html)).not.toContain('/');
  }
 });
 it('single-use ready stays compact without a numeric overlay but other saved capacities remain explicit',()=>{
  expect(visible(render('ready',{current:0,max:1}))).toBe('充能');expect(render('ready',{current:0,max:1})).toContain('aria-label="已消耗"');expect(visible(render('ready',{current:2,max:3}))).toBe('充能2 / 3');
 });
 it('all unlimited single-resource faces hide a stale maximum and slash',()=>{
  for(const style of WIDGET_STYLES){const html=render(style,{current:123456789,max:99999,unlimited:true});expect(visible(html)).toContain('123456789');expect(visible(html)).not.toContain('99999');expect(visible(html)).not.toMatch(/[\/∞]/);}
 });
 it('pool icons omit redundant fractions only for individually countable rows',()=>{
  const module:ResourceModule={id:'a',name:'补给',slots:false,rows:[['a',{name:'甲',current:1,max:3}],['b',{name:'乙',current:44,max:100}],['c',{name:'丙',current:123,max:0,unlimited:true}]]};
  const html=renderToStaticMarkup(createElement(ResourceModuleFace,{module,style:'poolpips'}));expect(html.match(/data-resource-unit=/g)).toHaveLength(3);expect(html.match(/class="rm-pool-values"/g)).toHaveLength(2);expect(html).toContain('aria-label="甲：1 / 3"');expect(visible(html)).toBe('补给甲乙44 / 100丙123');
 });
 it('uniform content scaling never changes the selected outer face or input data',()=>{
  const original={x:2,y:1,w:4,h:3,page:0,style:'ring' as const,contentScale:1.6},before=JSON.stringify(original),html=render('ring',{},original);expect(html).toContain('class="rm-content"');expect(html).toContain('--rm-content-scale:1.6');expect(html).toContain('data-content-scale="1.6"');expect(JSON.stringify(original)).toBe(before);expect(render('ring',{}, {contentScale:99})).toContain('data-content-scale="2"');expect(render('ring',{}, {contentScale:Number.NaN})).toContain('data-content-scale="1"');
 });
});
