import {beforeAll,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('../src/ui/Reference',()=>({Reference:({children}:any)=>createElement('span',null,children)}));
vi.mock('../src/ui/TrainingChips',()=>({TrainingChips:()=>null}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4'}));
vi.mock('../src/platform/workbench',()=>({inWorkbench:false,workbenchRequest:()=>Promise.resolve(),composeRoll:()=>{}}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:()=>()=>{},landingWithin:()=>({})}));
vi.mock('../src/ui/HitDiceResources',()=>({HitDiceResources:()=>null}));
vi.mock('../src/ui/Quickbar',()=>({Quickbar:()=>null}));
vi.mock('../src/ui/Portrait',()=>({Portrait:()=>null}));
vi.mock('../src/ui/FeaturePanel',()=>({FeaturePanel:()=>null}));
vi.mock('../src/ui/OverviewChoiceOverlay',()=>({OverviewChoiceOverlay:()=>null}));
import {Overview} from '../src/ui/Overview';
import {NumberInput} from '../src/ui/NumberInput';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {traceForInput} from '../src/ui/ValueTrace';
import {ABILITY_LABELS} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {itemAbilityFloorEntries,itemAbilityFloorFixture,itemAbilityFloorDigest} from './helpers/itemAbilityFloorFixture';
beforeAll(()=>{itemAbilityFloorEntries();});
const noop=()=>{};
const overview=(f:ReturnType<typeof itemAbilityFloorFixture>,editing=false)=>renderToStaticMarkup(createElement(SheetEditContext.Provider,{value:editing},createElement(Overview,{c:f.c,d:evaluate(f.c),catalog:f.entries,statusRibbon:null,addEntry:noop,edit:noop,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop})));
for(const [english,source] of [['Amulet of Health','DMG'],['Headband of Intellect','XDMG'],['Belt of Storm Giant Strength','DMG']])it(`actual source Overview and NumberInput share effective readonly display and retained base editor: ${source} ${english}`,()=>{
 const f=itemAbilityFloorFixture(english,source),before=itemAbilityFloorDigest(f.c),d=evaluate(f.c),ability=f.spec.ability,label=`${ABILITY_LABELS[ability]}基础值`,floor=f.spec.floor;
 const html=overview(f),input=html.match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0];expect(input).toContain(`value="${floor}"`);expect(input).toContain('readOnly=""');
 const editing=overview(f,true).match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0];expect(editing).toContain(`value="${floor}"`);expect(editing).not.toContain('readOnly');
 const change=vi.fn(),trace=traceForInput({c:f.c,d,open:noop},label,f.c.abilities[ability],change)!;expect(trace.value).toBe(10);expect(trace.result).toBe(floor);expect(trace.rows.join()).toContain('当前穿戴且同调');expect(trace.rows.join()).toContain(source);expect(change).not.toHaveBeenCalled();
 expect(renderToStaticMarkup(createElement(NumberInput,{value:f.c.abilities[ability],displayValue:d.abilities[ability],readOnly:true,'aria-label':label}))).toContain(`value="${floor}"`);expect(itemAbilityFloorDigest(f.c)).toBe(before);
 f.owner.equipped=false;const withdrawn=overview(f).match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0];expect(withdrawn).toContain('value="10"');expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.resources.manual.current).toBe(1);
});
it('source-unproved numeric tags cannot become a displayed effective score or a new base',()=>{
 const f=itemAbilityFloorFixture();f.entry.raw.ability.static.con=999;const before=itemAbilityFloorDigest(f.c),d=evaluate(f.c);expect(d.abilities.con).toBe(10);expect(overview(f).match(/<input[^>]*aria-label="体质基础值"[^>]*>/)?.[0]).toContain('value="10"');expect(d.issues.some(i=>i.id.startsWith('item-ability-floor:unproved:'))).toBe(true);expect(itemAbilityFloorDigest(f.c)).toBe(before);
});
it('Overview retains a real legacy DMG item floor across character edition changes without offering new disallowed picks or bypassing source-off',()=>{
 const f=itemAbilityFloorFixture();f.c.edition='2024';f.c.profile.optional.legacy=true;const before=itemAbilityFloorDigest(f.c);expect(overview(f).match(/<input[^>]*aria-label="体质基础值"[^>]*>/)?.[0]).toContain('value="19"');expect(itemAbilityFloorDigest(f.c)).toBe(before);
 f.c.profile.optional.legacy=false;expect(overview(f).match(/<input[^>]*aria-label="体质基础值"[^>]*>/)?.[0]).toContain('value="19"');f.c.profile.enabledSources=f.c.profile.enabledSources.filter(s=>s!=='DMG');expect(overview(f).match(/<input[^>]*aria-label="体质基础值"[^>]*>/)?.[0]).toContain('value="10"');expect(f.c.abilities.con).toBe(10);expect(f.c.runtime.hp).toBe(3);
});
