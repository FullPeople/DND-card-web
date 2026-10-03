import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {newCharacter} from '../src/core/model';
import {portraitFraming} from '../src/core/portraitFraming';
import {validateCharacter,importOwlbear} from '../src/core/validation';
import {exportCharacter,exportLinkedOwlbear} from '../src/core/export';
import {evaluate} from '../src/core/engine';
import {applyDisplayCharacterEdit,displayCharacterEdit,sameCharacterMechanics} from '../src/core/displayCharacterEdit';
import {CompactResourceCanvas,CompactResourceGrid} from '../src/ui/CompactResources';
import {resourceModules,freeDashboardLayout,type ResourceWidgetLayout} from '../src/core/resourceWidgets';
import {WorkbenchRevisions} from '../src/core/workbenchRevisions';

describe('235 display preferences and shared dashboard',()=>{
 it('stores only token framing and preserves display preferences through native and linked exchange',()=>{
  const c=newCharacter(),frame=portraitFraming({data:'https://token.example/avatar.png',x:24,y:-19,zoom:2.2,frameWidth:104,frameHeight:110} as any);
  expect(frame).toEqual({x:24,y:-19,zoom:2.2,frameWidth:104,frameHeight:110});
  const next=applyDisplayCharacterEdit(c,displayCharacterEdit('tokenPortraitTransform',frame))!;next.overviewSpellsHidden=true;
  expect(sameCharacterMechanics(c,next)).toBe(true);expect(next.runtime).toBe(c.runtime);expect(next.portrait).toBeUndefined();
  expect(validateCharacter(exportCharacter(next))).toEqual(next);expect(importOwlbear(exportLinkedOwlbear(next,evaluate(next)))).toEqual(next);
  expect(JSON.stringify(next)).not.toContain('https://token.example');
 });
 it.each([{x:0,y:0,zoom:1,url:'https://token.example'}, {x:301,y:0,zoom:1}, {x:0,y:0,zoom:.9}, {x:0,y:0,zoom:1,frameWidth:0}])('rejects invalid or URL-bearing transform %j',frame=>expect(()=>validateCharacter({...newCharacter(),tokenPortraitTransform:frame})).toThrow('棋子头像变换无效'));
 it.each([0,'true',{},null])('rejects invalid overview spell visibility %j',overviewSpellsHidden=>expect(()=>validateCharacter({...newCharacter(),overviewSpellsHidden})).toThrow());
 it('keeps exact dashboard geometry and mounts offscreen operations without a resource count',()=>{
  const widgets:Record<string,ResourceWidgetLayout>={one:{x:2,y:1,w:4,h:3,page:2,resourceArea:true,style:'ring',contentScale:1.25}},modules=resourceModules([['one',{name:'测试资源',current:2,max:8}]],widgets),attacks={x:0,y:0,w:4,h:6,page:0,style:'segments' as const,resourceArea:true as const},layout=freeDashboardLayout(modules,widgets,attacks);
  const html=renderToStaticMarkup(createElement(CompactResourceCanvas,{modules,widgets,attacks,label:'资源',render:(m,w)=>createElement('span',{'data-operation':m.id,'data-scale':w.contentScale})}));
  expect(html).toContain('data-grid-page="2"');expect(html).toContain('data-grid-x="2"');expect(html).toContain('data-operation="one"');expect(html).toContain('data-scale="1.25"');expect(html).not.toContain('项资源');expect(layout.widgets.one.x).toBe(2);
  expect(renderToStaticMarkup(createElement(CompactResourceGrid,{rows:[{id:'one'}],label:'资源',render:()=>null}))).not.toContain('项资源');
 });
 it('uses shared spell-slot wording only for actual multiclass selections',()=>{
  const rows:[string,{current:number;max:number}][]=[['spell-slot:1',{current:2,max:4}],['pact-slot:2',{current:1,max:2}]];
  const one=[{id:'class-one',entry:{kind:'class'}},{id:'subclass',entry:{kind:'subclass'}}] as any;
  expect(resourceModules(rows,{},one).map(row=>row.name)).toEqual(['法术位','契约法术位']);
  expect(resourceModules(rows,{},[...one,{id:'class-two',entry:{kind:'class'}}]).map(row=>row.name)).toEqual(['法术位（共用）','契约法术位']);
 });
 it('takes layout, hidden rows and class count from ACK and resists stale/equal catalogs without reviving write permission',()=>{
  const gate=new WorkbenchRevisions(),native={selections:[{entry:{kind:'class'}}],quickbarLayout:{widgets:{focus:{style:'ring',x:3}},attacks:{split:.4},hidden:['resource:focus']}};
  const snapshot=gate.snapshot({state:{key:'room:card:a',cardId:'a',documentRevision:5,write:true,resources:[]},document:{_suiteRevision:5,dnd_card_web:native}});
  expect(snapshot.state.resourceWidgets).toEqual(native.quickbarLayout.widgets);
  for(const revision of [4,5]){const card:any=gate.card({id:'a',documentRevision:revision,write:false});expect(card.write).toBe(false);expect(card.resourceWidgets).toEqual(native.quickbarLayout.widgets);expect(card.resourceHidden).toEqual(['resource:focus']);expect(card.classSummary).toHaveLength(1);}
 });
});
