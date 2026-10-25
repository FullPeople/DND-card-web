import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
vi.mock('../src/ui/Reference',()=>({Reference:({children}:any)=>createElement('span',null,children)}));
vi.mock('../src/ui/TrainingChips',()=>({TrainingChips:({group,value}:any)=>createElement('span',{'data-training-group':group},value)}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4'}));
vi.mock('../src/platform/workbench',()=>({inWorkbench:false,workbenchRequest:()=>Promise.resolve(),composeRoll:()=>{}}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:()=>()=>{},landingWithin:()=>({})}));
vi.mock('../src/ui/HitDiceResources',()=>({HitDiceResources:()=>null}));
vi.mock('../src/ui/Quickbar',()=>({Quickbar:()=>null}));
vi.mock('../src/ui/Portrait',()=>({Portrait:()=>null}));
vi.mock('../src/ui/FeaturePanel',()=>({FeaturePanel:()=>null}));
vi.mock('../src/ui/OverviewChoiceOverlay',()=>({OverviewChoiceOverlay:()=>null}));
import {Overview} from '../src/ui/Overview';
import {normalizeData} from '../src/data/catalog';
import {syncFeatures} from '../src/core/sheet';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {setReviewedFeatIntent} from '../src/core/automation/reviewedFeats';
import {evaluate} from '../src/core/engine';
import {reviewedArmorFeatData,reviewedArmorFeatFixture} from './e2e/reviewedArmorFeatFixture';
function setup(){const c=reviewedArmorFeatFixture(),catalog=normalizeData(reviewedArmorFeatData,'reviewed-armor-overview');syncFeatures(c,catalog);const choice=sheetChoices(c,catalog).find(row=>row.grantLevel===4)!,entry=catalog.find(row=>row.english==='Lightly Armored')!;setSheetChoiceSlot(c,choice.id,0,entry.id,catalog);return {c,catalog,choice,entry};}
function render(s:ReturnType<typeof setup>){const noop=()=>{};return renderToStaticMarkup(createElement(Overview,{c:s.c,d:evaluate(s.c),catalog:s.catalog,statusRibbon:null,addEntry:noop,edit:noop,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}));}
const armor=(html:string)=>html.match(/<span data-training-group="armor">(.*?)<\/span>/)?.[1];
it('Overview displays the same confirmed training projection used by armor consumers, never a selected raw snapshot',()=>{
 const s=setup();expect(armor(render(s))).toBe('');setReviewedFeatIntent(s.c,s.choice.id,s.entry.id,{kind:'lightly-armored',ability:'dex',confirmedManualAbilityExcluded:true});const before=JSON.stringify(s.c);expect(armor(render(s))).toBe('{@itemProperty 轻甲|PHB}');expect(JSON.stringify(s.c)).toBe(before);s.c.profile.enabledSources=[];expect(armor(render(s))).toBe('');s.c.profile.enabledSources=['PHB'];setReviewedFeatIntent(s.c,s.choice.id,s.entry.id,null);expect(armor(render(s))).toBe('');
});
it.each(['','盾牌、手工未收录说明'])('Overview keeps an explicit manual armor record %j without merging derived grants',manual=>{
 const s=setup();setReviewedFeatIntent(s.c,s.choice.id,s.entry.id,{kind:'lightly-armored',ability:'dex',confirmedManualAbilityExcluded:true});s.c.training!.armor=manual;const before=JSON.stringify(s.c),html=render(s);expect(armor(html)).toBe(manual);expect(html).toContain('手工工具记录');expect(html).toContain('手工语言记录');expect(JSON.stringify(s.c)).toBe(before);
});
