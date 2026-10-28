import {beforeAll,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Entry,Selection} from '../src/core/model';
import {createCustomEntry} from '../src/core/customEntries';
import {evaluate} from '../src/core/engine';
import {activeEffectSelections} from '../src/core/automation/active';
import {evaluateArmor} from '../src/core/automation/equipment';
import ordinary from '../src/core/automation/ordinarySpellCastingEvidence.json';
import {projectRacialNaturalArmor,racialNaturalArmorRule,type RacialNaturalArmorContext} from '../src/core/automation/racialNaturalArmor';
import {racialNaturalArmorFixture} from './helpers/racialNaturalArmorFlowFixture';
import {racialNaturalArmorSpecs,racialNaturalArmorSourceEvidence,racialNaturalArmorSnapshot as snapshot} from './helpers/racialNaturalArmorSourceFixture';
import {naturalArmorEquipmentPin,naturalArmorEquipmentSelection,naturalArmorEquipmentFind,naturalArmorEquipmentSourceProof} from './helpers/naturalArmorEquipmentSourceFixture';

beforeAll(()=>{racialNaturalArmorSourceEvidence();naturalArmorEquipmentSourceProof();},30000);
type Fixture=ReturnType<typeof racialNaturalArmorFixture>;
function context(f:Fixture):RacialNaturalArmorContext{const d=evaluate(f.c);return{modifiers:d.modifiers,armor:evaluateArmor(f.c,activeEffectSelections(f.c),d.modifiers.dex)};}
function projected(f:Fixture,ctx=context(f)){const before=snapshot(f.c),armor=snapshot(ctx.armor??null),p=projectRacialNaturalArmor(f.c,ctx);expect(snapshot(f.c)).toBe(before);expect(snapshot(ctx.armor??null)).toBe(armor);return p;}
function held(f:Fixture,ctx=context(f)){const p=projected(f,ctx);expect(p.base).toBeUndefined();expect(p.bonus).toBe(0);expect(p.grants).toHaveLength(0);expect(p.issues.some(issue=>issue.id.startsWith('racial-natural-armor:'))).toBe(true);expect(p.trace.length).toBeGreaterThan(0);return p;}
function equip(f:Fixture,key:'leather'|'plate'|'shield',form:'canonical'|'app'='canonical'){const row=naturalArmorEquipmentSelection(key,form);f.c.selections.push(row);f.c.profile.enabledSources=[...new Set([...f.c.profile.enabledSources,row.entry.source,...(row.entry.dependencies||[])])];return row;}
function manualArmor(f:Fixture,raw:Record<string,unknown>){const entry=createCustomEntry({name:'Authored negative-only armor context',type:'armor',body:'',raw}),row:Selection={id:'authored-negative-armor',entry,quantity:1,level:1,equipped:true};f.c.selections.push(row);f.c.profile.enabledSources.push(entry.source);return row;}
function freeze(value:unknown):void{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}}

