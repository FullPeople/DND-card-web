import {expect,it,vi} from 'vitest';
vi.mock('../src/platform/workbench',()=>{const state={};return{inWorkbench:false,useWorkbench:()=>state,getWorkbench:()=>state,workbenchRequest:vi.fn(),requestInventory:vi.fn(),composeRoll:vi.fn()};});
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4',useSheetCaptureActive:()=>false}));
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {evaluate} from '../src/core/engine';
import {newCharacter,type Derived} from '../src/core/model';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {RacialMovementSummary} from '../src/ui/RacialMovementSummary';
import {racialMovementAllEntries,racialMovementDigest,racialMovementFixture,racialMovementSpecs} from './helpers/racialMovementFixture';

const renderSummary=(d:Derived)=>renderToStaticMarkup(createElement(RacialMovementSummary,{d}));
const synthetic=()=>evaluate(newCharacter('2014'));
const readonly=(html:string)=>expect(html).not.toMatch(/<(?:input|button|select|textarea)\b/);

it('layout-only synthetic projection labels each supported mode in feet with stable order and readonly source-base limits',()=>{
 const d=synthetic();d.sourceMovement={climb:20,swim:30};d.trace.sourceMovement=['Authored provenance <marker>'];const before=JSON.stringify(d),html=renderSummary(d);
 expect(html).toContain('aria-label="来源基础移动速度"');expect(html).toContain('游泳：<strong data-testid="racial-movement-swim">30</strong> 英尺');expect(html).toContain('攀爬：<strong data-testid="racial-movement-climb">20</strong> 英尺');expect(html.indexOf('racial-movement-swim')).toBeLessThan(html.indexOf('racial-movement-climb'));
 expect(html).toContain('不是最终移动速度');expect(html).toContain('不套用通用速度修正');expect(html).toContain('不改写卡面步行速度或手工调整');expect(html).toContain('Authored provenance &lt;marker&gt;');readonly(html);expect(JSON.stringify(d)).toBe(before);
});

it('layout-only absent projection never invents zero, walking-equivalent or unsupported fly/walk values',()=>{
 const d=synthetic();d.speed=777;let html=renderSummary(d);expect(html).toContain('不推定默认值或等同步行速度');expect(html).not.toContain('data-testid="racial-movement-');expect(html).not.toContain('777');readonly(html);
 d.sourceMovement={fly:999,walk:888} as unknown as Derived['sourceMovement'];html=renderSummary(d);expect(html).not.toContain('data-testid="racial-movement-');expect(html).not.toContain('999');expect(html).not.toContain('888');
});

it.each([0,-1,NaN,Infinity,-Infinity,'30',true])('layout-only malformed supported mode value %s is not a numeric source display',value=>{
 const d=synthetic();d.sourceMovement={swim:value,climb:value} as unknown as Derived['sourceMovement'];const html=renderSummary(d);expect(html).toContain('当前没有可核对的来源基础速度');expect(html).not.toContain('data-testid="racial-movement-');readonly(html);
});

it('layout-only held diagnostics remain visible and escaped without leaking unrelated rule diagnostics',()=>{
 const d=synthetic();d.issues=[{id:'racial-movement:authored-held',message:'Authored held <reason>',severity:'warning'},{id:'racial-darkvision:unrelated',message:'Unrelated diagnostic',severity:'warning'}];const html=renderSummary(d);expect(html).toContain('role="note">Authored held &lt;reason&gt;');expect(html).not.toContain('Unrelated diagnostic');expect(html).not.toContain('data-testid="racial-movement-');readonly(html);
});

it('static integration contract keeps the readonly derived-only summary next to vision and leaves the main walking speed consumer intact',()=>{
 const component=readFileSync(new URL('../src/ui/RacialMovementSummary.tsx',import.meta.url),'utf8'),panel=readFileSync(new URL('../src/ui/AutomationPanel.tsx',import.meta.url),'utf8'),overview=readFileSync(new URL('../src/ui/Overview.tsx',import.meta.url),'utf8');
 expect(component).toContain('({d}:{d:Derived})');expect(component).toContain('d.sourceMovement?.[mode]');expect(component).not.toMatch(/\b(?:Character|useState|useEffect|onChange|onClick|setAutomationEnabled|localStorage)\b|\.raw\b/);
 expect(panel).toMatch(/<RacialDarkvisionSummary d=\{d\}\/?>\s*<RacialMovementSummary d=\{d\}\/?>/);expect(overview).toContain('value={d.speed} target="speed"');expect(overview).not.toContain('sourceMovement');expect(overview).not.toContain('RacialMovementSummary');
});

