import {beforeAll,expect,it,vi} from 'vitest';
// The real platform/authority modules need a URL in Node SSR, not fake providers.
vi.hoisted(()=>vi.stubGlobal('location',new URL('https://class-movement.invalid/')));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ClassMovementSummary} from '../src/ui/ClassMovementSummary';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {evaluate} from '../src/core/engine';
import {createCustomEntry} from '../src/core/customEntries';
import {newCharacter,uid,type Derived} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {classMovementFixture} from './helpers/classMovementFlowFixture';
import {classMovementSpecs,classMovementHeldEntries,classMovementSourceEvidence,classMovementSnapshot as snapshot} from './helpers/classMovementSourceFixture';
beforeAll(()=>{classMovementSourceEvidence();});
const summary=(d:Derived)=>renderToStaticMarkup(createElement(ClassMovementSummary,{d}));
const readonly=(html:string)=>expect(/<(?:input|button|select|textarea)\b/.test(html)).toBe(false);
const escape=(value:string)=>value.replace(/[&<>"']/g,key=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}as Record<string,string>)[key]);

it('all five genuine synchronized class sources render current walking and source provenance in both routes; Ranger modes stay50 under heavy while the readonly summary never adds walking again',()=>{
 for(const form of ['canonical','app']as const)for(const spec of classMovementSpecs){const f=classMovementFixture(spec.key,form),before=snapshot(f.c),d=evaluate(f.c),html=summary(d),bonus=spec.levelBonuses?spec.levelBonuses[spec.minLevel-1]:spec.walkingBonus;expect(d.speed).toBe(33+bonus!);expect(html.includes('aria-label="职业来源移动速度"')).toBe(true);expect(html.includes(`data-testid="class-movement-walking">${d.speed}</strong>`)).toBe(true);expect(html.includes('当前卡面步行结果')).toBe(true);expect(html.includes('不再次加值')).toBe(true);expect(html.includes('不改写人工覆盖或卡面调整')).toBe(true);expect(html.includes('墙面／水面行走与地形仍需人工处理')).toBe(true);expect(d.trace.classMovement.length).toBeGreaterThan(0);for(const row of d.trace.classMovement)expect(html.includes(escape(row))).toBe(true);for(const mode of ['swim','climb']as const)expect(html.includes(`data-testid="class-movement-${mode}">${d.speed}</strong>`)).toBe(spec.relativeModes.includes(mode));readonly(html);expect(snapshot(f.c)).toBe(before);}
 const f=classMovementFixture('ranger-xphb'),entry=createCustomEntry({name:'Authored heavy armor display control',type:'armor',body:'',raw:{type:'HA',armor:true,ac:16}});f.c.profile.enabledSources.push('CUSTOM');f.c.selections.push({id:uid(),entry,quantity:1,level:1,equipped:true});f.c.adjustments=[{id:'authored-final-walk',target:'speed',value:47,reason:'Authored final walking'}];const before=snapshot(f.c),d=evaluate(f.c),html=summary(d);expect(d.speed).toBe(50);expect(d.classMovement).toEqual({swim:50,climb:50});for(const mode of ['walking','swim','climb'])expect(html.includes(`data-testid="class-movement-${mode}">50</strong>`)).toBe(true);readonly(html);expect(snapshot(f.c)).toBe(before);
});

it('the actual panel integrates only qualified/held class summaries; actual TCE snapshots and book enablement alone do not grant Roving, and defensive layout is zero-safe',()=>{
 for(const spec of classMovementSpecs){const f=classMovementFixture(spec.key),before=snapshot(f.c),edit=vi.fn(),d=evaluate(f.c),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d,entries:f.entries,edit,writable:false}));expect(html.includes('data-class-movement-summary')).toBe(true);expect(html.includes(`data-testid="class-movement-walking">${d.speed}</strong>`)).toBe(true);expect(edit).not.toHaveBeenCalled();expect(snapshot(f.c)).toBe(before);}
 const held=classMovementHeldEntries();expect(held.length).toBe(2);const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB','TCE'];c.sheetBonuses={speed:3};c.selections=held.map(entry=>({id:uid(),entry:structuredClone(entry),quantity:1,level:1,equipped:false}));const before=snapshot(c),d=evaluate(c),issues=d.issues.filter(issue=>issue.id.startsWith('class-movement:')),edit=vi.fn(),html=renderToStaticMarkup(createElement(AutomationPanel,{c,d,entries:held,edit,writable:false}));expect(d.speed).toBe(33);expect(d.classMovement).toBeUndefined();expect(issues.length).toBeGreaterThan(0);for(const issue of issues)expect(html.includes(escape(issue.message))).toBe(true);expect(html.includes('data-testid="class-movement-swim"')).toBe(false);expect(html.includes('data-testid="class-movement-climb"')).toBe(false);expect(edit).not.toHaveBeenCalled();expect(snapshot(c)).toBe(before);
 // Synthetic data checks layout defenses only, not source authorization.
 const empty=evaluate(newCharacter('2014'));expect(summary(empty)).toBe('');for(const value of [-1,NaN,Infinity,'50',true]){empty.classMovement={swim:value,climb:value}as unknown as Derived['classMovement'];expect(summary(empty)).toBe('');}empty.classMovement={swim:0,climb:0};empty.speed=0;empty.trace.classMovement=['Authored provenance <marker>'];empty.issues.push({id:'class-movement:held',severity:'warning',message:'Authored held <reason>'},{id:'unrelated:held',severity:'warning',message:'Unrelated diagnostic'});const zero=summary(empty);for(const mode of ['walking','swim','climb'])expect(zero.includes(`data-testid="class-movement-${mode}">0</strong>`)).toBe(true);expect(zero.includes('Authored provenance &lt;marker&gt;')).toBe(true);expect(zero.includes('Authored held &lt;reason&gt;')).toBe(true);expect(zero.includes('Unrelated diagnostic')).toBe(false);readonly(zero);
});
