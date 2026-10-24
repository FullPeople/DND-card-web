import {it,expect} from 'vitest';
import {setup} from './infusion-activation.test';
import {normalizeData} from '../src/data/catalog';
import {evaluateInfusions,infusionRule,infusionTargets,setInfusionTarget,setInfusionHeld,validateInfusions,canActivateInfusion} from '../src/core/automation/infusions';
import {activeSelections} from '../src/core/automation/active';
import {validateCharacter} from '../src/core/validation';
function fixture(name='Resistant Armor',level=6){
 const {c,choiceId}=setup();c.selections[0].level=level;
 const infusion=normalizeData({optionalfeature:[{name,ENG_name:name,source:'TCE',featureType:['AI'],entries:[]}]},'attuned')[0];
 c.answers[choiceId]=[infusion.id];c.classChoiceSnapshots={[infusion.id]:infusion};
 c.selections[1].attuned=true;c.selections[2].attuned=true;c.selections[2].equipped=true;
 const weapon=normalizeData({item:[{name:'Fixture bow',source:'PHB',type:'R',weaponCategory:'simple',property:['A','2H'],dmg1:'1d6',dmgType:'P',rarity:'none'}]},'attuned')[0];
 c.selections.push({id:'bow',entry:weapon,level:1,quantity:1,equipped:true,attuned:true});
 return {c,choiceId,infusion};
}
const result=(c:ReturnType<typeof fixture>['c'])=>evaluateInfusions(c,activeSelections(c));
it.each(['Repeating Shot','Repulsion Shield','Resistant Armor'])('recognizes reviewed %s only by canonical source identity',name=>{
 const {infusion}=fixture(name);expect(infusionRule(infusion)).toBeDefined();
 for(const changed of [{source:'ERLW'},{english:'Unknown',name},{raw:{...infusion.raw,_copy:{}}},{effects:[{op:'add',target:'ac',value:1}]}])expect(infusionRule({...infusion,...changed} as any)).toBeUndefined();
});
it.each(['Repulsion Shield','Resistant Armor'])('%s requires actual artificer six, not total level',name=>{
 const {c,choiceId,infusion}=fixture(name,5);c.selections.push({...structuredClone(c.selections[0]),id:'other',level:20});
 expect(canActivateInfusion(c,choiceId,infusion.id)).toBe(false);c.selections[0].level=6;expect(canActivateInfusion(c,choiceId,infusion.id)).toBe(true);
});
it('grants ranged-only fixed +1 for attuned repeating ammunition weapon',()=>{
 const {c,choiceId,infusion}=fixture('Repeating Shot',10);setInfusionTarget(c,choiceId,infusion.id,'bow');expect(result(c).weapons.get('bow')).toMatchObject({bonus:1,rangedOnly:true});
 c.selections.at(-1)!.attuned=false;expect(result(c).weapons.size).toBe(0);c.selections.at(-1)!.attuned=true;c.selections.at(-1)!.entry.raw.property=[];expect(result(c).weapons.size).toBe(0);
});
it('requires shield equipped, attuned and explicitly held; grants fixed +1',()=>{
 const {c,choiceId,infusion}=fixture('Repulsion Shield',10);setInfusionTarget(c,choiceId,infusion.id,'item1');expect(result(c).bonus).toBe(0);setInfusionHeld(c,choiceId,infusion.id,true);expect(result(c).bonus).toBe(1);
 c.selections[2].attuned=false;expect(result(c).bonus).toBe(0);expect(()=>setInfusionHeld(c,choiceId,infusion.id,true)).toThrow();c.selections[2].attuned=true;setInfusionHeld(c,choiceId,infusion.id,false);expect(result(c).bonus).toBe(0);
});
it('chooses exactly one resistance atomically, persists and changes without AC bonus',()=>{
 const {c,choiceId,infusion}=fixture();c.notes='manual';c.runtime.hp=3;
 const before=JSON.stringify(c);for(const damageType of [undefined,'','bludgeoning','Fire','fire,cold']){expect(()=>setInfusionTarget(c,choiceId,infusion.id,'item0',{damageType})).toThrow();expect(JSON.stringify(c)).toBe(before);}
 setInfusionTarget(c,choiceId,infusion.id,'item0',{damageType:'fire'});expect(result(c).resistances).toEqual(['fire']);expect(result(c).bonus).toBe(0);
 const reopened=validateCharacter(JSON.parse(JSON.stringify(c)));expect(result(reopened).resistances).toEqual(['fire']);
 setInfusionTarget(reopened,choiceId,infusion.id,'item0',{damageType:'cold'});expect(result(reopened).resistances).toEqual(['cold']);
 reopened.selections.push({...structuredClone(reopened.selections[1]),id:'other-armor',equipped:false});setInfusionTarget(reopened,choiceId,infusion.id,'other-armor',{damageType:'acid'});expect(result(reopened).resistances).toEqual([]);
 setInfusionTarget(reopened,choiceId,infusion.id,null);expect(reopened.infusions!.bindings).toEqual([]);expect(reopened.notes).toBe('manual');expect(reopened.runtime.hp).toBe(3);
});
it('requires worn and attuned armor, never shield, and suspends on conflict/source/level',()=>{
 const {c,choiceId,infusion}=fixture();expect(infusionTargets(c,infusion).map(r=>r.id)).toEqual(['item0']);setInfusionTarget(c,choiceId,infusion.id,'item0',{damageType:'fire'});const intent=JSON.stringify(c.infusions);
 for(const change of [(x:typeof c)=>x.selections[1].attuned=false,(x:typeof c)=>x.selections[1].equipped=false,(x:typeof c)=>x.selections[0].level=5,(x:typeof c)=>x.profile.enabledSources=['PHB'],(x:typeof c)=>x.selections.push({...structuredClone(x.selections[1]),id:'conflict'})]){const copy=structuredClone(c);change(copy);expect(result(copy).resistances).toEqual([]);expect(JSON.stringify(copy.infusions)).toBe(intent);}
});
it('never invents missing imported resistance choices and rejects invalid stored enums',()=>{
 const {c,choiceId,infusion}=fixture();c.infusions={version:1,bindings:[{choiceId,entryId:infusion.id,targetId:'item0'}]};expect(result(c).resistances).toEqual([]);expect(result(c).issues.some(i=>i.id.startsWith('infusion:'))).toBe(true);
 for(const damageType of ['bludgeoning',1,['fire'],'FIRE',''])expect(()=>validateInfusions({version:1,bindings:[{...c.infusions!.bindings[0],damageType}]})).toThrow();
 expect(()=>validateInfusions({version:2,bindings:'future',damageType:'future'})).not.toThrow();
});

