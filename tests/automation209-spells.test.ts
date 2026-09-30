import {describe,it,expect} from 'vitest';
import {newCharacter,type Character,type Entry,type Selection} from '../src/core/model';
import {newAutomationState,setAutomationEnabled} from '../src/core/automation/state';
import {planSourceSpells,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {changeSpecialSpellUses,setSpecialSpell,specialSpellResource} from '../src/core/specialSpells';
import {removeSelection,syncFeatures} from '../src/core/sheet';
import {prepareSpellEntry} from '../src/core/spells';
import {spellUsesPreparation} from '../src/core/spellcastingRules';
import {spellState} from '../src/core/characterDetails';
import {readCharacter} from '../src/core/validation';
import {exportOwlbear} from '../src/core/export';
import {evaluate} from '../src/core/engine';

function entry(id:string,kind:Entry['kind'],raw:Entry['raw']={},source='XPHB'):Entry{return {id,kind,name:id,english:id,source,edition:source==='XPHB'?'2024':'2014',packId:'fixture',revision:'1',entries:['原创软件验收条目。'],raw};}
const spells=[entry('测试光', 'spell',{level:0}),entry('测试盾','spell',{level:1}),entry('测试门','spell',{level:2})];
function setup(){const c=newCharacter();c.automation=newAutomationState();c.spellSettings={...spellState(c),mode:'prepared',modeOverride:true,capacity:5,capacityAdjustment:5};return c;}
function source(c:Character,raw:Entry['raw'],kind:Entry['kind']='race',id='来源'):Selection{const row={id,entry:entry(id,kind,raw),quantity:1,level:1,equipped:false};c.selections.push(row);return row;}
const grant=(c:Character)=>c.selections.find(s=>s.grantKey?.startsWith('source-spell:'))!;
const resource=(c:Character)=>c.runtime.resources[specialSpellResource(grant(c).id)];
describe('source-owned fixed spell grants',()=>{
 it('pure planning and idempotent reconciliation do not prepare or replenish spells',()=>{
  const c=setup();source(c,{additionalSpells:[{ability:'cha',known:{'1':['测试光|XPHB#c']},innate:{'1':{daily:{'1':['测试盾|XPHB']}}}}]});const before=JSON.stringify(c);
  expect(planSourceSpells(c,spells).grants).toHaveLength(2);expect(JSON.stringify(c)).toBe(before);expect(syncSourceSpells(c,spells)).toBe(true);
  const limited=c.selections.find(s=>s.entry.id==='测试盾')!;changeSpecialSpellUses(c,limited.id,0);expect(syncSourceSpells(c,spells)).toBe(false);expect(c.runtime.resources[specialSpellResource(limited.id)].current).toBe(0);expect(c.spellSettings!.prepared).toEqual([]);
 });
 it('keeps independently learned and other source copies when one owner is removed',()=>{
  const c=setup();source(c,{additionalSpells:[{prepared:{'_':['测试盾|XPHB']}}]});source(c,{additionalSpells:[{prepared:{'_':['测试盾|XPHB']}}]},'feat','第二来源');
  const independent={id:'learned',entry:spells[1],quantity:1,level:1,equipped:false};c.selections.push(independent);syncSourceSpells(c,spells);
  expect(c.selections.filter(s=>s.entry.kind==='spell')).toHaveLength(3);expect(spellUsesPreparation(c,spells[1],'learned')).toBe(true);expect(prepareSpellEntry(c,spells[1])).toBe('learned');
  expect(setSpecialSpell(c,grant(c).id)).toBe(false);removeSelection(c,grant(c).id);expect(c.selections.filter(s=>s.entry.kind==='spell')).toHaveLength(3);
  removeSelection(c,'来源');expect(c.selections.filter(s=>s.entry.kind==='spell').map(s=>s.parentId||s.id)).toEqual(['learned','第二来源']);expect(c.spellSettings!.prepared).toContain('learned');
 });
 it('keeps uses spent across source disable, automation toggle, save and reload',()=>{
  const c=setup();source(c,{additionalSpells:[{innate:{'1':{daily:{'2':['测试盾|XPHB']}}}}]});syncSourceSpells(c,spells);changeSpecialSpellUses(c,grant(c).id,1);
  c.profile.enabledSources=[];syncSourceSpells(c,spells);expect(c.spellSettings!.special![grant(c).id].sourceGrant!.active).toBe(false);changeSpecialSpellUses(c,grant(c).id,2);expect(resource(c).current).toBe(1);
  c.profile.enabledSources=['XPHB'];setAutomationEnabled(c,false);syncSourceSpells(c,spells);setAutomationEnabled(c,true);syncSourceSpells(c,spells);expect(resource(c).current).toBe(1);
  const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;expect(syncSourceSpells(restored,spells)).toBe(false);expect(resource(restored).current).toBe(1);
 });
 it('uses owning class level rather than total level and retains spent uses after lowering and raising',()=>{
  const c=setup(),owner=source(c,{additionalSpells:[{innate:{'3':{rest:{'1':['测试盾|XPHB']}}}}]},'class');source(c,{},'class','另一个职业').level=10;
  syncSourceSpells(c,spells);expect(grant(c)).toBeUndefined();owner.level=3;syncSourceSpells(c,spells);changeSpecialSpellUses(c,grant(c).id,0);owner.level=2;syncSourceSpells(c,spells);expect(c.spellSettings!.special![grant(c).id].sourceGrant!.active).toBe(false);
  owner.level=3;syncSourceSpells(c,spells);expect(resource(c).current).toBe(0);
 });
 it('restores a regenerated feature grant by its source path without granting spent uses again',()=>{
  const c=setup();source(c,{},'class','职业');const feature=source(c,{additionalSpells:[{innate:{'_':{daily:{'1':['测试盾|XPHB']}}}}]},'feature','feature-first');feature.parentId='职业';feature.grantKey='ref:fixture-level3';syncSourceSpells(c,spells);changeSpecialSpellUses(c,grant(c).id,0);
  removeSelection(c,feature.id,false);const next=structuredClone(feature);next.id='feature-regenerated';c.selections.push(next);syncSourceSpells(c,spells);expect(resource(c).current).toBe(0);
 });
 it('does not replenish a missing persisted counter and does not let normal feature sync remove source spells',()=>{
  const c=setup();source(c,{additionalSpells:[{innate:{'_':{daily:{'1':['测试盾|XPHB']}}}}]});syncSourceSpells(c,spells);const id=grant(c).id;delete c.runtime.resources[specialSpellResource(id)];syncFeatures(c,spells);syncSourceSpells(c,spells);expect(grant(c).id).toBe(id);expect(resource(c).current).toBe(0);
 });
 it('resolves default PHB sources without merging 2014 and 2024 or ambiguous identities',()=>{
  const c=setup();source(c,{additionalSpells:[{known:{'_':['测试盾']}}]});const old=entry('测试盾','spell',{level:1},'PHB');old.id='old';syncSourceSpells(c,[old,...spells]);expect(grant(c)).toBeUndefined();c.profile.optional.legacy=true;syncSourceSpells(c,[old,...spells]);expect(grant(c).entry.source).toBe('PHB');
  const other=setup();source(other,{additionalSpells:[{known:{'_':['测试盾|XPHB']}}]});const duplicate={...spells[1],id:'another-identity'};expect(planSourceSpells(other,[...spells,duplicate]).issues.some(i=>i.message.includes('多个身份'))).toBe(true);syncSourceSpells(other,[...spells,duplicate]);expect(grant(other)).toBeUndefined();
 });
 it('records explicit set and ability choices without guessing or resetting resources when switched',()=>{
  const c=setup();source(c,{additionalSpells:[{name:'甲',ability:{choose:['int','cha']},innate:{'_':{daily:{'1':['测试盾|XPHB']}}}},{name:'乙',known:{'_':['测试光|XPHB#c']}}]});syncSourceSpells(c,spells);expect(grant(c)).toBeUndefined();
  c.automation!.spellSets={'来源':0};c.automation!.spellAbilities={'来源:0':'cha'};syncSourceSpells(c,spells);expect(c.spellSettings!.special![grant(c).id].sourceGrant!.ability).toBe('cha');changeSpecialSpellUses(c,grant(c).id,0);
  c.automation!.spellSets['来源']=1;syncSourceSpells(c,spells);c.automation!.spellSets['来源']=0;syncSourceSpells(c,spells);expect(resource(c).current).toBe(0);
 });
 it('reports unresolved choices and expanded access while allowing declared shared spells',()=>{
  const c=setup();source(c,{additionalSpells:[{known:{'_':[{choose:'level=0'}]},expanded:{s1:['测试盾|XPHB']},innate:{'_':{daily:{'1':['测试盾|XPHB','测试门|XPHB']}}}}]});
  const plan=planSourceSpells(c,spells);expect(plan.issues).toHaveLength(3);syncSourceSpells(c,spells);expect(grant(c)).toBeUndefined();c.automation!.spellUsageModes={[plan.choices.find(choice=>choice.usageModes)!.key]:'shared'};syncSourceSpells(c,spells);expect(c.selections.filter(s=>s.entry.kind==='spell')).toHaveLength(2);expect(Object.keys(c.runtime.resources)).toHaveLength(1);
 });
 it('distinguishes per-spell uses and refuses malformed imported source metadata',()=>{
  const c=setup();source(c,{additionalSpells:[{prepared:{'_':{daily:{'1e':['测试盾|XPHB','测试门|XPHB']}}}}]});syncSourceSpells(c,spells);expect(Object.keys(c.runtime.resources)).toHaveLength(2);changeSpecialSpellUses(c,grant(c).id,0);expect(Object.values(c.runtime.resources).map(r=>r.current).sort()).toEqual([0,1]);
  c.spellSettings!.special![grant(c).id].sourceGrant!.active='yes' as any;expect(()=>readCharacter(c)).toThrow(/来源法术/);
 });
 it('does not expose an inactive source spell as a usable legacy projection before reconciliation',()=>{
  const c=setup(),owner=source(c,{additionalSpells:[{innate:{'_':{daily:{'1':['测试盾|XPHB']}}}}]});syncSourceSpells(c,spells);expect(exportOwlbear(c,evaluate(c)).spellcasting.always_known).toHaveLength(1);
  c.profile.disabledEntries=[owner.entry.id];expect(exportOwlbear(c,evaluate(c)).spellcasting.always_known).toHaveLength(0);changeSpecialSpellUses(c,grant(c).id,0);expect(resource(c).current).toBe(1);
  c.profile.disabledEntries=[];c.automation!.protocol=999;changeSpecialSpellUses(c,grant(c).id,0);expect(resource(c).current).toBe(1);expect(exportOwlbear(c,evaluate(c)).spellcasting.always_known).toHaveLength(0);
 });
});
