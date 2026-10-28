import {beforeAll,expect,it,vi} from 'vitest';
// Real providers; the actual pointerDrag module registers a sheet-gesture
// listener at import. Supply a real Node event host, not a module/provider mock.
vi.hoisted(()=>{vi.stubGlobal('location',new URL('https://racial-carrying.invalid/'));vi.stubGlobal('window',new EventTarget());});
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CarryCapacity} from '../src/ui/InventoryMarks';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {evaluate} from '../src/core/engine';
import {carrying,capacityFormula} from '../src/core/carrying';
import {racialCarryingFixture} from './helpers/racialCarryingFlowFixture';
import {racialCarryingSpecs,racialCarryingSourceEvidence,racialCarryingSnapshot as snapshot} from './helpers/racialCarryingSourceFixture';

beforeAll(()=>{racialCarryingSourceEvidence();});
const escape=(value:string)=>value.replace(/[&<>"']/g,key=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}as Record<string,string>)[key]);
const admitted=()=>{const keys=new Set(racialCarryingSourceEvidence().rules.map(rule=>rule.key));return racialCarryingSpecs.filter(spec=>keys.has(spec.key));};
const markup=(f:ReturnType<typeof racialCarryingFixture>,editing:boolean,edit=vi.fn())=>renderToStaticMarkup(createElement(SheetEditContext.Provider,{value:editing},createElement(CarryCapacity,{c:f.c,d:evaluate(f.c),edit})));

it('the real capacity component shows authenticated effective-size results and visible accessible source notes without editing physical size, Strength, inventory or resources',()=>{
 const specs=admitted();expect(specs.length).toBeGreaterThan(0);const keys=[...new Set([specs[0].key,specs[Math.floor(specs.length/2)].key,specs[specs.length-1].key])];
 for(const form of ['canonical','app']as const)for(const key of keys)for(const editing of [false,true]){const f=racialCarryingFixture(key,form),before=snapshot(f.c),d=evaluate(f.c),value=carrying(f.c,d),edit=vi.fn(),html=markup(f,editing,edit);expect(html.includes('title="力量 10 · 基础上限 300 磅">300</b>')).toBe(true);expect(html.includes('role="note" aria-label="负重来源说明"')).toBe(true);expect(value.sourceNotes.some(row=>row.includes(f.entry.name))).toBe(true);for(const row of value.sourceNotes)expect(html.includes(escape(row))).toBe(true);expect(html.includes('aria-label="负重上限调整"')).toBe(editing);expect(edit).not.toHaveBeenCalled();expect(f.c.size).toBe('M');expect(d.abilities.str).toBe(10);expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.resources.manual.current).toBe(1);}
});

it('manual holds, inactive or unproved sources and beyond-table sizes remain visible and readonly, while the previous invalid-formula numeric fallback is preserved exactly',()=>{
 for(const formula of ['*2','  *2  ','基础*2+力量']){const f=racialCarryingFixture();f.c.inventory!.capacityAdjustment=formula;const before=snapshot(f.c),value=carrying(f.c,evaluate(f.c)),edit=vi.fn(),html=markup(f,true,edit);expect(value.base).toBe(150);expect(value.max).toBe(capacityFormula(formula,150,10));expect(html.includes(`title="力量 10 · 基础上限 150 磅">${value.max.toLocaleString()}</b>`)).toBe(true);expect(html.includes(`value="${escape(formula)}"`)).toBe(true);expect(value.sourceNotes.length).toBeGreaterThan(0);for(const row of value.sourceNotes)expect(html.includes(escape(row))).toBe(true);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);}
 for(const mode of ['source','canonical','unknown-source','beyond']as const){const f=racialCarryingFixture();if(mode==='source')f.c.profile.enabledSources=[];if(mode==='canonical')f.c.profile.disabledEntries=[f.entry.id];if(mode==='unknown-source')f.entry.source='AUTHORED';if(mode==='beyond')f.c.size='G';const before=snapshot(f.c),d=evaluate(f.c),value=carrying(f.c,d),edit=vi.fn(),html=markup(f,false,edit);expect(value.base).toBe(d.abilities.str*(mode==='beyond'?120:15));expect(value.max).toBe(value.base);expect(value.sourceNotes.length).toBeGreaterThan(0);expect(html.includes('role="note" aria-label="负重来源说明"')).toBe(true);for(const row of value.sourceNotes)expect(html.includes(escape(row))).toBe(true);expect(/<(?:input|button|select|textarea)\b/.test(html)).toBe(false);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);}
 const invalid=racialCarryingFixture();invalid.c.size='L';invalid.c.inventory!.capacityAdjustment='window.alert(1)';const before=snapshot(invalid.c),d=evaluate(invalid.c),edit=vi.fn();expect(()=>carrying(invalid.c,d)).toThrow();const html=markup(invalid,false,edit);expect(html.includes(`title="力量 ${d.abilities.str} · 基础上限 ${d.abilities.str*15} 磅">${(d.abilities.str*15).toLocaleString()}</b>`)).toBe(true);expect(html.includes('aria-label="负重来源说明"')).toBe(false);expect(edit).not.toHaveBeenCalled();expect(snapshot(invalid.c)).toBe(before);
});