import {INFUSION_DAMAGE_TYPES,reconcileInfusionHolding} from '../src/core/automation/infusions';
import evidence from '../src/core/automation/infusionEvidence.json';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
it.each(INFUSION_DAMAGE_TYPES)('supports the single closed resistance choice %s',damageType=>{const {c,choiceId,infusion}=fixture();setInfusionTarget(c,choiceId,infusion.id,'item0',{damageType});expect(result(c).resistances).toEqual([damageType]);});
it('retains same-identity exclusion, target capacity and nonmagical checks',()=>{
 const {c,choiceId,infusion}=fixture();setInfusionTarget(c,choiceId,infusion.id,'item0',{damageType:'fire'});
 const duplicate={...infusion,id:infusion.id+':duplicate'};c.classChoiceSnapshots![duplicate.id]=duplicate;c.answers[choiceId].push(duplicate.id);c.selections.push({...structuredClone(c.selections[1]),id:'second',equipped:false});
 const before=JSON.stringify(c);expect(()=>setInfusionTarget(c,choiceId,duplicate.id,'second',{damageType:'cold'})).toThrow();expect(JSON.stringify(c)).toBe(before);
 c.infusions!.bindings.push({choiceId,entryId:duplicate.id,targetId:'second',damageType:'cold'});expect(result(c).resistances).toEqual([]);
 for(const change of [(x:any)=>x.quantity=2,(x:any)=>x.entry.raw.bonusAc=1,(x:any)=>x.entry.raw.reqAttune=true,(x:any)=>x.entry.raw._copy={}]){const state=fixture();change(state.c.selections[1]);expect(()=>setInfusionTarget(state.c,state.choiceId,state.infusion.id,'item0',{damageType:'fire'})).toThrow();}
 const full=fixture();full.c.infusions={version:1,bindings:[0,1,2].map(i=>({choiceId:'reserved'+i,entryId:'unknown'+i,targetId:'reserved'+i}))};expect(()=>setInfusionTarget(full.c,full.choiceId,full.infusion.id,'item0',{damageType:'fire'})).toThrow(/上限/);
});
it('clears shield held confirmation on explicit equipment edit and blocks cross-edition shield AC',()=>{
 const {c,choiceId,infusion}=fixture('Repulsion Shield');setInfusionTarget(c,choiceId,infusion.id,'item1');setInfusionHeld(c,choiceId,infusion.id,true);
 const after=structuredClone(c);after.selections[2].equipped=false;reconcileInfusionHolding(c,after);expect(after.infusions!.bindings[0].held).toBeUndefined();
 c.edition='2024';c.profile.optional.legacy=true;expect(result(c).bonus).toBe(0);expect(result(c).issues.some(i=>i.id.startsWith('infusion-cross-edition'))).toBe(true);
});
const sourceDir=process.env.INFUSION_SOURCE_DIR;
it.skipIf(!sourceDir).each(['Repeating Shot','Repulsion Shield','Resistant Armor'])('checks exact frozen %s raw identity and real learning transaction',name=>{
 const optional=JSON.parse(readFileSync(`${sourceDir}/optionalfeatures-e2623b204ddbdf2bcfa8317acfc962de89c676e2.json`,'utf8')),classes=JSON.parse(readFileSync(`${sourceDir}/class-artificer-e2623b204ddbdf2bcfa8317acfc962de89c676e2.json`,'utf8'));
 const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');expect(hash(optional)).toBe(evidence.inputs['optionalfeatures.json']);expect(hash(classes)).toBe(evidence.inputs['class/class-artificer.json']);
 const raw=optional.optionalfeature.find((r:any)=>r.ENG_name===name&&r.source==='TCE');expect(hash(raw)).toBe(evidence.entryHashes[`${name}|TCE` as keyof typeof evidence.entryHashes]);
 const entries=normalizeData({...classes,...optional},'frozen-attuned'),{c}=fixture(name),infusion=entries.find(e=>e.english===name&&e.source==='TCE')!;
 c.selections[0].entry=entries.find(e=>e.kind==='class'&&e.english==='Artificer'&&e.source==='TCE')!;c.selections[3].entry=entries.find(e=>e.raw._category==='classFeature'&&e.english==='Infuse Item'&&e.source==='TCE')!;
 c.answers={};c.classChoiceSnapshots={};const choice=sheetChoices(c,entries).find(row=>row.ownerId==='owner'&&row.options.some(o=>o.entry.id===infusion.id))!;expect(choice).toBeDefined();setSheetChoiceSlot(c,choice.id,0,infusion.id,entries);
 const target=name==='Repeating Shot'?'bow':name==='Repulsion Shield'?'item1':'item0';setInfusionTarget(c,choice.id,infusion.id,target,name==='Resistant Armor'?{damageType:'fire'}:undefined);if(name==='Repulsion Shield')setInfusionHeld(c,choice.id,infusion.id,true);
 const reopened=validateCharacter(JSON.parse(JSON.stringify(c)));expect(reopened.infusions).toEqual(c.infusions);expect(result(reopened)).toEqual(result(c));expect(infusionRule(infusion)).toBeDefined();
 if(name==='Repeating Shot')expect(result(c).weapons.get(target)).toMatchObject({bonus:1,rangedOnly:true});else if(name==='Repulsion Shield')expect(result(c).bonus).toBe(1);else expect(result(c).resistances).toEqual(['fire']);
 const before=JSON.stringify(c.infusions);c.profile.enabledSources=['PHB'];expect(result(c).resistances).toEqual([]);expect(result(c).weapons.size).toBe(0);expect(result(c).bonus).toBe(0);expect(JSON.stringify(c.infusions)).toBe(before);setInfusionTarget(c,choice.id,infusion.id,null);expect(c.infusions!.bindings).toEqual([]);
});