// These use mandatory original bytes and independently checked clause pins,
// unlike the synthetic layout cases above. No remote catalog or jsdom is used.
it.each(racialMovementSpecs)('actual source projection $id shows only base $mode$baseFeet without touching any saved field',spec=>{
 const f=racialMovementFixture(spec.id),before=racialMovementDigest(f.c),d=evaluate(f.c);expect(d.sourceMovement).toEqual({[spec.mode]:spec.baseFeet});expect(d.speed).toBe(50);
 const html=renderSummary(d);expect(html).toContain(`data-testid="racial-movement-${spec.mode}">${spec.baseFeet}</strong>`);expect(html).toContain('aria-label="基础移动速度来源依据"');expect(html).toContain(f.entry.source);expect(html).not.toContain(`data-testid="racial-movement-${spec.mode==='swim'?'climb':'swim'}"`);expect(html).not.toContain('777');expect(html).not.toContain('>50</strong>');readonly(html);expect(racialMovementDigest(f.c)).toBe(before);
});

it.each(['kiwee:race:vgm:lizardfolk::::::','kiwee:race:vgm:tabaxi::::::'])('actual AutomationPanel integrates readonly source base for %s and preserves complete manual state and spent resources',id=>{
 const f=racialMovementFixture(id);f.c.abilities.str=13;f.c.proficiencies={athletics:true};f.c.expertise={athletics:true};f.c.training={tools:'Authored manual tools'};f.c.answers={authored:['retained manual answer']};f.c.runtime.inspiration=1;f.c.runtime.deathSaves={success:1,failure:2};
 const before=racialMovementDigest(f.c),edit=vi.fn(),d=evaluate(f.c),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d,entries:f.entries,edit,writable:false})),summary=html.match(/<section aria-label="来源基础移动速度"[\s\S]*?<\/section>/)?.[0];
 expect(summary).toBeDefined();expect(summary).toContain(`data-testid="racial-movement-${f.spec.mode}">${f.spec.baseFeet}</strong>`);expect(html.indexOf('data-racial-darkvision-summary')).toBeLessThan(html.indexOf('data-racial-movement-summary'));expect(summary).toContain('也不代表整条种族规则已自动化');readonly(summary!);expect(edit).not.toHaveBeenCalled();expect(d.speed).toBe(50);expect(f.c.runtime.resources.manual.current).toBe(1);expect(racialMovementDigest(f.c)).toBe(before);
 const reopened=readCharacter(exportCharacter(f.c)).character;expect(racialMovementDigest(reopened)).toBe(before);expect((reopened as unknown as Record<string,unknown>).sourceMovement).toBeUndefined();
});

it.each(['source-off','automation-off','entry-disabled'] as const)('actual source %s removes only the derived summary, not manual speed or spent state',change=>{
 const f=racialMovementFixture();expect(renderSummary(evaluate(f.c))).toContain('data-testid="racial-movement-swim">30</strong>');
 if(change==='source-off')f.c.profile.enabledSources=[];else if(change==='automation-off')f.c.automation!.enabled=false;else f.c.profile.disabledEntries=[f.entry.id];
 const before=racialMovementDigest(f.c),d=evaluate(f.c),html=renderSummary(d);expect(d.sourceMovement).toBeUndefined();expect(d.speed).toBe(50);expect(html).toContain('不推定默认值或等同步行速度');expect(html).not.toContain('data-testid="racial-movement-');expect(f.c.runtime.resources.manual.current).toBe(1);expect(racialMovementDigest(f.c)).toBe(before);readonly(html);
});

it('actual held Kor climbing and an edited source speed never display unauthenticated raw speed values',()=>{
 const f=racialMovementFixture(),held=racialMovementAllEntries().filter(entry=>entry.id==='kiwee:race:psz:kor::::::');expect(held).toHaveLength(1);f.owner.entry=structuredClone(held[0]);f.c.profile.enabledSources=[f.owner.entry.source,...(f.owner.entry.dependencies||[])];let before=racialMovementDigest(f.c),d=evaluate(f.c),html=renderSummary(d);
 expect(d.sourceMovement).toBeUndefined();expect(d.issues.some(issue=>issue.id.startsWith('racial-movement:'))).toBe(true);expect(html).toContain('role="note"');expect(html).not.toContain('data-testid="racial-movement-');expect(racialMovementDigest(f.c)).toBe(before);
 const edited=racialMovementFixture();edited.owner.entry.raw.speed={walk:123,swim:999,climb:888,fly:777};before=racialMovementDigest(edited.c);d=evaluate(edited.c);html=renderSummary(d);expect(d.sourceMovement).toBeUndefined();expect(html).toContain('当前没有可核对的来源基础速度');expect(html).not.toContain('data-testid="racial-movement-');for(const raw of ['123','999','888','777'])expect(html).not.toContain(raw);expect(racialMovementDigest(edited.c)).toBe(before);readonly(html);
});
