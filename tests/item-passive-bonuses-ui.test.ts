import {beforeAll,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('../src/ui/TrainingChips',()=>({TrainingChips:()=>null}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4'}));
vi.mock('../src/platform/workbench',()=>{const state={cards:[],monsters:[],inventory:{containers:{}}};return{inWorkbench:false,useWorkbench:()=>state,getWorkbench:()=>state,workbenchRequest:vi.fn(),requestInventory:vi.fn(),composeRoll:vi.fn()};});
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
vi.mock('../src/ui/HitDiceResources',()=>({HitDiceResources:()=>null}));
vi.mock('../src/ui/Quickbar',()=>({Quickbar:()=>null}));
vi.mock('../src/ui/Portrait',()=>({Portrait:()=>null}));
vi.mock('../src/ui/FeaturePanel',()=>({FeaturePanel:()=>null}));
vi.mock('../src/ui/OverviewChoiceOverlay',()=>({OverviewChoiceOverlay:()=>null}));
import {Overview} from '../src/ui/Overview';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {ValueTraceProvider,traceForInput} from '../src/ui/ValueTrace';
import {ABILITIES,type Ability} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {spellValues} from '../src/core/characterDetails';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {projectItemPassiveBonuses} from '../src/core/automation/itemPassiveBonuses';
import {itemPassiveBonusFixture} from './helpers/itemPassiveBonusFlowFixture';
import {itemPassiveBonusSpecs,itemPassiveBonusSourceEvidence,itemPassiveBonusSnapshot as snapshot} from './helpers/itemPassiveBonusSourceFixture';
const noop=()=>{};
beforeAll(()=>{itemPassiveBonusSourceEvidence();});
const withoutOwner=(f:ReturnType<typeof itemPassiveBonusFixture>)=>{const c=structuredClone(f.c);c.selections=c.selections.filter(row=>row.id!==f.owner.id);return evaluate(c);};
const overview=(f:ReturnType<typeof itemPassiveBonusFixture>,editing=false)=>{const d=evaluate(f.c);return renderToStaticMarkup(createElement(ValueTraceProvider,{c:f.c,d,children:createElement(SheetEditContext.Provider,{value:editing},createElement(Overview,{c:f.c,d,catalog:f.entries,statusRibbon:null,addEntry:noop,edit:noop,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}))}));};
const shownAc=(html:string)=>{const row=html.match(/<strong[^>]*data-stat="ac"[^>]*>(-?\d+)<\/strong>/);expect(row).not.toBeNull();return Number(row![1]);};
function shownSave(html:string,a:Ability){const start=html.indexOf('ability-box ability-'+a);expect(start).toBeGreaterThan(-1);const save=html.indexOf('class="ability-save',start),end=html.indexOf('class="ability-skills"',save);expect(save).toBeGreaterThan(start);expect(end).toBeGreaterThan(save);const number=html.slice(save,end).match(/<b>([+-]?\d+)<\/b>/);expect(number).not.toBeNull();return Number(number![1]);}
const expectedSaves=(f:ReturnType<typeof itemPassiveBonusFixture>,base=withoutOwner(f))=>Object.fromEntries(ABILITIES.map(a=>[a,base.saves[a].value+(f.spec.saveBonuses[a]||0)]));

it('all sixteen exact canonical and actual app forms render source-qualified AC and save increments in the real Overview without writing stored state',()=>{
 expect(itemPassiveBonusSpecs).toHaveLength(16);expect(itemPassiveBonusSpecs.reduce((n,row)=>n+row.sourcePropertyRows,0)).toBe(21);
 for(const form of ['canonical','app']as const)for(const spec of itemPassiveBonusSpecs){const f=itemPassiveBonusFixture(spec.sourceIndex,form),before=snapshot(f.c),base=withoutOwner(f),d=evaluate(f.c),projection=projectItemPassiveBonuses(f.c),html=overview(f);expect(projection.acBonus).toBe(spec.acBonus);for(const a of ABILITIES)expect(projection.saveBonuses[a]||0).toBe(spec.saveBonuses[a]||0);expect(shownAc(html)).toBe(base.ac+spec.acBonus);for(const a of ABILITIES)expect(shownSave(html,a)).toBe(expectedSaves(f,base)[a]);expect(d.ac).toBe(shownAc(html));expect(snapshot(f.c)).toBe(before);}
});

it('actual Overview traces preserve source provenance while retained final overrides win before independent card and save offsets',()=>{
 const f=itemPassiveBonusFixture(453);f.c.adjustments=[{id:'authored-ac-final',target:'ac',value:27,reason:'Authored final AC'},{id:'authored-save-final',target:'save:str',value:19,reason:'Authored final strength save'}];f.c.sheetBonuses={ac:3};f.c.saveBonuses={str:2};const before=snapshot(f.c),d=evaluate(f.c),projection=projectItemPassiveBonuses(f.c),html=overview(f,true),change=vi.fn(),trace=traceForInput({c:f.c,d,open:noop},'护甲等级调整值',3,change)!;
 expect(projection.acBonus).toBe(1);expect(projection.saveBonuses.str).toBe(1);expect(shownAc(html)).toBe(30);expect(shownSave(html,'str')).toBe(21);expect(trace.value).toBe(3);expect(trace.result).toBe(30);expect(trace.rows).toEqual(d.trace.ac);expect(projection.acTrace.length).toBeGreaterThan(0);for(const row of projection.acTrace){expect(d.trace.ac).toContain(row);expect(d.trace.ac.indexOf(row)).toBeLessThan(d.trace.ac.findIndex(value=>value.includes('Authored final AC')));}const strengthTrace=projection.saveTrace.str||[];expect(strengthTrace.length).toBeGreaterThan(0);for(const row of strengthTrace){expect(d.trace['save:str']).toContain(row);expect(d.trace['save:str'].indexOf(row)).toBeLessThan(d.trace['save:str'].findIndex(value=>value.includes('Authored final strength save')));}expect(html).toContain('aria-label="力量豁免数据追溯"');expect(change).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);
});

it('source-off, unequip and unattune rerenders follow the actual source condition and preserve every authored post-change byte',()=>{
 for(const spec of itemPassiveBonusSpecs)for(const mode of ['source','equipment','attunement']as const){const f=itemPassiveBonusFixture(spec.sourceIndex),base=withoutOwner(f);if(mode==='source')f.c.profile.enabledSources=[];if(mode==='equipment')f.owner.equipped=false;if(mode==='attunement')f.owner.attuned=false;const before=snapshot(f.c),stillActive=mode==='equipment'&&spec.sourceCondition==='attuned-only',html=overview(f);expect(shownAc(html)).toBe(base.ac+(stillActive?spec.acBonus:0));for(const a of ABILITIES)expect(shownSave(html,a)).toBe(base.saves[a].value+(stillActive?(spec.saveBonuses[a]||0):0));expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.resources.manual.current).toBe(1);}
});

it('six actual AI items grant exactly their one named save while unequipped; Wrought and Ingot keep their different attunement/equipment predicates',()=>{
 const ai=itemPassiveBonusSpecs.filter(spec=>spec.source==='AI');expect(ai).toHaveLength(6);for(const spec of ai){expect(Object.keys(spec.saveBonuses)).toHaveLength(1);const f=itemPassiveBonusFixture(spec.sourceIndex),before=snapshot(f.c),base=withoutOwner(f),html=overview(f);expect(f.owner.equipped).toBe(false);expect(f.owner.attuned).toBe(true);expect(shownAc(html)).toBe(base.ac);for(const a of ABILITIES)expect(shownSave(html,a)).toBe(base.saves[a].value+(spec.saveBonuses[a]||0));expect(snapshot(f.c)).toBe(before);}
 const tower=itemPassiveBonusFixture(2492),base=withoutOwner(tower),towerHtml=overview(tower);expect(tower.owner.equipped).toBe(false);expect(shownAc(towerHtml)).toBe(base.ac+2);for(const a of ABILITIES)expect(shownSave(towerHtml,a)).toBe(base.saves[a].value+2);const ingot=itemPassiveBonusFixture(1056),ingotBase=withoutOwner(ingot);expect(shownAc(overview(ingot))).toBe(ingotBase.ac+1);ingot.owner.equipped=false;expect(shownAc(overview(ingot))).toBe(ingotBase.ac);
});

it('unproved numeric tags cannot become displayed passive bonuses, spell attacks or general checks',()=>{
 const f=itemPassiveBonusFixture(453),base=withoutOwner(f),before=snapshot(f.c),d=evaluate(f.c),cWithout=structuredClone(f.c);cWithout.selections=cWithout.selections.filter(row=>row.id!==f.owner.id);expect(d.skills).toEqual(base.skills);expect(d.abilities).toEqual(base.abilities);expect(spellValues(f.c,d)).toEqual(spellValues(cWithout,base));expect(snapshot(f.c)).toBe(before);
 f.entry.raw.bonusAc=999;f.entry.raw.bonusSavingThrow=999;f.entry.raw.bonusSpellAttack=999;f.entry.raw.bonusAbilityCheck=999;const forged=snapshot(f.c),projection=projectItemPassiveBonuses(f.c),html=overview(f);expect(projection.acBonus).toBe(0);expect(Object.values(projection.saveBonuses).every(value=>value===0)).toBe(true);expect(projection.grants).toHaveLength(0);expect(projection.issues.length).toBeGreaterThan(0);expect(shownAc(html)).toBe(base.ac);for(const a of ABILITIES)expect(shownSave(html,a)).toBe(base.saves[a].value);expect(snapshot(f.c)).toBe(forged);
});

it('native reopening and source suspension preserve manual values, preparation, spent resources and the actual Overview numbers without granting unrelated effects',()=>{
 for(const sourceIndex of [453,422,2492,1056]){const f=itemPassiveBonusFixture(sourceIndex);f.c.saveBonuses={str:3,dex:-2};f.c.sheetBonuses={ac:2};f.c.proficiencies={athletics:true};f.c.expertise={athletics:true};f.c.training={tools:'Authored manual tool'};f.c.answers={authored:['retained answer']};f.c.runtime.inspiration=1;f.c.runtime.deathSaves={success:1,failure:2};f.c.spellSettings={mode:'prepared',ability:'int',capacity:3,attackBonus:13,dcBonus:14,prepared:[],slots:{}};const before=snapshot(f.c),html=overview(f),reopened=readCharacter(exportCharacter(f.c)).character;expect(snapshot(reopened)).toBe(before);expect(shownAc(html)).toBe(evaluate(f.c).ac);for(const a of ABILITIES)expect(shownSave(html,a)).toBe(evaluate(f.c).saves[a].value);expect(snapshot(f.c)).toBe(before);f.c.profile.enabledSources=[];const paused=snapshot(f.c),base=withoutOwner(f),pausedHtml=overview(f);expect(shownAc(pausedHtml)).toBe(base.ac);for(const a of ABILITIES)expect(shownSave(pausedHtml,a)).toBe(base.saves[a].value);expect(snapshot(f.c)).toBe(paused);}
});
