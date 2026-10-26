import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {type Character,type Entry} from '../src/core/model';
import {sheetChoices,setSheetChoiceSlot,chooseSheetOption} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {exportCharacter,exportLinkedOwlbear} from '../src/core/export';
import {validateCharacter,importOwlbear} from '../src/core/validation';
import {reviewedFeatRule,reviewedFeatStatus,setReviewedFeatIntent,type ReviewedWeaponMasterIntent} from '../src/core/automation/reviewedFeats';
import {reviewedWeaponOptions,reviewedWeaponReference,reviewedWeaponTrainingMatches,reviewedWeaponNeedsFirearmsConsent} from '../src/core/automation/reviewedWeapons';
import evidence from '../src/core/automation/reviewedWeaponEvidence.json';
import {effectiveTrainingDeclarations} from '../src/core/automation/training';
import {automaticWeaponAttacks} from '../src/core/automation/weapons';
import {activeEffectSelections} from '../src/core/automation/active';
import {setAsiAllocation,asiAllocationStatus} from '../src/core/automation/asi';
import {weaponAttacks} from '../src/core/weaponAttacks';
import {reviewedWeaponMasterData,reviewedWeaponMasterFixture,weaponMasterReferences} from './e2e/reviewedWeaponMasterFixture';
import {reviewedPassiveFeatData} from './e2e/reviewedPassiveFeatFixture';
const intent=(weapons=[...weaponMasterReferences],ability:'str'|'dex'='str'):ReviewedWeaponMasterIntent=>({kind:'weapon-master',ability,weapons,confirmedManualAbilityExcluded:true});
const reopen=(c:Character)=>validateCharacter(JSON.parse(JSON.stringify(exportCharacter(c))));
function setup(level=4){
 const c=reviewedWeaponMasterFixture(),entries=normalizeData(structuredClone(reviewedWeaponMasterData),'weapon-master-core');c.selections[0].level=level;syncFeatures(c,entries);
 const choices=()=>sheetChoices(c,entries).filter(x=>x.id.includes(':class-legacy-feat:')).sort((a,b)=>a.grantLevel!-b.grantLevel!);
 const feat=entries.find(x=>x.english==='Weapon Master')!,choice=choices()[0];
 const select=(slot=0)=>{const chosen=choices()[slot];setSheetChoiceSlot(c,chosen.id,0,feat.id,entries);return chosen;};
 const confirm=(value=intent(),slot=0)=>{const chosen=select(slot);setReviewedFeatIntent(c,chosen.id,feat.id,value);return chosen;};
 const training=()=>effectiveTrainingDeclarations(c,undefined,'weapons');
 const report=()=>automaticWeaponAttacks(c,evaluate(c));
 return {c,entries,feat,choice,choices,select,confirm,training,report};
}
it('a real legacy slot record stays inactive until explicit consent, then one pure shared layer supplies ability and all weapon modes',()=>{
 const {c,entries,choice,feat,select,confirm,training,report}=setup();select();
 expect(reviewedFeatRule(feat)).toMatchObject({kind:'weapon-master',weaponCount:4,abilities:['str','dex']});expect(c.selections.some(row=>row.entry.kind==='feat')).toBe(false);expect(reviewedFeatStatus(c,choice.id,feat.id)).toMatchObject({eligible:true,active:false});
 expect(training()).not.toContain('Longsword|PHB');expect(report().attacks.find(row=>row.key==='auto-weapon:weapon-master-longsword:main')!.attack_bonus).toBe(1);
 const original=JSON.stringify(c);confirm();expect(JSON.stringify({...c,reviewedWeaponMaster:undefined})).toBe(original);expect(c.reviewedFeats).toBeUndefined();
 expect(evaluate(c).abilities.str).toBe(14);expect(training()).toEqual(expect.arrayContaining(weaponMasterReferences));
 const attacks=report();for(const key of ['longsword:main','longsword:two-handed','spear:main','spear:thrown','spear:two-handed'])expect(attacks.attacks.find(row=>row.key===`auto-weapon:weapon-master-${key}`)?.attack_bonus).toBe(4);
 expect(attacks.attacks.find(row=>row.key==='auto-weapon:weapon-master-longbow:main')?.attack_bonus).toBe(3);expect(attacks.attacks.find(row=>row.key==='auto-weapon:weapon-master-magic:main')?.attack_bonus).toBe(5);
 expect(attacks.issues.some(row=>row.id==='weapon-training:weapon-master-net')).toBe(false);expect(attacks.attacks.some(row=>row.key.includes('-net:'))).toBe(false);expect(attacks.issues.some(row=>row.id==='weapon-thrown:weapon-master-net')).toBe(true);
 const saved=JSON.stringify(c);for(let i=0;i<3;i++){expect(evaluate(reopen(c)).abilities.str).toBe(14);expect(effectiveTrainingDeclarations(reopen(c),undefined,'weapons')).toEqual(training());report();sheetChoices(c,entries);}expect(JSON.stringify(c)).toBe(saved);
 expect(c.runtime.hp).toBe(7);expect(c.runtime.resources['manual-weapon-master'].current).toBe(2);expect(c.abilities.str).toBe(13);
});
it.each(['too-few','too-many','same-reference','case-alias','localized-alias','unknown','wrong-source','wrong-edition','empty','not-array'] as const)('invalid four-kind intent %s is atomic and rejected on import',mode=>{
 const {c,select,feat}=setup(),choice=select(),bad:any=intent();
 if(mode==='too-few')bad.weapons.pop();if(mode==='too-many')bad.weapons.push('Dagger|PHB');if(mode==='same-reference')bad.weapons[3]=bad.weapons[0];if(mode==='case-alias')bad.weapons[3]='longsword|phb';if(mode==='localized-alias')bad.weapons[3]='长剑|PHB';if(mode==='unknown')bad.weapons[3]='Unknown|PHB';if(mode==='wrong-source')bad.weapons[3]='Net|DMG';if(mode==='wrong-edition')bad.weapons[3]='Longsword|XPHB';if(mode==='empty')bad.weapons=[];if(mode==='not-array')bad.weapons='Longsword|PHB';
 const saved=JSON.stringify(c);expect(()=>setReviewedFeatIntent(c,choice.id,feat.id,bad)).toThrow();expect(JSON.stringify(c)).toBe(saved);
 (c as any).reviewedWeaponMaster={version:1,bindings:[{selectionId:'invalid',choiceId:choice.id,entryId:feat.id,intent:bad}]};expect(()=>reopen(c)).toThrow('武器大师确认记录');
});
it.each(['consent','ability','extra-intent','extra-state','extra-binding','other-kind','old-store'] as const)('invalid local schema %s cannot execute or overwrite existing old feat state',mode=>{
 const {c,confirm}=setup();confirm();const bad:any=structuredClone(c),binding=bad.reviewedWeaponMaster.bindings[0];
 if(mode==='consent')binding.intent.confirmedManualAbilityExcluded=false;if(mode==='ability')binding.intent.ability='wis';if(mode==='extra-intent')binding.intent.extraEffect=5;if(mode==='extra-state')bad.reviewedWeaponMaster.extra=true;if(mode==='extra-binding')binding.extra=1;if(mode==='other-kind')binding.intent={kind:'tough',confirmedManualHpExcluded:true};if(mode==='old-store'){bad.reviewedFeats=bad.reviewedWeaponMaster;delete bad.reviewedWeaponMaster;}
 expect(()=>reopen(bad)).toThrow();expect(evaluate(bad).abilities.str).toBe(13);
});
it.each(['source','raw-source','kind','edition','raw-name','raw-category','page','copy','extra-effect','normalized-effect','normalized-choice','count','filter','ability','ability-extra','repeatable'] as const)('edited feat identity/shape %s suspends the entire grant and keeps saved intent',mode=>{
 const {c,confirm,choice,feat,training}=setup();confirm();const e=c.classChoiceSnapshots![feat.id],saved=JSON.stringify(c.reviewedWeaponMaster);
 if(mode==='source')e.source='CUSTOM';if(mode==='raw-source')e.raw.source='CUSTOM';if(mode==='kind')e.kind='feature';if(mode==='edition')e.edition='2024';if(mode==='raw-name')e.raw.ENG_name='Unknown';if(mode==='raw-category')e.raw._category='feature';if(mode==='page')e.raw.page=999;if(mode==='copy')e.raw._copy={};if(mode==='extra-effect')e.raw.speed=10;if(mode==='normalized-effect')e.effects=[{op:'add',target:'str',value:4}];if(mode==='normalized-choice')e.choices=[{} as any];if(mode==='count')e.raw.weaponProficiencies[0].choose.count=5;if(mode==='filter')e.raw.weaponProficiencies[0].choose.fromFilter='type=all';if(mode==='ability')e.raw.ability[0].choose.from=['int'];if(mode==='ability-extra')e.raw.ability[0].choose.max=30;if(mode==='repeatable')e.raw.repeatable=true;
 expect(reviewedFeatStatus(c,choice.id,feat.id).active).toBe(false);expect(evaluate(c).abilities.str).toBe(13);expect(training()).not.toContain('Longsword|PHB');expect(JSON.stringify(c.reviewedWeaponMaster)).toBe(saved);
});
it.each(['source-off','disabled-weapon','disabled-feat','source-missing','owner-missing','downgrade','dismissed','owner-raw-source','duplicate-owner','duplicate-source','cycle','automation-off','feats-off'] as const)('saved effects suspend without rewriting intent when %s',mode=>{
 const {c,confirm,choice,feat,training}=setup();confirm();const source=c.selections.find(row=>row.id===c.reviewedWeaponMaster!.bindings[0].selectionId)!,saved=JSON.stringify(c.reviewedWeaponMaster);
 if(mode==='source-off')c.profile.enabledSources=[];if(mode==='disabled-weapon')c.profile.disabledEntries=[evidence.rules.find(row=>row.reference==='Longsword|PHB')!.entryId];if(mode==='disabled-feat')c.profile.disabledEntries=[feat.id];if(mode==='source-missing')c.selections=c.selections.filter(row=>row.id!==source.id);if(mode==='owner-missing')c.selections.shift();if(mode==='downgrade')c.selections[0].level=3;if(mode==='dismissed')c.dismissedFeatures=[`${source.parentId}|${source.grantKey}`];if(mode==='owner-raw-source')c.selections[0].entry.raw.source='CUSTOM';if(mode==='duplicate-owner')c.selections.push(structuredClone(c.selections[0]));if(mode==='duplicate-source')c.selections.push(structuredClone(source));if(mode==='cycle')c.selections[0].parentId=source.id;if(mode==='automation-off')c.automation!.enabled=false;if(mode==='feats-off')c.profile.optional.feats=false;
 expect(reviewedFeatStatus(c,choice.id,feat.id).active).toBe(false);expect(evaluate(c).abilities.str).toBe(13);expect(training()).not.toContain('Longsword|PHB');expect(JSON.stringify(c.reviewedWeaponMaster)).toBe(saved);
});
it('source/entry suspension restores the same saved intent, including missing-catalog reopening and shared filtered active inputs',()=>{
 const {c,confirm,choice,feat,training}=setup();confirm();const saved=JSON.stringify(c.reviewedWeaponMaster);c.profile.enabledSources=[];expect(training()).toEqual([]);c.profile.enabledSources=['PHB'];expect(training()).toContain('Longsword|PHB');
 const source=c.reviewedWeaponMaster!.bindings[0].selectionId;expect(evaluate(c,new Set([source])).abilities.str).toBe(13);expect(effectiveTrainingDeclarations(c,activeEffectSelections(c).filter(row=>row.id!==source),'weapons')).not.toContain('Longsword|PHB');
 const restored=reopen(c);syncFeatures(restored,[]);expect(reviewedFeatStatus(restored,choice.id,feat.id).active).toBe(true);expect(JSON.stringify(restored.reviewedWeaponMaster)).toBe(saved);
});
it.each(['withdraw','clear','replace','toggle'] as const)('current explicit %s clears only owned Weapon Master intent and requires new consent on reselection',mode=>{
 const {c,confirm,choice,feat,entries,training}=setup();confirm();const manual={runtime:structuredClone(c.runtime),training:structuredClone(c.training),actions:structuredClone(c.quickbarActions)};
 if(mode==='withdraw')setReviewedFeatIntent(c,choice.id,feat.id,null);else if(mode==='toggle')chooseSheetOption(c,choice.id,feat.id,entries);else setSheetChoiceSlot(c,choice.id,0,mode==='clear'?undefined:entries.find(row=>row.english==='Authored Weapon Replacement')!.id,entries);
 expect(c.reviewedWeaponMaster!.bindings).toEqual([]);expect(training()).not.toContain('Longsword|PHB');setSheetChoiceSlot(c,choice.id,0,feat.id,entries);expect(reviewedFeatStatus(reopen(c),choice.id,feat.id).active).toBe(false);confirm();expect(training()).toContain('Longsword|PHB');expect({runtime:c.runtime,training:c.training,actions:c.quickbarActions}).toEqual(manual);
});
it('new consumer downgrade/reopen/restore preserves the exact source grant ID and its manual children, no fresh confirmation',()=>{
 const {c,confirm,choice,feat}=setup();confirm();const id=c.reviewedWeaponMaster!.bindings[0].selectionId,saved=JSON.stringify(c.reviewedWeaponMaster),runtime=structuredClone(c.runtime);
 c.selections.push({id:'manual-child',parentId:id,entry:{...structuredClone(feat),id:'manual-child-entry',kind:'feature',english:'Authored child',raw:{},entries:[]},level:1,quantity:1,equipped:false});
 c.selections[0].level=3;syncFeatures(c,[]);expect(c.selections.some(row=>row.id===id)).toBe(false);expect(c.classChoiceArchive?.[id].selections.some(row=>row.id==='manual-child')).toBe(true);const restored=reopen(c);restored.selections[0].level=4;syncFeatures(restored,[]);expect(restored.selections.some(row=>row.id===id)).toBe(true);expect(restored.selections.some(row=>row.id==='manual-child')).toBe(true);expect(reviewedFeatStatus(restored,choice.id,feat.id).active).toBe(true);expect(JSON.stringify(restored.reviewedWeaponMaster)).toBe(saved);expect(restored.runtime).toEqual(runtime);expect(syncFeatures(restored,[])).toBe(false);
});
it.each(['empty','named','category'] as const)('manual %s weapon training overrides derived declarations, never double PB or writes',mode=>{
 const {c,confirm,training,report}=setup();confirm();c.training!.weapons=mode==='empty'?'':mode==='named'?'Longsword|PHB':'martial';const before=JSON.stringify(c);
 expect(training()).toEqual(mode==='empty'?[]:[c.training!.weapons]);expect(report().attacks.find(row=>row.key==='auto-weapon:weapon-master-longsword:main')?.attack_bonus).toBe(mode==='empty'?2:4);expect(evaluate(c).abilities.str).toBe(14);expect(JSON.stringify(c)).toBe(before);delete c.training!.weapons;expect(training()).toContain('Longsword|PHB');
});
it('existing proficiency is not doubled and manual item/quickbar/legacy formulas are never overwritten',()=>{
 const {c,confirm}=setup();const dagger=c.selections.find(row=>row.entry.english==='Dagger')!,beforeDag=automaticWeaponAttacks(c,evaluate(c)).attacks.find(row=>row.key===`auto-weapon:${dagger.id}:main`)!.attack_bonus;
 confirm(intent(['Dagger|PHB','Longsword|PHB','Longbow|PHB','Net|PHB'],'dex'));expect(automaticWeaponAttacks(c,evaluate(c)).attacks.find(row=>row.key===`auto-weapon:${dagger.id}:main`)!.attack_bonus).toBe(Number(beforeDag)+1);
 const sword=c.selections.find(row=>row.entry.english==='Longsword')!;sword.entry.raw.attackBonus='+19';sword.entry.raw.dmg1='9d6+7';const manual=JSON.stringify({sword,quickbar:c.quickbarActions,runtime:c.runtime});const attacks=weaponAttacks(c);expect(attacks.find(row=>row.key===`selection:${sword.entry.id}`)).toMatchObject({attack_bonus:'+19',damage:'9d6+7'});expect(attacks.find(row=>row.key==='custom:manual-weapon-master')).toMatchObject({attack_bonus:'+12',damage:'3d6+8'});expect(JSON.stringify({sword,quickbar:c.quickbarActions,runtime:c.runtime})).toBe(manual);
});
it.each([19,20,22])('STR %s respects cap20 without lowering manual scores or auto-changing the selected ability',score=>{
 const {c,select,choice,feat,confirm,training}=setup();c.abilities.str=score;select();const saved=JSON.stringify(c);
 if(score>=20){expect(()=>setReviewedFeatIntent(c,choice.id,feat.id,intent())).toThrow('上限 20');expect(JSON.stringify(c)).toBe(saved);}else{confirm();expect(evaluate(c).abilities.str).toBe(20);c.abilities.str=20;expect(evaluate(c).abilities.str).toBe(20);expect(training()).not.toContain('Longsword|PHB');}
});
it.each([true,false])('Weapon Master and ASI use one ordered cap, WM first=%s',first=>{
 const {c,confirm,choices,entries,feat,training}=setup(8);c.abilities.str=16;const wm=confirm(intent(),first?0:1),asi=choices()[first?1:0];setSheetChoiceSlot(c,asi.id,0,asi.options.find(row=>row.entry.raw._classAbilityRecord)!.value,entries);setAsiAllocation(c,asi.id,{str:2});c.abilities.str=18;
 expect(evaluate(c).abilities.str).toBe(first?19:20);expect(reviewedFeatStatus(c,wm.id,feat.id).active).toBe(first);expect(asiAllocationStatus(c,asi.id).active).toBe(!first);expect(training().includes('Longsword|PHB')).toBe(first);expect(evaluate(reopen(c)).abilities.str).toBe(first?19:20);
});
it('adding an earlier Weapon Master cannot silently invalidate an already confirmed later ASI',()=>{
 const {c,select,choices,entries,feat}=setup(8);c.abilities.str=18;const asi=choices()[1];setSheetChoiceSlot(c,asi.id,0,asi.options.find(row=>row.entry.raw._classAbilityRecord)!.value,entries);setAsiAllocation(c,asi.id,{str:2});const wm=select(),saved=JSON.stringify(c);expect(()=>setReviewedFeatIntent(c,wm.id,feat.id,intent())).toThrow('已有属性提升');expect(JSON.stringify(c)).toBe(saved);
});
it('duplicate imported owned grants, bindings or manual same-name feats cannot stack or bypass consent',()=>{
 for(const mode of ['binding','answer','manual','manual-only']){const {c,confirm,select,feat,choices,training}=setup(8);if(mode!=='manual-only')confirm();else select();
  if(mode==='binding')c.reviewedWeaponMaster!.bindings.push(structuredClone(c.reviewedWeaponMaster!.bindings[0]));if(mode==='answer'){const copy={...structuredClone(feat),id:'alias-weapon-master'};c.classChoiceSnapshots![copy.id]=copy;c.answers[choices()[1].id]=[copy.id];}if(mode.startsWith('manual'))c.selections.push({id:'manual-master',entry:structuredClone(feat),level:1,quantity:1,equipped:false});
  expect(training()).not.toContain('Longsword|PHB');expect(evaluate(c).abilities.str).toBe(13);
 }
});
it('independent future Weapon Master state stays opaque and cannot downgrade, corrupt or stop an existing Tough',()=>{
 const {c,entries,choices,choice,feat,select}=setup(8);entries.push(...normalizeData(structuredClone(reviewedPassiveFeatData),'passive'));const tough=entries.find(row=>row.english==='Tough')!,later=choices()[1];setSheetChoiceSlot(c,later.id,0,tough.id,entries);setReviewedFeatIntent(c,later.id,tough.id,{kind:'tough',confirmedManualHpExcluded:true});select();const hp=evaluate(c).maxHp,old=JSON.stringify(c.reviewedFeats);(c as any).reviewedWeaponMaster={version:2,future:{preserve:true}};const before=JSON.stringify(c);
 expect(evaluate(c).maxHp).toBe(hp);expect(evaluate(reopen(c)).maxHp).toBe(hp);expect(evaluate(c).issues.some(row=>row.id==='reviewed-weapon-master-version')).toBe(true);expect(()=>setReviewedFeatIntent(c,choice.id,feat.id,intent())).toThrow('版本');expect(()=>setReviewedFeatIntent(c,choice.id,feat.id,null)).toThrow('版本');expect(JSON.stringify(c)).toBe(before);expect(JSON.stringify(c.reviewedFeats)).toBe(old);
});
it('native and linked exports preserve the isolated state and shared score/training projection',()=>{
 const {c,confirm,training}=setup();confirm();const restored=importOwlbear(JSON.parse(JSON.stringify(exportLinkedOwlbear(c,evaluate(c)))));expect(restored.reviewedWeaponMaster).toEqual(c.reviewedWeaponMaster);expect(restored.reviewedFeats).toBeUndefined();expect(effectiveTrainingDeclarations(restored,undefined,'weapons')).toEqual(training());expect(evaluate(restored).abilities.str).toBe(14);
});
function allKinds():Entry[]{return normalizeData({baseitem:evidence.rules.map(row=>({name:row.name,ENG_name:row.english,source:row.rawSource,page:row.page,...(row.edition==='2014'?{edition:'classic'}:{}),...row.mechanics}))},'authored-kind-mechanics');}
it('the bounded candidate registry admits exactly52 reviewed identities, including Net and OotA unknown rarity, never generic same-name catalog rows',()=>{
 const {c}=setup(),catalog=allKinds();c.profile.enabledSources=[...new Set(catalog.map(row=>row.source))];const options=reviewedWeaponOptions(c,catalog);expect(options).toHaveLength(52);expect(options.filter(row=>row.entry.source==='DMG')).toHaveLength(10);expect(options.every(row=>!row.unavailable)).toBe(true);expect(options.find(row=>row.value==='Net|PHB')!.entry.raw.dmg1).toBeUndefined();expect(options.filter(row=>row.entry.raw.rarity==='unknown')).toHaveLength(2);
 for(const row of options)expect(reviewedWeaponReference(row.entry)).toBe(row.value);expect(reviewedWeaponOptions(c,[...catalog,...catalog])).toHaveLength(52);
 c.profile.enabledSources=['PHB'];expect(reviewedWeaponOptions(c,catalog).filter(row=>!row.unavailable)).toHaveLength(37);
});
it.each(['id','pack','source','raw-source','edition','raw-edition','kind','raw-category','raw-name','page','rarity','magic','attune','bonus','copy','damage','properties','normalized-effects','raw-effects','extra-field'] as const)('forged weapon kind %s never becomes a selectable candidate',mode=>{
 const {c}=setup(),e=allKinds().find(row=>row.english==='Longsword')!;
 if(mode==='id')e.id='alias';if(mode==='pack')e.packId='custom';if(mode==='source')e.source='DMG';if(mode==='raw-source')e.raw.source='DMG';if(mode==='edition')e.edition='2024';if(mode==='raw-edition')e.raw.edition='one';if(mode==='kind')e.kind='feat';if(mode==='raw-category')e.raw._category='item';if(mode==='raw-name')e.raw.ENG_name='Unknown';if(mode==='page')e.raw.page=999;if(mode==='rarity')e.raw.rarity='rare';if(mode==='magic')e.raw.magic=true;if(mode==='attune')e.raw.reqAttune=true;if(mode==='bonus')e.raw.bonusWeapon='+1';if(mode==='copy')e.raw._copy={};if(mode==='damage')e.raw.dmg1='9d9';if(mode==='properties')e.raw.property=['F'];if(mode==='normalized-effects')e.effects=[{op:'add',target:'str',value:3}];if(mode==='raw-effects')e.raw.effects=[{op:'add',target:'str',value:3}];if(mode==='extra-field')e.raw.speed=30;
 expect(reviewedWeaponOptions(c,[e])).toEqual([]);expect(reviewedWeaponReference(e)).toBeUndefined();
});
it('a conflicting duplicate cannot select whichever trusted-looking snapshot happens to come first',()=>{const {c}=setup(),e=allKinds().find(row=>row.english==='Net')!,bad=structuredClone(e);bad.raw.magic=true;expect(reviewedWeaponOptions(c,[e,bad])).toEqual([]);expect(reviewedWeaponOptions(c,[bad,e])).toEqual([]);});
it('firearm choices are visible but cannot grant proficiency without an explicit DM-permission confirmation',()=>{
 const {c,select,feat,choice,training}=setup(),weapons=['Pistol|DMG','Longsword|PHB','Longbow|PHB','Net|PHB'];c.profile.enabledSources.push('DMG');select();expect(reviewedWeaponNeedsFirearmsConsent(weapons)).toBe(true);expect(reviewedWeaponOptions(c,allKinds()).find(row=>row.value==='Pistol|DMG')?.unavailable).toBeUndefined();
 const before=JSON.stringify(c);expect(()=>setReviewedFeatIntent(c,choice.id,feat.id,intent(weapons))).toThrow('DM');expect(JSON.stringify(c)).toBe(before);setReviewedFeatIntent(c,choice.id,feat.id,{...intent(weapons),confirmedDmFirearmsAllowed:true});expect(training()).toContain('Pistol|DMG');const saved=JSON.stringify(c.reviewedWeaponMaster);c.profile.enabledSources=['PHB'];expect(training()).not.toContain('Longsword|PHB');expect(evaluate(c).abilities.str).toBe(13);expect(JSON.stringify(c.reviewedWeaponMaster)).toBe(saved);c.profile.enabledSources.push('DMG');expect(training()).toContain('Pistol|DMG');
 delete (c.reviewedWeaponMaster!.bindings[0].intent as ReviewedWeaponMasterIntent).confirmedDmFirearmsAllowed;expect(reviewedFeatStatus(reopen(c),choice.id,feat.id).reason).toContain('DM');
});
it.each(['different-base','different-source','different-type','2024','missing-base','renamed-display','forged-raw-identity'] as const)('reviewed proficiency does not leak through false magic base identity: %s',mode=>{
 const {c,confirm,report}=setup();confirm();const magic=c.selections.find(row=>row.id==='weapon-master-magic')!.entry;
 if(mode==='different-base')magic.raw.baseItem='Rapier|PHB';if(mode==='different-source')magic.raw.baseItem='Longsword|XPHB';if(mode==='different-type')magic.raw.type='R';if(mode==='2024'){magic.edition='2024';magic.raw.edition='one';}if(mode==='missing-base')delete magic.raw.baseItem;if(mode==='renamed-display'){magic.raw.baseItem='Rapier|PHB';magic.name='长剑';}if(mode==='forged-raw-identity')magic.raw.ENG_name='Longsword';
 expect(reviewedWeaponTrainingMatches(magic,'Longsword|PHB')).toBe(false);expect(report().attacks.find(row=>row.key==='auto-weapon:weapon-master-magic:main')?.attack_bonus).not.toBe(5);
});

