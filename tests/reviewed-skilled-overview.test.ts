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
import {setReviewedSkilledIntent} from '../src/core/automation/reviewedSkilled';
import {evaluate} from '../src/core/engine';
import {appendReviewedSkilledTools} from '../src/ui/skilledToolDisplay';
import {reviewedSkilledData,reviewedSkilledFixture,skilledValues} from './e2e/reviewedSkilledFixture';
import {skilledSkillRow,skilledTrainingRow} from './e2e/reviewedSkilledLocators';
import {installedPlaywrightSelectors} from './helpers/installedPlaywrightSelectors';
function setup(){const c=reviewedSkilledFixture(),catalog=normalizeData(reviewedSkilledData,'skilled-overview');syncFeatures(c,catalog);const choice=sheetChoices(c,catalog).find(row=>row.grantLevel===4)!,entry=catalog.find(row=>row.english==='Skilled')!;setSheetChoiceSlot(c,choice.id,0,entry.id,catalog);return {c,catalog,choice,entry};}
function render(s:ReturnType<typeof setup>){const noop=()=>{};return renderToStaticMarkup(createElement(Overview,{c:s.c,d:evaluate(s.c),catalog:s.catalog,statusRibbon:null,addEntry:noop,edit:noop,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}));}
const tools=(html:string)=>html.match(/<span data-training-group="tools">(.*?)<\/span>/)?.[1];
function confirm(s:ReturnType<typeof setup>){setReviewedSkilledIntent(s.c,s.choice.id,s.entry.id,{kind:'skilled',choices:skilledValues.map(value=>({kind:value.startsWith('skill:')?'skill':'tool',reference:value.slice(value.indexOf(':')+1)})),confirmed:true});}
it('actual Overview renders only confirmed derived tools and skill/passive values without writing to manual fields',()=>{const s=setup();expect(tools(render(s))).toBe('');confirm(s);const before=JSON.stringify(s.c),html=render(s);expect(tools(html)).toBe('{@item Thieves&#x27; Tools|PHB|盗贼工具}、{@itemProperty 陆上载具|PHB}');expect(html).toContain('aria-label="察觉熟练"');expect(html).toContain('data-stat="passive">12<');expect(JSON.stringify(s.c)).toBe(before);s.c.profile.enabledSources=[];expect(tools(render(s))).toBe('');s.c.profile.enabledSources=['PHB'];setReviewedSkilledIntent(s.c,s.choice.id,s.entry.id,null);expect(tools(render(s))).toBe('');expect(render(s)).toContain('data-stat="passive">10<');});
it.each(['','手工工具未收录说明'])('literal manual tool override %j does not remove Skilled skill proficiency',manual=>{const s=setup();confirm(s);s.c.training!.tools=manual;const before=JSON.stringify(s.c),html=render(s);expect(tools(html)).toBe(manual);expect(html).toContain('data-stat="passive">12<');expect(html).toContain('aria-label="察觉熟练"');expect(JSON.stringify(s.c)).toBe(before);});
it.each(["thieves' tools",'盗贼工具',"Thieves' Tools|PHB","{@item thieves' tools|PHB|盗贼工具}"])('preserves and deduplicates an existing PHB tool representation %j',value=>{const s=setup();confirm(s);expect(appendReviewedSkilledTools(s.c,[value,'land-vehicles'])).toEqual([value,'land-vehicles']);expect(appendReviewedSkilledTools(s.c,["Thieves' Tools|OTHER"])).toEqual(["Thieves' Tools|OTHER","{@item Thieves' Tools|PHB|盗贼工具}",'{@itemProperty 陆上载具|PHB}']);});
it('forged PHB manual snapshots cannot reenter Overview through generic raw tools or starting tools',()=>{const s=setup();for(const field of ['toolProficiencies','startingProficiencies']){const feat=structuredClone(s.entry);feat.raw[field]=field==='toolProficiencies'?[{forged:true}]:{tools:['forged']};s.c.selections.push({id:`forged-${field}`,entry:feat,level:1,quantity:1,equipped:false});}expect(tools(render(s))).toBe('');});
it('the final browser helpers use the installed selector engine against actual rendered Overview DOM, not an invented relative-has evaluator',()=>{const s=setup();confirm(s);const harness=installedPlaywrightSelectors(`<main class="paper" data-active-sheet="true">${render(s)}</main><aside class="paper" data-active-sheet="false">${render(s)}</aside>`);try{const panel=harness.locator('.paper[data-active-sheet="true"]'),skill=harness.elements(skilledSkillRow(panel,'察觉'));expect(skill).toHaveLength(1);expect(skill[0].querySelector('b')?.textContent).toBe('+2');expect(skill[0].querySelector('[aria-label="察觉熟练"]')).not.toBeNull();const training=harness.elements(skilledTrainingRow(panel,'工具'));expect(training).toHaveLength(1);expect(training[0].querySelector('dt')?.textContent).toBe('工具');expect(training[0].querySelector('dd')?.textContent).toContain('盗贼工具');const old=panel.locator('.ability-skill').filter({has:panel.locator('span[title="察觉"]')});expect(harness.elements(old)).toEqual([]);}finally{harness.close();}});

it('new tool display projection always retains PHB identity when the card display edition changes or same-name non-PHB catalog rows exist',()=>{const s=setup();confirm(s);s.c.edition='2024';expect(appendReviewedSkilledTools(s.c,[])).toEqual(["{@item Thieves' Tools|PHB|盗贼工具}",'{@itemProperty 陆上载具|PHB}']);expect(appendReviewedSkilledTools(s.c,['盗贼工具'])).toHaveLength(3);const source=normalizeData({item:[{name:'盗贼工具',ENG_name:"Thieves' Tools",source:'XPHB',type:'T|XPHB',edition:'one'}]},'other-source');s.catalog.push(...source);const html=render(s);expect(tools(html)).toContain("Thieves&#x27; Tools|PHB|盗贼工具");expect(tools(html)).not.toContain('|XPHB');});

it('forged PHB Skilled language metadata is not treated as a supported language grant while existing manual languages remain untouched',()=>{const s=setup(),feat=structuredClone(s.entry);feat.raw.languageProficiencies=[{forged:true}];s.c.selections.push({id:'forged-language',entry:feat,level:1,quantity:1,equipped:false});expect(render(s)).toContain('手工语言记录');delete s.c.training!.languages;expect(render(s).match(/<span data-training-group="languages">(.*?)<\/span>/)?.[1]).toBe('');});
