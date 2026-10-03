import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {CompactResource,CompactResourceGrid} from '../src/ui/CompactResources';
import type {ResourceValue} from '../src/ui/resourcePresets';
import {WIDGET_STYLES,resourceModules,type ResourceModule,type WidgetStyle,type WidgetIcon} from '../src/core/resourceWidgets';

const resource={id:'test',name:'动作如潮',current:2,max:4,type:'count',locked:true};
const child=createElement('span',{'data-operation-state':'mounted'},'待确认操作');
const render=(style:WidgetStyle,icon:WidgetIcon='shield',extra={})=>renderToStaticMarkup(createElement(CompactResource,{resource:{...resource,...extra},layout:{style,color:'#334455',icon},children:child}));

describe('220 compact resource presentation preserves operation containers',()=>{
 it.each(WIDGET_STYLES)('renders %s with the same runtime values and appearance metadata',style=>{
  const html=render(style);
  expect(html).toContain(`data-module-style="${style}"`);
  expect(html).toContain('--rm-icon-tone:#334455');
  expect(html).toContain('data-resource-current="2"');
  expect(html).toContain('动作如潮：2 / 4，打开资源操作');
  expect(html).toContain('aria-label="已锁定"');
 });
 it('keeps old style markers while rendering their supported aliases',()=>{
  expect(render('bar')).toContain('widget-bar');expect(render('bar')).toContain('data-module-style="segments"');
  expect(render('icon')).toContain('widget-icon');expect(render('icon')).toContain('data-module-style="pips"');
 });
 it('keeps operation content mounted before a popover is opened',()=>{
  const html=render('ring');expect(html).toContain('aria-expanded="false"');expect(html).toContain('popover="auto"');
  expect(html).toContain('data-operation-state="mounted"');expect(html).toContain('待确认操作');
 });
 it('passes icon selection to the new artwork without changing resource identity',()=>{
  const shield=render('pips','shield'),flame=render('pips','flame');expect(shield).not.toEqual(flame);
  expect(shield).toContain('data-resource-id="test"');expect(flame).toContain('data-resource-id="test"');
 });
 it('keeps an unbounded ring with its actual current value and no false percentage',()=>{
  const html=render('ring','spark',{current:123456,max:0,unlimited:true});
  expect(html).toContain('data-module-style="ring"');expect(html).toContain('123456，打开资源操作');expect(html).toContain('class="rm-readout"><strong>123456</strong></span>');expect(html).not.toContain('class="rm-arc"');expect(html).not.toContain('∞');expect(html).not.toContain('不限');
 });
 it('retains resource operation components on hidden pagination pages',()=>{
  const rows=Array.from({length:10},(_,i)=>({...resource,id:String(i)}));
  const html=renderToStaticMarkup(createElement(CompactResourceGrid<ResourceValue>,{rows,label:'测试资源',render:r=>createElement(CompactResource,{resource:r,children:createElement('span',{'data-operation-for':r.id},r.id)})}));
  expect(html.match(/data-operation-for=/g)).toHaveLength(10);expect(html).toContain('hidden=""');expect(html).toContain('data-operation-for="9"');
 });
});


it('overview preserves actual shared and pact pools plus custom module members without duplicated rows',()=>{
 const rows:[string,ResourceValue][]=[['spell-slot:1',{name:'一环',current:3,max:4}],['spell-slot:2',{name:'二环',current:2,max:3}],['pact-slot:2',{name:'契约二环',current:1,max:2}],['food',{name:'食物',current:4,max:8}],['water',{name:'饮水',current:5,max:10}]];
 const saved={food:{x:0,y:0,w:6,h:3,page:0,style:'poolbars' as const,members:['food','water'],label:'远行物资',color:'#334455',icon:'leaf' as const}};
 const modules=resourceModules(rows,saved);
 expect(modules.map(m=>[m.name,m.rows.map(([id])=>id)])).toEqual([['法术位',['spell-slot:1','spell-slot:2']],['契约法术位',['pact-slot:2']],['远行物资',['food','water']]]);
 const html=renderToStaticMarkup(createElement(CompactResourceGrid<ResourceModule>,{rows:modules,label:'池',render:module=>createElement(CompactResource,{resource:module.rows[0][1],module,layout:saved[module.id as keyof typeof saved],render:r=>createElement('span',{'data-operation-for':r.id},r.name)})}));
 expect(html.match(/data-operation-for=/g)).toHaveLength(5);expect(html.match(/data-resource-pool="spell"/g)).toHaveLength(2);expect(html).toContain('data-module-style="poolbars"');expect(html).toContain('--rm-icon-tone:#334455');
 expect(html).toContain('>I</b>');expect(html.match(/>II<\/b>/g)).toHaveLength(2);
});
