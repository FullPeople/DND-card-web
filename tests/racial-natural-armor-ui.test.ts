import {beforeAll,expect,it,vi} from 'vitest';
// Actual sheetDisplay/pointerDrag modules register window listeners at import.
// A real Node event host and URL are not module, source or authority mocks.
vi.hoisted(()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('location',new URL('https://racial-natural-armor.invalid/'));});
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('../src/ui/TrainingChips',()=>({TrainingChips:()=>null}));
vi.mock('../src/ui/HitDiceResources',()=>({HitDiceResources:()=>null}));
vi.mock('../src/ui/Quickbar',()=>({Quickbar:()=>null}));
vi.mock('../src/ui/Portrait',()=>({Portrait:()=>null}));
vi.mock('../src/ui/FeaturePanel',()=>({FeaturePanel:()=>null}));
vi.mock('../src/ui/OverviewChoiceOverlay',()=>({OverviewChoiceOverlay:()=>null}));
import {Overview} from '../src/ui/Overview';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {ValueTraceProvider,traceForInput} from '../src/ui/ValueTrace';
import {evaluate} from '../src/core/engine';
import {createCustomEntry} from '../src/core/customEntries';
import {uid,type Character,type Derived,type Selection} from '../src/core/model';
import {racialNaturalArmorFixture} from './helpers/racialNaturalArmorFlowFixture';
import {racialNaturalArmorSpecs,racialNaturalArmorSourceEvidence,racialNaturalArmorSnapshot as snapshot} from './helpers/racialNaturalArmorSourceFixture';

beforeAll(()=>{racialNaturalArmorSourceEvidence();});
const noop=()=>{};
const escape=(value:string)=>value.replace(/[&<>"']/g,key=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}as Record<string,string>)[key]);
const admitted=()=>{const keys=new Set(racialNaturalArmorSourceEvidence().rules.map(rule=>rule.key));return racialNaturalArmorSpecs.filter(spec=>keys.has(spec.key));};
const expected=(f:ReturnType<typeof racialNaturalArmorFixture>,d:Derived)=>{const p=f.spec.policy,value=p.constant+(p.modifier==='none'?0:d.modifiers[p.modifier]);return(p.operation==='alternative-base'?value:10+d.modifiers.dex+p.constant)+(f.c.sheetBonuses?.ac||0);};
function body(c:Character,extra:Record<string,unknown>={}){const entry=createCustomEntry({name:'Authored UI armor',type:'armor',body:'',raw:{type:'LA',armor:true,ac:11,...extra},edition:c.edition}),row:Selection={id:uid(),entry,level:1,quantity:1,equipped:true};c.profile.enabledSources.push('CUSTOM');c.selections.push(row);return row;}
function markup(f:ReturnType<typeof racialNaturalArmorFixture>,editing=false,edit=vi.fn()){const d=evaluate(f.c),entries=f.c.selections.map(row=>row.entry);return renderToStaticMarkup(createElement(ValueTraceProvider,{c:f.c,d,enabled:editing,children:createElement(SheetEditContext.Provider,{value:editing},createElement('main',null,createElement(Overview,{c:f.c,d,catalog:entries,statusRibbon:null,addEntry:noop,edit,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}),createElement(AutomationPanel,{c:f.c,d,entries,edit,writable:editing})))}));}
const shown=(html:string)=>{const found=html.match(/<strong[^>]*data-stat="ac"[^>]*>(-?\d+)<\/strong>/);expect(found!==null).toBe(true);return Number(found![1]);};

it('the actual Overview and source panel display each admitted canonical/App natural AC and provenance in readonly contexts without changing any stored state',()=>{
 expect(admitted().length).toBeGreaterThan(0);
 for(const form of ['canonical','app']as const)for(const spec of admitted()){const f=racialNaturalArmorFixture(spec.key,form),before=snapshot(f.c),d=evaluate(f.c),edit=vi.fn(),html=markup(f,false,edit);expect(shown(html)).toBe(expected(f,d));expect(html.includes(`data-testid="automation-ac">${d.ac}</strong>`)).toBe(true);expect(d.trace.ac.some(row=>row.includes(f.entry.name))).toBe(true);for(const line of d.trace.ac)expect(html.includes(escape(line))).toBe(true);expect(html.includes('<fieldset disabled=""')).toBe(true);expect(html.includes('aria-label="护甲等级调整值"')).toBe(false);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.resources.manual.current).toBe(1);}
});

it('manual final overrides and independent offsets remain visible in real AC traces, while source withdrawal and held equipment comparisons expose their reasons rather than extra armor',()=>{
 for(const spec of admitted().filter(row=>row.policy.ignoresDex||row.policy.operation==='additive-bonus')){const f=racialNaturalArmorFixture(spec.key);f.c.adjustments=[{id:'authored-final-ac',target:'ac',value:29,reason:'Authored final AC'}];f.c.sheetBonuses!.ac=3;const before=snapshot(f.c),d=evaluate(f.c),edit=vi.fn(),html=markup(f,true,edit),trace=traceForInput({c:f.c,d,open:noop},'护甲等级调整值',3,vi.fn())!;expect(shown(html)).toBe(32);expect(trace.value).toBe(3);expect(trace.result).toBe(32);expect(trace.rows).toEqual(d.trace.ac);expect(d.trace.ac.some(row=>row.includes(f.entry.name))).toBe(true);expect(d.trace.ac.some(row=>row.includes('Authored final AC'))).toBe(true);expect(html.includes('旧护甲最终值覆盖')).toBe(true);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);}
 const comparison=admitted().find(spec=>spec.policy.wearing==='natural-if-worn-lower')!;
 for(const mode of ['enchanted','unknown','conflict','source']as const){const f=racialNaturalArmorFixture(comparison.key);if(mode==='source')f.c.profile.enabledSources=[];else{const gear=body(f.c,mode==='enchanted'?{bonusAc:1}:{});if(mode==='unknown')delete gear.entry.raw.ac;if(mode==='conflict')body(f.c);}const before=snapshot(f.c),d=evaluate(f.c),issues=d.issues.filter(issue=>issue.id.startsWith('racial-natural-armor:')),edit=vi.fn(),html=markup(f,false,edit);expect(issues.length).toBeGreaterThan(0);for(const issue of issues)expect(html.includes(escape(issue.message))).toBe(true);expect(shown(html)).toBe(d.ac);expect(html.includes(`data-testid="automation-ac">${d.ac}</strong>`)).toBe(true);expect(html.includes('<fieldset disabled=""')).toBe(true);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);}
});
