import {beforeAll,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('../src/platform/workbench',()=>{const state={};return{inWorkbench:false,useWorkbench:()=>state,getWorkbench:()=>state,workbenchRequest:vi.fn(),requestInventory:vi.fn(),composeRoll:vi.fn()};});
vi.mock('../src/cloud/localRights',()=>({localGm:()=>false}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {evaluate} from '../src/core/engine';
import {variantItemResistanceBonusFixture} from './helpers/variantItemResistanceBonusFlowFixture';
import {variantItemResistanceBonusSpecs,variantItemResistanceBonusSourceEvidence,variantItemResistanceBonusSnapshot as snapshot} from './helpers/variantItemResistanceBonusSourceFixture';
beforeAll(()=>{variantItemResistanceBonusSourceEvidence();});
const escape=(value:string)=>value.replace(/[&<>"']/g,key=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}as Record<string,string>)[key]);

it('the existing readonly summary represents both editions, all body-armor tiers and admitted SCAG, and preserves inactive/forged diagnostics without saved writes',()=>{
 expect(variantItemResistanceBonusSpecs.length).toBeGreaterThan(0);
 // Full owner/form numerical proof is in the template-bounded workflow cases;
 // panel composition needs representative real sources, not 500 full renders.
 const representatives:Array<(typeof variantItemResistanceBonusSpecs)[number]>=[];for(const source of ['DMG','XDMG'])for(const tier of ['LA','MA','HA']){const spec=variantItemResistanceBonusSpecs.find(row=>row.templateHeader.source===source&&row.baseHeader.type===(source==='DMG'?tier:tier+'|XPHB'));expect(spec!==undefined).toBe(true);representatives.push(spec!);}const scag=variantItemResistanceBonusSpecs.find(row=>row.baseHeader.source==='SCAG');if(scag)representatives.push(scag);
 for(const form of ['canonical','app']as const)for(const spec of representatives){const f=variantItemResistanceBonusFixture(spec.key,form),before=snapshot(f.c),d=evaluate(f.c),edit=vi.fn(),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d,entries:f.entries,edit,writable:false}));expect(html.includes(`data-testid="automation-resistances">${spec.resistance}</p>`)).toBe(true);expect(html.includes('<fieldset disabled=""')).toBe(true);expect(html.includes('实际伤害结算与减免仍需手动处理，不会自动改写生命值')).toBe(true);expect(d.trace.resistances.length).toBeGreaterThan(0);for(const row of d.trace.resistances)expect(html.includes(escape(row))).toBe(true);expect(d.issues.some(issue=>issue.id===`item-resistance-bonus:unproved:${f.owner.id}`)).toBe(false);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);}
 for(const mode of ['source','equipment','attunement','forged']as const){const f=variantItemResistanceBonusFixture();if(mode==='source')f.c.profile.enabledSources=[];if(mode==='equipment')f.owner.equipped=false;if(mode==='attunement')f.owner.attuned=false;if(mode==='forged')f.entry.raw._variantIdentity+='|authored-unproved-tail';const before=snapshot(f.c),d=evaluate(f.c),issues=d.issues.filter(issue=>issue.id.startsWith('variant-item-resistance-bonus:')),edit=vi.fn(),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d,entries:f.entries,edit}));expect(d.resistances).toEqual([]);expect(issues.length).toBeGreaterThan(0);for(const issue of issues)expect(html.includes(escape(issue.message))).toBe(true);expect(html.includes('data-testid="automation-resistances">无</p>')).toBe(true);if(mode==='forged')expect(d.issues.some(issue=>issue.id===`item-resistance-bonus:unproved:${f.owner.id}`)).toBe(true);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);}
});
