import {it,expect} from 'vitest';
import {newCharacter,type Character} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {newAutomationState} from '../src/core/automation/state';
import {evaluate} from '../src/core/engine';

// Original regression: recording a learned infusion and an explicit target has
// no AC effect on the baseline. Authored fixtures are not full source replay.
export function setup(){
 const entries=normalizeData({class:[{name:'奇械师',ENG_name:'Artificer',source:'TCE',edition:'classic',classFeatures:['物品注法|奇械师|TCE|2'],optionalfeatureProgression:[{name:'注法',featureType:['AI'],progression:[0,4,4,4,4,6,6,6,6,8,8,8,8,10,10,10,10,12,12,12]}]}],classFeature:[{name:'物品注法',ENG_name:'Infuse Item',source:'TCE',className:'奇械师',classSource:'TCE',level:2,entries:[]}],optionalfeature:[{name:'增强防御',ENG_name:'Enhanced Defense',source:'TCE',featureType:['AI'],prerequisite:[{item:['一套盔甲或一面盾牌']}],entries:[]}],item:[{name:'测试皮甲',source:'PHB',type:'LA',ac:11,rarity:'none'},{name:'测试盾牌',source:'PHB',type:'S',ac:2,rarity:'none'}]},'authored-infusion');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['TCE','PHB'];
 const owner=entries.find(e=>e.kind==='class')!,infusion=entries.find(e=>e.raw._category==='optionalfeature')!;
 c.selections=[{id:'owner',entry:owner,level:2,quantity:1,equipped:false},...entries.filter(e=>e.kind==='item').map((entry,i)=>({id:'item'+i,entry,level:1,quantity:1,equipped:i===0}))];
 c.selections.push({id:'infuse-feature',entry:entries.find(e=>e.raw._category==='classFeature')!,parentId:'owner',grantKey:'ref:物品注法|奇械师|TCE|2',level:2,quantity:1,equipped:false});
 const choiceId='owner:class-optional:0';c.answers[choiceId]=[infusion.id];c.classChoiceSnapshots={[infusion.id]:infusion};
 return {c,infusion,choiceId,entries};
}
it('applies explicitly activated enhanced defense without changing manual AC',()=>{
 const {c,infusion,choiceId}=setup();c.sheetBonuses={ac:3};
 (c as Character&{infusions:unknown}).infusions={version:1,bindings:[{choiceId,entryId:infusion.id,targetId:'item0'}]};
 expect(evaluate(c).ac).toBe(15);expect(c.sheetBonuses.ac).toBe(3);
});