it.each(['feat','feature','race','item'] as const)('a manual same-name %s copy with forged generic effects cannot bypass owned consent',kind=>{
 const {c,feat,training}=setup(),before=evaluate(c),e=structuredClone(feat);e.id='forged-manual-weapon-master';e.kind=kind;e.source='CUSTOM';e.raw.source='CUSTOM';e.raw.weaponProficiencies=[{martial:true}];e.raw.skillProficiencies=[{arcana:true}];e.effects=[{op:'add',target:'str',value:5},{op:'add',target:'hp',value:50},{op:'add',target:'ac',value:5},{op:'add',target:'speed',value:10}];c.profile.enabledSources.push('CUSTOM');c.selections.push({id:'manual-master',entry:e,level:1,quantity:1,equipped:true});
 const after=evaluate(c);expect(after.abilities).toEqual(before.abilities);expect(after.maxHp).toBe(before.maxHp);expect(after.ac).toBe(before.ac);expect(after.speed).toBe(before.speed);expect(after.skills.arcana.proficient).toBe(before.skills.arcana.proficient);expect(training()).not.toContain('martial');
});

it.each(['Iron Ball|IDROTF','Oversized Longbow|WDH','Psychic Blade|XPHB'])('the documented special item outside the reviewed52 base-kind scope stays unsupported, not silently generalized: %s',ref=>{
 const {c,select,choice,feat}=setup();select();c.profile.enabledSources.push(ref.split('|')[1]);const before=JSON.stringify(c);expect(evidence.unsupportedSpecialItems.some(row=>row.reference===ref)).toBe(true);expect(()=>setReviewedFeatIntent(c,choice.id,feat.id,intent([ref,'Longsword|PHB','Longbow|PHB','Net|PHB']))).toThrow();expect(JSON.stringify(c)).toBe(before);
});

