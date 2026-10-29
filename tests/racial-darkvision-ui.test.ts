import {beforeAll,expect,it,vi} from 'vitest';
vi.mock('../src/platform/workbench',()=>{const state={};return{inWorkbench:false,useWorkbench:()=>state,getWorkbench:()=>state,workbenchRequest:vi.fn(),requestInventory:vi.fn(),composeRoll:vi.fn()};});
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4',useSheetCaptureActive:()=>false}));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {evaluate} from '../src/core/engine';
import {racialDarkvisionFixture,racialDarkvisionEntries,racialDarkvisionDigest} from './helpers/racialDarkvisionFixture';
beforeAll(()=>{racialDarkvisionEntries();});
it('actual PHB Dwarf evaluator range is visible as readonly source60 rather than raw tags or a progress count',()=>{
 const f=racialDarkvisionFixture(),before=racialDarkvisionDigest(f.c),d=evaluate(f.c);expect(d.senses?.darkvision).toBe(60);const html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d,entries:f.entries,edit:()=>{}}));expect(html).toContain('data-testid="racial-darkvision-range">60</strong>');expect(html).toContain('来源黑暗视觉范围');expect(racialDarkvisionDigest(f.c)).toBe(before);
});
import {RacialDarkvisionSummary} from '../src/ui/RacialDarkvisionSummary';
import {removeSelection} from '../src/core/sheet';
import {readCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
const summary=(f:ReturnType<typeof racialDarkvisionFixture>)=>renderToStaticMarkup(createElement(RacialDarkvisionSummary,{d:evaluate(f.c)}));
const manual=(f:ReturnType<typeof racialDarkvisionFixture>)=>racialDarkvisionDigest([f.c.notes,f.c.runtime,f.c.adjustments,f.c.sheetBonuses,f.c.skillBonuses,f.c.saveBonuses,f.c.abilities]);
it('actual XPHB Dwarf source120 and its provenance remain readonly and preserve the complete native character',()=>{
 const f=racialDarkvisionFixture('kiwee:race:xphb:dwarf::::::'),before=racialDarkvisionDigest(f.c),d=evaluate(f.c);expect(d.senses?.darkvision).toBe(120);const html=summary(f);expect(html).toContain('data-testid="racial-darkvision-range">120</strong>');expect(html).toContain('XPHB');expect(html).toContain('仍需人工处理');expect(html).not.toMatch(/<(?:input|button|select)\b/);expect(html).not.toContain('777');const edit=vi.fn(),panel=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d,entries:f.entries,edit,writable:false}));expect(panel).toContain('data-testid="racial-darkvision-range">120</strong>');expect(edit).not.toHaveBeenCalled();expect(racialDarkvisionDigest(f.c)).toBe(before);const reopened=readCharacter(exportCharacter(f.c)).character;expect(racialDarkvisionDigest(reopened)).toBe(before);expect((reopened as any).senses).toBeUndefined();
});
it('actual conditional Custom Lineage remains visibly held with no invented zero or default60',()=>{
 const f=racialDarkvisionFixture('kiwee:race:tce:custom%20lineage::::::'),before=racialDarkvisionDigest(f.c),d=evaluate(f.c);expect(d.senses?.darkvision).toBeUndefined();expect(d.issues.some(issue=>issue.id.startsWith('racial-darkvision:'))).toBe(true);const html=summary(f);expect(html).toContain('不推定默认距离');expect(html).not.toContain('data-testid="racial-darkvision-range"');expect(html).not.toMatch(/>(?:0|60)<\/strong>/);expect(racialDarkvisionDigest(f.c)).toBe(before);
});
it('source-off and real race replacement remove the derived display without changing manual notes, adjustments or spent runtime history',()=>{
 const f=racialDarkvisionFixture(),protectedBefore=manual(f);expect(summary(f)).toContain('data-testid="racial-darkvision-range">60</strong>');f.c.profile.enabledSources=[];let before=racialDarkvisionDigest(f.c);expect(evaluate(f.c).senses?.darkvision).toBeUndefined();expect(summary(f)).not.toContain('data-testid="racial-darkvision-range"');expect(racialDarkvisionDigest(f.c)).toBe(before);expect(manual(f)).toBe(protectedBefore);
 const replacement=racialDarkvisionFixture('kiwee:race:phb:human::::::');removeSelection(f.c,f.owner.id);f.c.selections.push({...replacement.owner,id:'authored-human-root',entry:structuredClone(replacement.entry)});f.c.profile.enabledSources=[...replacement.c.profile.enabledSources];before=racialDarkvisionDigest(f.c);expect(evaluate(f.c).senses?.darkvision).toBeUndefined();expect(summary(f)).toContain('不推定默认距离');expect(summary(f)).not.toContain('data-testid="racial-darkvision-range"');expect(racialDarkvisionDigest(f.c)).toBe(before);expect(manual(f)).toBe(protectedBefore);const reopened=readCharacter(exportCharacter(f.c)).character;expect(racialDarkvisionDigest(reopened)).toBe(before);
});
it('editing a real saved raw range cannot turn an unproved snapshot or manual777 note into an authoritative numeric display',()=>{
 const f=racialDarkvisionFixture();f.owner.entry.raw.darkvision=999;const before=racialDarkvisionDigest(f.c),d=evaluate(f.c),html=summary(f);expect(d.senses?.darkvision).toBeUndefined();expect(html).toContain('不推定默认距离');expect(html).not.toContain('data-testid="racial-darkvision-range"');expect(html).not.toContain('999');expect(html).not.toContain('777');expect(racialDarkvisionDigest(f.c)).toBe(before);
});
