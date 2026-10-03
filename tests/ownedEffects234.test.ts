import {irFixture} from './helpers/irFixture';
import {irCharacter as newCharacter} from './helpers/irFixture';
import {describe,it,expect} from 'vitest';
import {selectionAllowed,selectionEffectsAllowed,type Entry} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {selectionActive} from '../src/core/automation/choices';
import {planFeatureResources,syncFeatureResources} from '../src/core/automation/featureResources';
import {planSourceSpells,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {sourceSpellEnabled} from '../src/core/automation/sourceSpellState';
import {newAutomationState} from '../src/core/automation/state';
import {spellIsReady} from '../src/core/spellWorkspace';
import {hitPointLevels} from '../src/core/hitPoints';
import {characterReview} from '../src/core/characterReview';
import {exportCharacter} from '../src/core/export';
import {validateCharacter} from '../src/core/validation';

const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>(irFixture({id,name:id,english:id,kind,source:'PHB',edition:'2014',packId:'fixture',revision:'original',entries:[],raw}));
function card(){
 const c=newCharacter('2014');c.automation=newAutomationState();c.abilities.con=14;
 c.selections=[
  {id:'class',entry:entry('Original Scholar','class',{hd:{faces:6},casterProgression:'full',spellcastingAbility:'int',preparedSpellsProgression:[2],cantripProgression:[1]}),level:1,quantity:1,equipped:false},
  {id:'feature',parentId:'class',entry:irFixture({...entry('Original Feature','feature',{className:'Original Scholar',classSource:'PHB',level:1,cantripBonus:1,resources:[{name:'耐力次数',max:'@abilities.con.mod',recovery:'long'}],additionalSpells:[{ability:'int',innate:{'1':{daily:{'1':['Gift|PHB']}}}}]}),effects:[{op:'proficiency',skill:'arcana'},{op:'add',target:'int',value:2}]}),level:1,quantity:1,equipped:false},
  {id:'race',entry:entry('Original Race','race',{ability:[{con:2}],speed:25}),level:1,quantity:1,equipped:false},
 ];
 const spell=entry('Gift','spell',{level:1});syncSourceSpells(c,[spell]);syncFeatureResources(c);
 return {c,spell};
}
describe('owned source effects across card editions',()=>{
 it('keeps abilities, skills, health and spent feature resources across edition changes without replacing snapshots',()=>{
  const {c,spell}=card(),before=structuredClone(c.selections),grant=planFeatureResources(c).grants[0],gift=planSourceSpells(c,[spell]).grants[0];
  c.runtime.resources[grant.key].current=1;c.edition='2024';c.profile.optional.legacy=false;delete c.racialAbilityMode;
  syncSourceSpells(c,[{...spell,revision:'new-download'}]);syncFeatureResources(c);
  expect(c.selections).toEqual(before);expect(c.abilities.con).toBe(14);expect(c.runtime.resources[grant.key]).toMatchObject({max:3,current:1});
  const d=evaluate(c);expect(d.abilities).toMatchObject({con:16,int:12});expect(d.skills.arcana.proficient).toBe(true);expect(d.level).toBe(1);expect(d.maxHp).toBe(9);expect(hitPointLevels(c,d.modifiers.con)).toHaveLength(1);
  expect(selectionActive(c,c.selections.find(row=>row.id==='feature')!)).toBe(true);expect(sourceSpellEnabled(c,gift.id)).toBe(false);expect(spellIsReady(c,c.selections.find(row=>row.id===gift.id)!)).toBe(false);
  expect(characterReview(c).restricted).toEqual([]);
  expect(selectionAllowed(c,c.selections[0].entry)).toBe(false);expect(selectionEffectsAllowed(c,c.selections[0].entry)).toBe(true);
  const restored=validateCharacter(exportCharacter(c));expect(evaluate(restored).abilities).toEqual(d.abilities);expect(restored.selections).toEqual(c.selections);expect(restored.racialAbilityMode).toBeUndefined();
 });
 it.each(['source','entry','dependency','parent-source','parent-entry'] as const)('still suspends %s-disabled owned feature effects and restores spent resources',reason=>{
  const {c,spell}=card();c.edition='2024';const feature=c.selections.find(s=>s.id==='feature')!,owner=c.selections[0],grant=planFeatureResources(c).grants[0],gift=planSourceSpells(c,[spell]).grants[0];c.runtime.resources[grant.key].current=1;
  if(reason==='source')c.profile.enabledSources=c.profile.enabledSources.filter(source=>source!=='PHB');
  if(reason==='entry')c.profile.disabledEntries=[feature.entry.id];
  if(reason==='dependency')feature.entry.dependencies=['MISSING'];
  if(reason==='parent-source')owner.entry.source='MISSING';
  if(reason==='parent-entry')c.profile.disabledEntries=[owner.entry.id];
  syncSourceSpells(c,[spell]);syncFeatureResources(c);
  expect(evaluate(c).abilities.int).toBe(10);expect(evaluate(c).skills.arcana.proficient).toBe(false);expect(planFeatureResources(c).grants).toEqual([]);expect(selectionActive(c,feature)).toBe(false);expect(sourceSpellEnabled(c,gift.id)).toBe(false);expect(spellIsReady(c,c.selections.find(row=>row.id===gift.id)!)).toBe(false);
  expect(characterReview(c).restricted.some(s=>s.id===feature.id)).toBe(true);
  c.profile.enabledSources.push('PHB');c.profile.disabledEntries=[];delete feature.entry.dependencies;owner.entry.source='PHB';syncSourceSpells(c,[spell]);syncFeatureResources(c);
  expect(evaluate(c).abilities.int).toBe(12);expect(c.runtime.resources[grant.key]).toMatchObject({max:3,current:1});expect(sourceSpellEnabled(c,gift.id)).toBe(false);
 });
 it('retains feat opt-outs, exceptions and explicit disabled-entry priority',()=>{
  const c=newCharacter('2024'),feat:Entry=irFixture({...entry('Original Feat','feat'),effects:[{op:'add' as const,target:'str',value:2}]});c.selections=[{id:'feat',entry:feat,level:1,quantity:1,equipped:false}];
  expect(evaluate(c).abilities.str).toBe(12);c.profile.optional.feats=false;expect(evaluate(c).abilities.str).toBe(10);
  c.profile.exceptions[feat.id]='DM批准';expect(evaluate(c).abilities.str).toBe(12);c.profile.disabledEntries=[feat.id];expect(evaluate(c).abilities.str).toBe(10);expect(selectionAllowed(c,feat)).toBe(false);
 });
});