it('an unresolved manual Weapon Master identity retains its original visible copy warning while executing no effects',()=>{
 const {c,feat}=setup();const entry={...structuredClone(feat),raw:{...feat.raw,_copy:{name:'Unknown',source:'CUSTOM'}}};c.selections.push({id:'unresolved-master',entry,level:1,quantity:1,equipped:false});expect(evaluate(c).issues.find(row=>row.id==='copy:unresolved-master')?.message).toContain('尚未完整展开');expect(evaluate(c).abilities.str).toBe(13);
});
it.each(['XPHB','XDMG','XMM'].flatMap(source=>['2014','both'].map(edition=>({source,edition}))))('modern core source $source cannot claim legacy magic proficiency by forging normalized edition $edition',({source,edition})=>{
 const {c}=setup(),magic=c.selections.find(row=>row.id==='weapon-master-magic')!.entry;magic.source=source;magic.edition=edition as Entry['edition'];magic.raw.source=source;delete magic.raw.edition;
 expect(reviewedWeaponTrainingMatches(magic,'Longsword|PHB')).toBe(false);magic.raw.edition='classic';expect(reviewedWeaponTrainingMatches(magic,'Longsword|PHB')).toBe(false);
});
it.each(['future','2014','2024','one','unknown'])('unrecognized magic raw edition %s does not inherit the reviewed PHB kind',edition=>{
 const {c}=setup(),magic=c.selections.find(row=>row.id==='weapon-master-magic')!.entry;magic.raw.edition=edition;expect(reviewedWeaponTrainingMatches(magic,'Longsword|PHB')).toBe(false);
});
it.each([{source:'PHB',edition:'both',rawEdition:'classic'},{source:'ERLW',edition:'2014',rawEdition:undefined}])('magic normalized edition must agree with source $source and raw edition $rawEdition',({source,edition,rawEdition})=>{
 const {c}=setup(),magic=c.selections.find(row=>row.id==='weapon-master-magic')!.entry;magic.source=source;magic.edition=edition as Entry['edition'];magic.raw.source=source;magic.raw.edition=rawEdition;expect(reviewedWeaponTrainingMatches(magic,'Longsword|PHB')).toBe(false);
});