it('authenticates every actual canonical/App owner and projects eight source bases or two unconditional flat bonuses without other mutation',()=>{
 for(const form of ['canonical','app']as const)for(const spec of racialNaturalArmorSpecs){const f=racialNaturalArmorFixture(spec.key,form),ctx=context(f),p=projected(f,ctx),policy=spec.policy;expect(racialNaturalArmorRule(f.entry)?.id).toBe(f.rule.id);const modifier=policy.modifier==='dex'?ctx.modifiers.dex:policy.modifier==='con'?ctx.modifiers.con:0;expect(p.base).toBe(policy.operation==='alternative-base'?policy.constant+modifier:undefined);expect(p.bonus).toBe(policy.operation==='additive-bonus'?policy.constant:0);expect(p.grants).toHaveLength(1);expect(p.grants[0].selectionId).toBe(f.owner.id);expect(p.grants[0].entryId).toBe(f.rule.id);expect(p.issues).toHaveLength(0);expect(f.c.size).toBe('M');expect(f.c.runtime.resources.manual.current).toBe(1);expect(f.c.inventory?.coins.gp).toBe(7);expect(f.c.runtime.hp).toBe(3);}
});
it('keeps original racial evidence byte-identical while qualifying only three real plain-gear validation contexts from one complete second original',()=>{
 const bytes=readFileSync('src/core/automation/racialNaturalArmorEvidence.json'),before=snapshot([...bytes]),proof=naturalArmorEquipmentSourceProof();expect(proof.inputs).toEqual([naturalArmorEquipmentPin]);expect(naturalArmorEquipmentPin.bytes).toBe(149813);expect(proof.rows).toHaveLength(3);expect(new Set(proof.rows.map(row=>row.id)).size).toBe(3);for(const row of proof.rows){expect(row.category).toBe('baseitem');expect(row.forms).toHaveLength(2);expect(row.forms[0].sha256).toBe(row.forms[1].sha256);for(const form of ['canonical','app']as const){const entry=naturalArmorEquipmentFind(row.key,form);expect(entry.id).toBe(row.id);expect(entry.revision).toBe(naturalArmorEquipmentPin.sha256);expect(entry.raw.ac).toBe(row.ac);expect(entry.raw.type).toBe(row.type);expect(entry.raw.bonusAc).toBeUndefined();}}expect(snapshot([...readFileSync('src/core/automation/racialNaturalArmorEvidence.json')])).toBe(before);
});
it('requires one current complete race root, real source authority and a supplied-active intersection without item-like ownership gates',()=>{
 const changes:((f:Fixture)=>void)[]=[f=>{f.c.automation!.enabled=false;},f=>{f.c.automation!.protocol=99;},f=>{f.c.automation!.rulesVersion='authored-future';},f=>{f.c.profile.enabledSources=[];},f=>{f.owner.parentId='authored-missing';},f=>{f.owner.grantKey='authored-inline';},f=>{f.owner.requirementId='authored-choice';},f=>{f.owner.id='';},f=>{f.c.selections.push({...structuredClone(f.owner),id:'authored-second-race'});},f=>{f.c.selections.push({...structuredClone(f.owner),entry:{...structuredClone(f.entry),kind:'item'}});}];
 for(const change of changes){const f=racialNaturalArmorFixture();change(f);held(f);}
 for(const quantity of [0,2,1.5]){const f=racialNaturalArmorFixture();f.owner.quantity=quantity;f.owner.level=0;f.owner.equipped=false;f.owner.attuned=false;expect(projected(f).base).toBe(15);}
 const f=racialNaturalArmorFixture(),ctx=context(f);expect(projectRacialNaturalArmor(f.c,ctx,[f.owner]).base).toBe(15);expect(projectRacialNaturalArmor(f.c,ctx,[]).grants).toHaveLength(0);expect(projectRacialNaturalArmor(f.c,ctx,[structuredClone(f.owner)]).grants).toHaveLength(0);f.c.profile.enabledSources=[];expect(projectRacialNaturalArmor(f.c,ctx,[f.owner]).grants).toHaveLength(0);
});
it('accepts coherent complete-source transport aliases but rejects reserved IDs, canonical/alias opt-outs and edited full payloads',()=>{
 const f=racialNaturalArmorFixture(),id=f.rule.id;f.entry.id='authored-natural-armor-transport-alias';f.entry.revision='authored-current-transport';expect(projected(f).base).toBe(15);for(const disabled of [id,f.entry.id]){f.c.profile.disabledEntries=[disabled];held(f);}delete f.c.profile.disabledEntries;f.entry.id=ordinary.canonicalIds.find(id=>id.startsWith('kiwee:spell:'))!;held(f);
 const changes:((entry:Entry)=>void)[]=[e=>{e.raw.authoredExtra=true;},e=>{e.entries=[...e.entries,'Authored edited complete snapshot'];},e=>{e.packId='authored-foreign';},e=>{e.source='AUTHORED';},e=>{e.edition='2024';},e=>{e.name+=' authored';},e=>{e.english+=' authored';},e=>{e.page=(e.page??0)+1;},e=>{e.raw._copy={name:'Authored copied payload'};},e=>{e.raw._category='subrace';},e=>{e.effects=[{op:'add',target:'ac',value:8}];}];for(const change of changes){const f=racialNaturalArmorFixture();change(f.entry);expect(racialNaturalArmorRule(f.entry)).toBeUndefined();held(f);}
});
it('keeps no-body-armor conditions blocked by physical armor even with its source disabled, while shields are not body armor',()=>{
 for(const key of ['race/9','race/142'])for(const form of ['canonical','app']as const){const f=racialNaturalArmorFixture(key,form),body=equip(f,'leather',form);held(f);f.c.profile.disabledEntries=[body.entry.id];held(f);f.c.profile.disabledEntries=[];body.equipped=false;const shield=equip(f,'shield',form),ctx=context(f),p=projected(f,ctx);expect(p.base).toBe(15);expect(p.bonus).toBe(0);expect(ctx.armor?.bonus).toBe(2);expect(shield.quantity).toBe(1);}
});
it('selects one proven plain calculation when worn armor is lower, retains higher armor and adds no second shield or armor bonus',()=>{
 for(const key of ['race/105','race/106','race/107','race/109'])for(const form of ['canonical','app']as const){const f=racialNaturalArmorFixture(key,form),body=equip(f,'leather',form);equip(f,'shield',form);const ctx=context(f),p=projected(f,ctx),natural=f.spec.policy.constant+(f.spec.policy.modifier==='con'?ctx.modifiers.con:ctx.modifiers.dex);expect(ctx.armor?.base).toBe(13);expect(ctx.armor?.bonus).toBe(2);expect(p.base).toBe(natural);expect(p.bonus).toBe(0);expect((p.base??ctx.armor!.base)+ctx.armor!.bonus).toBe(natural+2);body.equipped=false;equip(f,'plate',form);const high=context(f),kept=projected(f,high);expect(high.armor?.base).toBe(18);expect(kept.base).toBeUndefined();expect(kept.bonus).toBe(0);expect(high.armor?.bonus).toBe(2);}
});
it('holds unknown, conflicting, disabled-source and enchanted body comparisons without changing existing armor results or stored wearing state',()=>{
 for(const raw of [{type:'AUTHORED_UNKNOWN',armor:true,ac:11},{type:'LA',ac:11,bonusAc:1},{type:'LA',ac:11,reqAttune:true}]){const f=racialNaturalArmorFixture('race/105');manualArmor(f,raw);const ctx=context(f),before=snapshot(ctx.armor);held(f,ctx);expect(snapshot(ctx.armor)).toBe(before);}
 const conflict=racialNaturalArmorFixture('race/105');equip(conflict,'leather');equip(conflict,'plate');held(conflict);const disabled=racialNaturalArmorFixture('race/105'),body=equip(disabled,'leather');disabled.c.profile.disabledEntries=[body.entry.id];held(disabled);expect(body.equipped).toBe(true);
 const malformed=racialNaturalArmorFixture('race/105');equip(malformed,'leather');held(malformed,{modifiers:evaluate(malformed.c).modifiers});const mismatch=context(malformed);mismatch.armor!.base+=1;held(malformed,mismatch);
});
it('uses fixed Tortle17 independently of positive/negative Dex, explicitly holds illegal body armor and keeps explicit-base versus flat-bonus policy separate',()=>{
 for(const key of ['race/145','race/146'])for(const dex of [4,30]){const f=racialNaturalArmorFixture(key);f.c.abilities.dex=dex;expect(projected(f).base).toBe(17);equip(f,'leather');expect(held(f).trace.join(' ')).toContain('17');}
 for(const key of ['race/9','race/145']){const f=racialNaturalArmorFixture(key),ctx=context(f);ctx.explicitBaseOverride=23;held(f,ctx);}
 for(const [key,bonus]of [['race/104',3],['race/150',1]]as const){const f=racialNaturalArmorFixture(key);equip(f,'plate');const ctx=context(f);ctx.explicitBaseOverride=23;const p=projected(f,ctx);expect(p.base).toBeUndefined();expect(p.bonus).toBe(bonus);f.c.adjustments=[{id:'authored-manual-final',target:'ac',value:29,reason:'Authored manual final'}];expect(evaluate(f.c).ac).toBe(31);}
});
it('retains current 2024 shield-training policy and frozen-card/resource/derived-context purity without granting a hide action',()=>{
 const f=racialNaturalArmorFixture('race/105');f.c.edition='2024';equip(f,'shield');f.c.training={armor:''};let ctx=context(f);expect(ctx.armor?.bonus).toBe(0);expect(projected(f,ctx).base).toBe(15);f.c.training.armor='盾牌';ctx=context(f);expect(ctx.armor?.bonus).toBe(2);expect(projected(f,ctx).base).toBe(15);
 const hide=racialNaturalArmorFixture('race/142'),before=snapshot(hide.c),frozenContext=context(hide),contextBefore=snapshot(frozenContext);freeze(hide.c);freeze(frozenContext);const p=projectRacialNaturalArmor(hide.c,frozenContext);expect(p.base).toBe(15);expect(p.grants.every(grant=>grant.operation==='alternative-base')).toBe(true);expect(p.trace.some(text=>text.includes('仍手工'))).toBe(true);expect(snapshot(hide.c)).toBe(before);expect(snapshot(frozenContext)).toBe(contextBefore);
});