import {setInfusionTarget,evaluateInfusions,validateInfusions,infusionTargets,infusionRule} from '../src/core/automation/infusions';
import {validateCharacter} from '../src/core/validation';
import {setSheetChoiceSlot,sheetChoices} from '../src/core/automation/choices';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
function activate(){const state=setup();setInfusionTarget(state.c,state.choiceId,state.infusion.id,'item0');return state;}
it('does not activate when merely learned, and rendering never writes',()=>{const {c}=setup(),before=JSON.stringify(c);expect(evaluate(c).ac).toBe(11);expect(JSON.stringify(c)).toBe(before);});
it('scales from artificer class level, not total multiclass level',()=>{const {c}=activate();expect(evaluate(c).ac).toBe(12);c.selections[0].level=9;expect(evaluate(c).ac).toBe(12);c.selections[0].level=10;expect(evaluate(c).ac).toBe(13);});
it('reopens, switches target and withdraws without modifying equipment or manual values',()=>{
 const {c,choiceId,infusion}=activate();c.sheetBonuses={ac:5};c.notes='手工';c.runtime.hp=3;const equipment=JSON.stringify(c.selections),runtime=JSON.stringify(c.runtime);
 const reopened=validateCharacter(JSON.parse(JSON.stringify(c)));expect(evaluate(reopened).ac).toBe(17);
 setInfusionTarget(reopened,choiceId,infusion.id,'item1');expect(evaluate(reopened).ac).toBe(16); // shield is not wielded
 reopened.selections[2].equipped=true;expect(evaluate(reopened).ac).toBe(19);
 setInfusionTarget(reopened,choiceId,infusion.id,null);expect(evaluate(reopened).ac).toBe(18);expect(reopened.sheetBonuses!.ac).toBe(5);expect(reopened.notes).toBe('手工');expect(JSON.stringify(reopened.runtime)).toBe(runtime);expect(JSON.stringify(c.selections)).toBe(equipment);
});
it('suspends on source removal or unlearning without deleting intent',()=>{
 const {c,choiceId}=activate();const saved=JSON.stringify(c.infusions);c.profile.enabledSources=['PHB'];expect(evaluate(c).ac).toBe(11);expect(JSON.stringify(c.infusions)).toBe(saved);
 c.profile.enabledSources=['PHB','TCE'];expect(evaluate(c).ac).toBe(12);c.answers[choiceId]=[];expect(evaluate(c).ac).toBe(11);expect(JSON.stringify(c.infusions)).toBe(saved);
});
it('retains unsupported protocol and allows no accidental activation',()=>{
 const {c,choiceId,infusion}=setup();c.automation!.enabled=false;expect(()=>setInfusionTarget(c,choiceId,infusion.id,'item0')).toThrow();expect(c.infusions).toBeUndefined();
});
it('rejects magic, stacked, copied, effect-bearing or malformed items transactionally',()=>{
 for(const change of [(r:any)=>delete r.entry.raw.rarity,(r:any)=>r.entry.raw.bonusAc='+1',(r:any)=>r.entry.raw.rarity='uncommon',(r:any)=>r.entry.raw.reqAttune=true,(r:any)=>r.quantity=2,(r:any)=>r.entry.raw._copy={},(r:any)=>r.entry.effects=[{op:'add',target:'ac',value:1}],(r:any)=>r.entry.raw.ac='unknown']){
  const {c,choiceId,infusion}=setup();change(c.selections[1]);const before=JSON.stringify(c);expect(()=>setInfusionTarget(c,choiceId,infusion.id,'item0')).toThrow();expect(JSON.stringify(c)).toBe(before);
 }
});
it('manual modification after activation suspends only generated bonus',()=>{const {c}=activate();c.selections[1].entry.raw.bonusAc='+3';expect(evaluate(c).ac).toBe(14);expect(c.infusions!.bindings).toHaveLength(1);expect(c.selections[1].entry.raw.bonusAc).toBe('+3');});
it('does not apply in simultaneous armor conflict',()=>{const {c}=activate();c.selections.push({...structuredClone(c.selections[1]),id:'second'});expect(evaluate(c).ac).toBe(10);});
it('rejects duplicate imported bindings rather than stacking',()=>{const {c}=activate();c.infusions!.bindings.push({...c.infusions!.bindings[0],targetId:'item1'});c.selections[2].equipped=true;expect(evaluate(c).ac).toBe(13);expect(evaluate(c).issues.some(i=>i.id.startsWith('infusion:'))).toBe(true);});
it('allows withdrawal when the source is unavailable',()=>{const {c,choiceId,infusion}=activate();c.profile.enabledSources=[];setInfusionTarget(c,choiceId,infusion.id,null);expect(c.infusions!.bindings).toEqual([]);});
it('does not use a wrong-source lookalike, future owner, or partial progression',()=>{
 for(const change of [(c:Character)=>c.classChoiceSnapshots![Object.keys(c.classChoiceSnapshots!)[0]].source='ERLW',(c:Character)=>c.selections[0].level=1,(c:Character)=>c.selections[0].entry.raw.optionalfeatureProgression[0].progression=[0,4]]){
  const {c,choiceId,infusion}=setup();change(c);expect(()=>setInfusionTarget(c,choiceId,infusion.id,'item0')).toThrow();
 }
});
it('validates stored data and preserves unknown versions without applying them',()=>{
 expect(()=>validateInfusions({version:1,bindings:[{targetId:5}]})).toThrow();expect(()=>validateInfusions({version:0})).toThrow();const {c}=setup();(c as any).infusions={version:2,future:'keep'};expect(evaluate(c).ac).toBe(11);expect((validateCharacter(JSON.parse(JSON.stringify(c))) as any).infusions).toEqual({version:2,future:'keep'});
});
const sourceDir=process.env.INFUSION_SOURCE_DIR;
it.skipIf(!sourceDir)('replays exact frozen TCE source through real learning, activation, save/reopen, replace and revoke',()=>{
 const optional=JSON.parse(readFileSync(`${sourceDir}/optionalfeatures-e2623b204ddbdf2bcfa8317acfc962de89c676e2.json`,'utf8')),classes=JSON.parse(readFileSync(`${sourceDir}/class-artificer-e2623b204ddbdf2bcfa8317acfc962de89c676e2.json`,'utf8'));
 const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 expect(hash(optional)).toBe('031970dfac1770a548549bd30535319c2493c47ebeaedfdb6a601651bbfc3844');expect(hash(classes)).toBe('c65cad57eebdfff6508a0cfb821ec670a41cc3f057512cadd19f3805cf1a01d7');
 const entries=normalizeData({...classes,...optional},'frozen-20261022'),owner=entries.find(e=>e.kind==='class'&&e.source==='TCE'&&e.english==='Artificer')!,infusion=entries.find(e=>e.source==='TCE'&&e.english==='Enhanced Defense')!;
 expect(infusionRule(infusion)).toBeDefined();const {c}=setup();c.selections[0].entry=owner;c.selections[3].entry=entries.find(e=>e.raw._category==='classFeature'&&e.source==='TCE'&&e.english==='Infuse Item')!;c.answers={};c.classChoiceSnapshots={};
 const choice=sheetChoices(c,entries).find(row=>row.ownerId==='owner'&&row.options.some(o=>o.entry.id===infusion.id))!;expect(choice).toBeDefined();setSheetChoiceSlot(c,choice.id,0,infusion.id,entries);expect(evaluate(c).ac).toBe(11);
 setInfusionTarget(c,choice.id,infusion.id,'item0');expect(evaluate(c).ac).toBe(12);const reopened=validateCharacter(JSON.parse(JSON.stringify(c)));expect(evaluate(reopened).ac).toBe(12);
 reopened.selections[0].level=10;expect(evaluate(reopened).ac).toBe(13);setInfusionTarget(reopened,choice.id,infusion.id,'item1');expect(evaluate(reopened).ac).toBe(11);reopened.selections[2].equipped=true;expect(evaluate(reopened).ac).toBe(15);setInfusionTarget(reopened,choice.id,infusion.id,null);expect(evaluate(reopened).ac).toBe(13);
});

