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
import {reviewedWeaponMasterData,reviewedWeaponMasterFixture,weaponMasterReferences} from './e2e/reviewedWeaponMasterFixture';
function setup(){const c=reviewedWeaponMasterFixture(),catalog=normalizeData(reviewedWeaponMasterData,'weapon-master-overview');syncFeatures(c,catalog);const choice=sheetChoices(c,catalog).find(row=>row.grantLevel===4)!,entry=catalog.find(row=>row.english==='Weapon Master')!;setSheetChoiceSlot(c,choice.id,0,entry.id,catalog);return {c,catalog,choice,entry};}
function render(s:ReturnType<typeof setup>){const noop=()=>{};return renderToStaticMarkup(createElement(Overview,{c:s.c,d:evaluate(s.c),catalog:s.catalog,statusRibbon:null,addEntry:noop,edit:noop,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}));}
const weapons=(html:string)=>html.match(/<span data-training-group="weapons">(.*?)<\/span>/)?.[1];
function confirm(s:ReturnType<typeof setup>){setReviewedFeatIntent(s.c,s.choice.id,s.entry.id,{kind:'weapon-master',ability:'str',weapons:weaponMasterReferences,confirmedManualAbilityExcluded:true});}
it('Overview shows exactly the effective source-qualified training, not an unconfirmed snapshot or an added manual field',()=>{const s=setup();expect(weapons(render(s))).not.toContain('Longsword|PHB');confirm(s);const before=JSON.stringify(s.c),html=render(s);for(const reference of weaponMasterReferences)expect(weapons(html)?.split('、')).toContain(reference);expect(JSON.stringify(s.c)).toBe(before);s.c.profile.enabledSources=[];expect(weapons(render(s))).toBe('');s.c.profile.enabledSources=['PHB'];setReviewedFeatIntent(s.c,s.choice.id,s.entry.id,null);expect(weapons(render(s))).not.toContain('Longsword|PHB');});
it.each(['','军用武器、手工未收录说明'])('Overview retains explicit manual weapon training %j without merging the four derived grants',manual=>{const s=setup();confirm(s);s.c.training!.weapons=manual;const before=JSON.stringify(s.c);expect(weapons(render(s))).toBe(manual);expect(JSON.stringify(s.c)).toBe(before);});
