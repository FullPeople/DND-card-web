import {beforeAll,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('../src/platform/workbench',()=>{const state={cards:[],monsters:[],inventory:{containers:{}}};return{inWorkbench:false,useWorkbench:()=>state,getWorkbench:()=>state,workbenchRequest:vi.fn(),requestInventory:vi.fn(),composeRoll:vi.fn()};});
vi.mock('../src/cloud/localRights',()=>({localGm:()=>false}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4',useSheetCaptureActive:()=>false}));
vi.mock('../src/ui/Portrait',()=>({Portrait:()=>null}));
vi.mock('../src/ui/FeaturePanel',()=>({FeaturePanel:()=>null}));
import {DetailHeader} from '../src/ui/CharacterPages';
import {QuickbarAttacks} from '../src/ui/Quickbar';
import {SpellsPage} from '../src/ui/SpellsPage';
import {SourceSpellActions} from '../src/ui/SourceSpellActions';
import {traceForInput} from '../src/ui/ValueTrace';
import {evaluate} from '../src/core/engine';
import {spellState,spellValues,spellValueDetails} from '../src/core/characterDetails';
import {characterReview} from '../src/core/characterReview';
import {exportOwlbear,exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {signed,type Character,type Selection} from '../src/core/model';
import {itemChargeRequest,performItemChargeAction} from '../src/core/automation/itemChargeDebits';
import {setChargedItemSpellIntent,chargedItemSpellGrantKey} from '../src/core/automation/chargedItemSpells';
import {setItemAtWillIntent} from '../src/core/automation/itemAtWill';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {spellPayments} from '../src/core/automation/actions';
import {itemCastingBonusFixture} from './helpers/itemCastingBonusFlowFixture';
import {itemCastingBonusClass,itemCastingBonusSpecs,itemCastingBonusSourceEvidence,itemCastingBonusSnapshot as snapshot} from './helpers/itemCastingBonusSourceFixture';
import {chargedItemSpellFixture} from './helpers/chargedItemSpellFlowFixture';
import {chargedItemSpellSpecs,chargedItemSpellSourceRules} from './helpers/chargedItemSpellSourceFixture';
import {itemAtWillFixture,itemAtWillEntries} from './helpers/itemAtWillFixture';
const noop=()=>{},authority={canEdit:true,gm:false};
beforeAll(()=>{itemCastingBonusSourceEvidence();chargedItemSpellSourceRules();itemAtWillEntries();});
const base=(c:Character,ability=spellState(c).ability)=>{const d=evaluate(c),s=spellState(c);return{attack:d.modifiers[ability]+d.proficiency+s.attackBonus,dc:8+d.modifiers[ability]+d.proficiency+s.dcBonus};};
const header=(c:Character)=>renderToStaticMarkup(createElement(DetailHeader,{c,d:evaluate(c),page:'法术',edit:noop,browse:noop,inspect:noop,onLink:noop,add:noop}));
function headerValues(c:Character){const rows=[...header(c).matchAll(/<strong class="page-value">([^<]+)<\/strong>/g)];expect(rows.length).toBeGreaterThanOrEqual(3);return{attack:Number(rows[0][1]),dc:Number(rows[1][1])};}
const page=(c:Character,entries:ReturnType<typeof itemCastingBonusFixture>['entries'])=>renderToStaticMarkup(createElement(SpellsPage,{c,d:evaluate(c),entries,edit:noop,browse:noop,inspect:noop,onLink:noop,add:noop}));
function classValues(html:string,name:string){const row=[...html.matchAll(/<tr><th>([^<]+)<\/th><td>[^<]+<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td>/g)].find(row=>row[1]===name);expect(row).toBeDefined();return{attack:Number(row![2]),dc:Number(row![3])};}
function addClass(c:Character,role:Parameters<typeof itemCastingBonusClass>[0],id:string){const entry=structuredClone(itemCastingBonusClass(role,c.edition)),row:Selection={id,entry,level:5,quantity:1,equipped:false};c.selections.push(row);c.profile.enabledSources=[...new Set([...c.profile.enabledSources,entry.source,...(entry.dependencies||[])])];return row;}
function sameCharisma(){const f=itemCastingBonusFixture(3),other=addClass(f.c,'Warlock','other-warlock-owner');return{...f,other};}
function attachCastingItem(c:Character){const f=itemCastingBonusFixture(c.edition==='2024'?1845:1),caster=addClass(c,c.edition==='2024'?'Wizard':'Cleric','stat-attunement-owner'),owner={...structuredClone(f.owner),id:'stat-item-owner'};c.selections.push(owner);c.profile.enabledSources=[...new Set([...c.profile.enabledSources,owner.entry.source,...(owner.entry.dependencies||[])])];c.spellSettings!.abilityClassId=caster.id;c.spellSettings!.ability=caster.entry.raw.spellcastingAbility;return{caster,owner,spec:f.spec};}

it('all nine authenticated canonical/app owners render their eighteen casting properties; same-CHA Sorcerer and Warlock rows never share Bloodwell ownership',()=>{
 expect(itemCastingBonusSpecs).toHaveLength(9);expect(itemCastingBonusSpecs.reduce((n,row)=>n+Number(row.attackBonus>0)+Number(row.dcBonus>0),0)).toBe(18);
 for(const form of ['canonical','app']as const)for(const spec of itemCastingBonusSpecs){const f=itemCastingBonusFixture(spec.sourceIndex,form),before=snapshot(f.c),b=base(f.c);expect(headerValues(f.c)).toEqual({attack:b.attack+spec.attackBonus,dc:b.dc+spec.dcBonus});expect(snapshot(f.c)).toBe(before);}
 const f=sameCharisma(),before=snapshot(f.c),b=base(f.c,'cha'),html=page(f.c,f.entries);expect(classValues(html,f.caster.entry.name)).toEqual({attack:b.attack+1,dc:b.dc+1});expect(classValues(html,f.other.entry.name)).toEqual(b);expect(spellValues(f.c,evaluate(f.c),'cha',{casterId:f.other.id})).toEqual(b);expect(snapshot(f.c)).toBe(before);
 // Attunement class eligibility is independent of the receiving class.
 const devout=itemCastingBonusFixture(1),druid=addClass(devout.c,'Druid','recipient-druid');devout.caster.level=1;const db=base(devout.c,'wis');expect(classValues(page(devout.c,devout.entries),druid.entry.name)).toEqual({attack:db.attack+1,dc:db.dc+1});
});

it('actual header, Quickbar attacks, review and Owlbear totals agree on the explicitly selected class without rewriting settings or picking a same-ability owner',()=>{
 const f=sameCharisma();for(const id of [f.caster.id,f.other.id]){f.c.spellSettings!.abilityClassId=id;const before=snapshot(f.c),d=evaluate(f.c),b=base(f.c),bonus=id===f.caster.id?1:0,expected={attack:b.attack+bonus,dc:b.dc+bonus},html=renderToStaticMarkup(createElement(QuickbarAttacks,{c:f.c,d,inspect:noop,manageQuickbar:noop}));expect(headerValues(f.c)).toEqual(expected);expect(html).toContain(`>${signed(expected.attack)}</button>`);expect(html).toContain(`<strong>DC ${expected.dc}</strong>`);expect(characterReview(f.c).stats).toEqual(expected);const exported=exportOwlbear(f.c,d);expect(exported.spellcasting.attack_bonus).toBe(expected.attack);expect(exported.spellcasting.save_dc).toBe(expected.dc);expect(snapshot(f.c)).toBe(before);}
 delete f.c.spellSettings!.abilityClassId;const before=snapshot(f.c);expect(headerValues(f.c)).toEqual(base(f.c));expect(snapshot(f.c)).toBe(before);
});

it('actual spell trace models keep source provenance and manual offsets separate through source, worn, attunement and customized-ability transitions with complete-state preservation',()=>{
 const f=itemCastingBonusFixture(3),original=structuredClone(f.c);for(const mode of ['active','source','equipment','attunement','ability']as const){const c=structuredClone(original),owner=c.selections.find(row=>row.id===f.owner.id)!;if(mode==='source')c.profile.enabledSources=c.profile.enabledSources.filter(source=>source!==f.entry.source);if(mode==='equipment')owner.equipped=false;if(mode==='attunement')owner.attuned=false;if(mode==='ability'){c.spellSettings!.abilityOverride=true;c.spellSettings!.ability='wis';}const before=snapshot(c),d=evaluate(c),details=spellValueDetails(c,d),b=base(c),bonus=mode==='active'?1:0,change=vi.fn();expect(details.values).toEqual({attack:b.attack+bonus,dc:b.dc+bonus});for(const [kind,label,key,rows]of [['attack','法术攻击调整值','attackBonus',details.attackSourceTrace],['dc','法术DC调整值','dcBonus',details.dcSourceTrace]]as const){const model=traceForInput({c,d,open:noop},label,c.spellSettings![key],change)!;expect(model.value).toBe(c.spellSettings![key]);expect(model.result).toBe(details.values[kind]);for(const row of rows)expect(model.rows).toContain(row);if(mode==='active'){expect(rows.length).toBeGreaterThan(0);expect(rows.join(' ')).toContain(f.entry.name);}}expect(headerValues(c)).toEqual(details.values);expect(change).not.toHaveBeenCalled();expect(snapshot(c)).toBe(before);expect(snapshot(readCharacter(exportCharacter(c)).character)).toBe(before);}
});

it('real charged fixed-DC/no-stat and at-will source spells do not borrow an active worn caster bonus or global/manual totals, and their payment routes remain unchanged',()=>{
 let none=0,fixed=0;for(const spec of chargedItemSpellSpecs){const f=chargedItemSpellFixture(spec.ownerId);expect(performItemChargeAction(f.c,itemChargeRequest(f.c,f.owner.id,'ui-stat-known',{kind:'acquire',knownRemaining:1+f.rule.branch.minAfter,confirmedGenuineItem:true,confirmedKnownBalance:true}),authority).status).toBe('applied');setChargedItemSpellIntent(f.c,f.owner.id,{confirmedGenuineOwnedItem:true},f.entries,authority);syncSourceSpells(f.c,f.entries);const child=f.c.selections.find(row=>row.parentId===f.owner.id&&chargedItemSpellGrantKey(row.grantKey))!;expect(child).toBeDefined();const attached=attachCastingItem(f.c),before=snapshot(f.c),d=evaluate(f.c),global=spellValues(f.c,d),b=base(f.c);expect(global).toEqual({attack:b.attack+attached.spec.attackBonus,dc:b.dc+attached.spec.dcBonus});expect(spellValues(f.c,d,undefined,{sourceSelectionId:child.id})).toEqual(b);const payment=spellPayments(f.c,child.id,authority).options;expect(payment.map(row=>row.id)).toEqual(['item-charge']);expect(payment[0].statistics).toEqual(spec.statistics);const html=renderToStaticMarkup(createElement(SourceSpellActions,{c:f.c,id:child.id,edit:noop}));if(spec.statistics.kind==='fixed-dc'){fixed++;expect(html).toContain(`来源固定豁免 DC：${spec.statistics.saveDC}`);}else{none++;expect(html).toContain('data-item-cast-statistics="none"');expect(html).not.toContain('来源固定豁免 DC：');}expect(html).not.toContain(`DC ${global.dc}`);expect(html).not.toContain('type="number"');expect(snapshot(f.c)).toBe(before);}expect([none,fixed]).toEqual([6,5]);
 const f=itemAtWillFixture();setItemAtWillIntent(f.c,f.owner.id,{confirmedGenuineOwnedItem:true},f.entries,authority);syncSourceSpells(f.c,f.entries);const child=f.c.selections.find(row=>row.parentId===f.owner.id&&row.entry.kind==='spell')!;attachCastingItem(f.c);const before=snapshot(f.c),html=renderToStaticMarkup(createElement(SourceSpellActions,{c:f.c,id:child.id,edit:noop}));expect(f.c.spellSettings!.special![child.id].sourceGrant!.ability).toBeUndefined();expect(spellPayments(f.c,child.id,authority).options.map(row=>[row.id,row.cost])).toEqual([['free',0]]);expect(html).not.toContain('data-item-cast-statistics=');expect(html).not.toContain('来源固定豁免 DC：');expect(snapshot(f.c)).toBe(before);
});
