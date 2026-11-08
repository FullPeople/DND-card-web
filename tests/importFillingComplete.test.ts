// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {ignoreUnfilledSheetChoices,sheetChoices,sheetChoiceIgnored} from '../src/core/automation/choices';
import {evaluate} from '../src/core/engine';
import {readCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
import {Overview} from '../src/ui/Overview';
import {FeaturePanel} from '../src/ui/FeaturePanel';
import {SheetEditContext} from '../src/ui/SheetEdit';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));});
afterEach(()=>vi.unstubAllGlobals());

function card(){const c=newCharacter();c.automation=newAutomationState();const e:Entry={id:'authored-import',kind:'feature',name:'Authored feature',english:'Authored feature',edition:'2024',source:'XPHB',revision:'1',packId:'authored',entries:['Authored source content.'],raw:{skillProficiencies:[{choose:{from:['arcana','history'],count:1}}]}};c.selections=[{id:'authored-row',entry:e,level:1,quantity:1,equipped:false}];c.runtime.resources.manual={name:'Authored spent record',max:9,current:2};c.answers.opaque=['kept'];(c as any).futurePrivate={keep:true};return c;}
it('the existing external-import review marks the filling workflow complete without inventing answers or effects',()=>{
 const c=card(),answers=structuredClone(c.answers),resources=structuredClone(c.runtime),selected=structuredClone(c.selections),before=evaluate(c);ignoreUnfilledSheetChoices(c,[]);
 expect((c.featureLayout as any).fillingReviewed).toBe(true);expect(c.answers).toEqual(answers);expect(c.runtime).toEqual(resources);expect(c.selections).toEqual(selected);expect(evaluate(c)).toEqual(before);expect(sheetChoices(c).every(r=>sheetChoiceIgnored(c,r.id,r)||r.complete)).toBe(true);
 const reopened=readCharacter(exportCharacter(c)).character;expect((reopened.featureLayout as any).fillingReviewed).toBe(true);expect((reopened as any).futurePrivate).toEqual({keep:true});
});
it('reviewed imports hide missing identity fill buttons while newly created cards keep them',async()=>{
 const render=async(c:Character)=>{const host=document.createElement('div');document.body.append(host);const root=createRoot(host);try{await act(()=>root.render(createElement(SheetEditContext.Provider,{value:true},createElement(Overview,{c,d:evaluate(c),catalog:[],statusRibbon:null,edit:()=>{},browse:()=>{},inspect:()=>{},onLink:()=>{},renderSelection:()=>null,addEntry:()=>{},openResources:()=>{},openQuickbar:()=>{},openHp:()=>{},pinDrop:()=>{}}))));return host.innerHTML;}finally{await act(()=>root.unmount());host.remove();}};
 const fresh=newCharacter(),before=await render(fresh);expect(before).toContain('cell-fill');ignoreUnfilledSheetChoices(fresh);expect(await render(fresh)).not.toContain('cell-fill');
});
it('ignored imported choices have no incomplete counter or automatic selection buttons on expanded features',()=>{
 const c=card();ignoreUnfilledSheetChoices(c);c.featureLayout!.expanded=['authored-row'];
 const html=renderToStaticMarkup(createElement(SheetEditContext.Provider,{value:true},createElement(FeaturePanel,{c,catalog:[],rows:c.selections,kinds:['feature'],label:'特性',edit:()=>{},browse:()=>{},onLink:()=>{}})));
 expect(html).not.toContain('（已忽略）');expect(html).not.toContain('feature-choice-actions');expect(html).toContain('Authored feature');
});
it('invalid review markers are rejected before native import can mutate anything',()=>{const c=newCharacter();c.featureLayout={order:[],expanded:[],fillingReviewed:'yes'} as any;expect(()=>readCharacter(exportCharacter(c))).toThrow();});