it('reserves a source-qualified infusion across duplicate imported snapshot IDs',()=>{
 const {c,choiceId,infusion}=activate();const duplicate=structuredClone(infusion);duplicate.id+=':another-import';c.classChoiceSnapshots![duplicate.id]=duplicate;c.answers[choiceId].push(duplicate.id);
 const before=JSON.stringify(c);expect(()=>setInfusionTarget(c,choiceId,duplicate.id,'item1')).toThrow();expect(JSON.stringify(c)).toBe(before);
 c.infusions!.bindings.push({choiceId,entryId:duplicate.id,targetId:'item1'});c.selections[2].equipped=true;expect(evaluate(c).ac).toBe(13);
});
it('does not activate a dismissed or undeclared Infuse Item class grant',()=>{
 for(const change of [(c:Character)=>c.dismissedFeatures=['owner|ref:物品注法|奇械师|TCE|2'],(c:Character)=>c.selections[0].entry.raw.classFeatures=[]]){const {c,choiceId,infusion}=setup();change(c);expect(()=>setInfusionTarget(c,choiceId,infusion.id,'item0')).toThrow();}
});

it('revokes only infusion effect when its granted class feature is disabled or removed',()=>{
 const {c}=activate();c.profile.disabledEntries=[c.selections[3].entry.id];expect(evaluate(c).ac).toBe(11);c.profile.disabledEntries=[];expect(evaluate(c).ac).toBe(12);c.selections.pop();expect(evaluate(c).ac).toBe(11);expect(c.infusions!.bindings).toHaveLength(1);
});
it('makes the unsupported cross-edition shield boundary visible',()=>{const {c,choiceId,infusion}=activate();c.profile.optional.legacy=true;c.edition='2024';setInfusionTarget(c,choiceId,infusion.id,'item1');c.selections[2].equipped=true;expect(evaluate(c).issues.some(i=>i.id.startsWith('infusion-cross-edition:'))).toBe(true);});

it('forgetting via the real learning transaction revokes the target and relearning never reactivates',()=>{
 const {c,choiceId,infusion,entries}=activate();const items=JSON.stringify(c.selections);setSheetChoiceSlot(c,choiceId,0,undefined,entries);expect(c.infusions!.bindings).toEqual([]);expect(evaluate(c).ac).toBe(11);setSheetChoiceSlot(c,choiceId,0,infusion.id,entries);expect(evaluate(c).ac).toBe(11);expect(JSON.stringify(c.selections)).toBe(items);
});
