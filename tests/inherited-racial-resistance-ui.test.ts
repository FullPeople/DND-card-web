import {beforeAll,expect,it,vi} from 'vitest';
// URL setup only: actual platform, source and authority providers remain real.
vi.hoisted(()=>vi.stubGlobal('location',new URL('https://inherited-racial-resistance.invalid/')));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {evaluate} from '../src/core/engine';
import {inheritedRacialResistanceFixture} from './helpers/inheritedRacialResistanceFlowFixture';
import {inheritedRacialResistanceSpecs,inheritedRacialResistanceSourceEvidence,inheritedRacialResistanceSnapshot as snapshot} from './helpers/inheritedRacialResistanceSourceFixture';

beforeAll(()=>{inheritedRacialResistanceSourceEvidence();});
const order=['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder'];
const escape=(value:string)=>value.replace(/[&<>"']/g,key=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}as Record<string,string>)[key]);
const display=(types:readonly string[])=>order.filter(type=>types.includes(type)).join('、')||'无';

it('the existing readonly panel renders actual representatives of every admitted parent group, the qualified Duergar replacement and genuinely unnamed Tiefling without inventing labels or HP automation',()=>{
 const evidence=inheritedRacialResistanceSourceEvidence(),groups=new Map<string,string>();for(const rule of evidence.rules)if(!groups.has(rule.sourceProof.parent.normalizedId))groups.set(rule.sourceProof.parent.normalizedId,rule.key);expect(groups.size).toBeGreaterThan(0);const keys=[...new Set([...groups.values(),...['subrace/9','subrace/82'].filter(key=>evidence.rules.some(rule=>rule.key===key))])];
 for(const form of ['canonical','app']as const)for(const key of keys){const f=inheritedRacialResistanceFixture(key,form),before=snapshot(f.c),d=evaluate(f.c),edit=vi.fn(),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d,entries:f.entries,edit,writable:false}));expect(html.includes('当前自动抗性')).toBe(true);expect(html.includes(`data-testid="automation-resistances">${display(f.spec.resistances)}</p>`)).toBe(true);expect(html.includes('<fieldset disabled=""')).toBe(true);expect(html.includes('实际伤害结算与减免仍需手动处理，不会自动改写生命值')).toBe(true);expect(d.trace.resistances.some(row=>row.includes(f.entry.name))).toBe(true);for(const row of d.trace.resistances)expect(html.includes(escape(row))).toBe(true);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.tempHp).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(1);
  if(key==='subrace/9')expect(f.rule.sourceProof.clause.origin).toBe('child-replacement-still-unconditional');
  if(key==='subrace/82'){expect(f.entry.name).toBe(f.rule.sourceProof.parent.normalizedHeader.name);expect(f.entry.english).toBe(f.rule.sourceProof.parent.normalizedHeader.english);expect(f.entry.id===f.rule.sourceProof.parent.normalizedId).toBe(false);expect(inheritedRacialResistanceSpecs.find(spec=>spec.key===key)!.header.name).toBeUndefined();}
 }
 for(const mode of ['source','canonical','automation']as const){const f=inheritedRacialResistanceFixture();if(mode==='source')f.c.profile.enabledSources=[];if(mode==='canonical')f.c.profile.disabledEntries=[f.entry.id];if(mode==='automation')f.c.automation!.enabled=false;const before=snapshot(f.c),d=evaluate(f.c),issues=d.issues.filter(issue=>issue.id.startsWith('racial-resistance:')),edit=vi.fn(),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d,entries:f.entries,edit,writable:false}));expect(d.resistances).toEqual([]);expect(issues.length).toBeGreaterThan(0);for(const issue of issues)expect(html.includes(escape(issue.message))).toBe(true);expect(html.includes('data-testid="automation-resistances">无</p>')).toBe(true);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);}
});
