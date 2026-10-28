import {beforeAll,expect,it,vi} from 'vitest';
// Real platform and current authority providers; Node SSR only needs a URL.
vi.hoisted(()=>vi.stubGlobal('location',new URL('https://racial-resistance.invalid/')));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {evaluate} from '../src/core/engine';
import {racialResistanceFixture} from './helpers/racialResistanceFlowFixture';
import {racialResistanceSpecs,racialResistanceHeldEntries,racialResistanceSourceEvidence,racialResistanceSnapshot as snapshot} from './helpers/racialResistanceSourceFixture';

beforeAll(()=>{racialResistanceSourceEvidence();});
const types=['acid','cold','fire','lightning','necrotic','poison','psychic','radiant'];
const panelOrder=['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder'];
const escape=(value:string)=>value.replace(/[&<>"']/g,key=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}as Record<string,string>)[key]);
const resistanceText=(values:readonly string[])=>panelOrder.filter(type=>values.includes(type)).join('、')||'无';
const admittedSpecs=()=>{const keys=new Set(racialResistanceSourceEvidence().rules.map(rule=>rule.key));return racialResistanceSpecs.filter(spec=>keys.has(spec.key));};

it('actual source-qualified representatives cover all eight types through the existing readonly panel in both routes with visible provenance and an explicit manual-damage boundary',()=>{
 const seen=new Set<string>(),representatives=admittedSpecs().filter(spec=>{const fresh=spec.resistances.some(type=>!seen.has(type));for(const type of spec.resistances)seen.add(type);return fresh;});expect([...seen].sort()).toEqual(types);
 for(const form of ['canonical','app']as const)for(const spec of representatives){const f=racialResistanceFixture(spec.key,form),before=snapshot(f.c),d=evaluate(f.c),edit=vi.fn(),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d,entries:f.entries,edit,writable:false}));expect(html.includes('当前自动抗性')).toBe(true);expect(html.includes(`data-testid="automation-resistances">${resistanceText(spec.resistances)}</p>`)).toBe(true);expect(html.includes('实际伤害结算与减免仍需手动处理，不会自动改写生命值')).toBe(true);expect(html.includes('<fieldset disabled=""')).toBe(true);expect(d.trace.resistances.some(row=>row.includes(f.entry.name))).toBe(true);for(const row of d.trace.resistances)expect(html.includes(escape(row))).toBe(true);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.tempHp).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(1);}
 // Synthetic unknown data tests only the panel's closed display vocabulary.
 const f=racialResistanceFixture(),before=snapshot(f.c),d=evaluate(f.c),edit=vi.fn();d.resistances!.push('authored-unreviewed-type');const html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d,entries:f.entries,edit,writable:false}));expect(html.includes('authored-unreviewed-type')).toBe(false);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);
 // Actual Shadar-kai sources remain necrotic-only, never a temporary all-damage grant.
 const shadar=admittedSpecs().filter(spec=>spec.key==='race/133'||spec.key==='subrace/20');expect(shadar.length).toBeGreaterThan(0);for(const spec of shadar){const f=racialResistanceFixture(spec.key),d=evaluate(f.c),before=snapshot(f.c),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d,entries:f.entries,edit:vi.fn(),writable:false}));expect(d.resistances).toEqual(['necrotic']);expect(html.includes('data-testid="automation-resistances">necrotic</p>')).toBe(true);expect(snapshot(f.c)).toBe(before);}
});

it('explicit held, disabled-source and inactive owner routes expose the new scoped reasons without inventing grants, deleting snapshots or offering a separate resistance toggle',()=>{
 for(const form of ['canonical','app']as const){const held=racialResistanceHeldEntries(form);expect(held.length).toBeGreaterThan(0);for(const entry of held){const f=racialResistanceFixture(undefined,form);f.owner.entry=structuredClone(entry);f.c.profile.enabledSources=[entry.source,...(entry.dependencies||[])];const before=snapshot(f.c),d=evaluate(f.c),issues=d.issues.filter(issue=>issue.id.startsWith('racial-resistance:')),edit=vi.fn(),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d,entries:[...f.entries,entry],edit,writable:false}));expect(d.resistances).toEqual([]);expect(issues.length).toBeGreaterThan(0);for(const issue of issues)expect(html.includes(escape(issue.message))).toBe(true);expect(html.includes('data-testid="automation-resistances">无</p>')).toBe(true);expect(html.includes('<fieldset disabled=""')).toBe(true);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);}}
 for(const mode of ['source','canonical','automation','parent']as const){const f=racialResistanceFixture();if(mode==='source')f.c.profile.enabledSources=[];if(mode==='canonical')f.c.profile.disabledEntries=[f.entry.id];if(mode==='automation')f.c.automation!.enabled=false;if(mode==='parent')f.owner.parentId='authored-absent-parent';const before=snapshot(f.c),d=evaluate(f.c),issues=d.issues.filter(issue=>issue.id.startsWith('racial-resistance:')),edit=vi.fn(),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d,entries:f.entries,edit,writable:false}));expect(d.resistances).toEqual([]);expect(issues.length).toBeGreaterThan(0);for(const issue of issues)expect(html.includes(escape(issue.message))).toBe(true);expect(html.includes('data-testid="automation-resistances">无</p>')).toBe(true);expect(html.includes('实际伤害结算与减免仍需手动处理，不会自动改写生命值')).toBe(true);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);}
});
