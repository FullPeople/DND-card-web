import {it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {chooseCantrip,clearCantrip} from '../src/core/spellWorkspace';
import {learnedCantripPrerequisite,reviewedLearnedSpellPrerequisite,type LearnedCantripCriteria} from '../src/core/automation/learnedSpellPrerequisite';
import {sourceChoicePrerequisite} from '../src/core/automation/sourceClassChoices';

const make=(name:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id:name,kind,name,english:name,raw,source:'XPHB',edition:'2024',packId:'authored',revision:'1',entries:['原创学习资格测试。']});
function setup(){
 const c=newCharacter();c.automation=newAutomationState();
 const owner={id:'owner',entry:make('Authored Caster','class',{casterProgression:'full',cantripProgression:Array(20).fill(2)}),level:3,quantity:1,equipped:false};
 c.selections=[owner];c.runtime.hp=3;c.runtime.resources.authored={max:3,current:1};
 const spell=make('Authored Damage','spell',{level:0,damageInflict:['force'],spellAttack:['R'],classes:{fromClassList:[{name:owner.entry.name,source:owner.entry.source}]}});
 return {c,owner,spell};
}
const damage:LearnedCantripCriteria={level:0,damage:true},attack:LearnedCantripCriteria={...damage,attack:['m','r','o']};

it('checks actual learned slots without changing the card; clearing and restoring knowledge does not refill anything',()=>{
 const {c,owner,spell}=setup();expect(learnedCantripPrerequisite(c,owner,damage)).toBeTruthy();
 expect(chooseCantrip(c,spell,owner.id).error).toBeUndefined();const before=JSON.stringify(c);
 expect(learnedCantripPrerequisite(c,owner,damage)).toBeUndefined();expect(learnedCantripPrerequisite(c,owner,attack)).toBeUndefined();expect(JSON.stringify(c)).toBe(before);
 clearCantrip(c,owner.id,0);expect(learnedCantripPrerequisite(c,owner,damage)).toBeTruthy();
 expect(chooseCantrip(c,spell,owner.id).error).toBeUndefined();expect(learnedCantripPrerequisite(c,owner,damage)).toBeUndefined();expect(c.runtime.resources.authored.current).toBe(1);expect(c.runtime.hp).toBe(3);
});

it.each(['save','melee','other'])('separates a damaging %s cantrip from its attack requirement',mode=>{
 const {c,owner,spell}=setup();if(mode==='save')delete spell.raw.spellAttack;else spell.raw.spellAttack=[mode==='melee'?'M':'O'];
 expect(chooseCantrip(c,spell,owner.id).error).toBeUndefined();expect(learnedCantripPrerequisite(c,owner,damage)).toBeUndefined();expect(!!learnedCantripPrerequisite(c,owner,attack)).toBe(mode==='save');
});

it.each(['missing-damage','unknown-damage','string-level','overflow','other-class','manual-only','disabled-owner','disabled-spell','inactive-parent','missing-parent','cycle','wrong-edition','special-library','unresolved-copy','wrong-class-list'])('rejects %s and preserves recorded values',reason=>{
 const {c,owner,spell}=setup();expect(chooseCantrip(c,spell,owner.id).error).toBeUndefined();const row=c.selections.find(row=>row.entry.kind==='spell')!;
 if(reason==='missing-damage')delete row.entry.raw.damageInflict;
 if(reason==='unknown-damage')row.entry.raw.damageInflict=['authored-unknown'];
 if(reason==='string-level')row.entry.raw.level='0';
 if(reason==='overflow')c.spellSettings!.cantripCapacityAdjustments={owner:-2};
 if(reason==='other-class'){c.spellSettings!.cantrips!.another=[row.id];c.spellSettings!.cantrips!.owner=[];}
 if(reason==='manual-only'){c.spellSettings!.cantrips!.manual=[row.id];c.spellSettings!.cantrips!.owner=[];}
 if(reason==='disabled-owner')c.profile.disabledEntries=[owner.entry.id];
 if(reason==='disabled-spell')c.profile.disabledEntries=[row.entry.id];
 if(reason==='inactive-parent'){row.parentId='inactive';c.selections.push({id:'inactive',entry:make('inactive','feature'),level:1,quantity:1,equipped:false});c.profile.disabledEntries=['inactive'];}
 if(reason==='missing-parent')row.parentId='missing';
 if(reason==='cycle')row.parentId=row.id;
 if(reason==='wrong-edition')row.entry.edition='2014';
 if(reason==='special-library')c.spellSettings!.special={[row.id]:{mode:'locked',manualSource:{ownerId:owner.id}}};
 if(reason==='unresolved-copy')row.entry.raw._unresolvedCopy=true;
 if(reason==='wrong-class-list')row.entry.raw.classes={fromClassList:[{name:'Another Authored Caster',source:'XPHB'}]};
 const before=JSON.stringify(c);expect(learnedCantripPrerequisite(c,owner,damage)).toBeTruthy();expect(JSON.stringify(c)).toBe(before);
});

it('never accepts an unreviewed filter, a same-name homebrew source or extra unsupported conditions',()=>{
 const {c,owner,spell}=setup();expect(chooseCantrip(c,spell,owner.id).error).toBeUndefined();
 const entry=make('Authored Unreviewed','feature',{_category:'optionalfeature',featureType:['EI'],prerequisite:[{spell:[{choose:'level=0|class=Authored Caster',entry:'原创说明',entrySummary:'原创说明'}]}]});
 expect(reviewedLearnedSpellPrerequisite(c,entry,owner)).toContain('手动核对');expect(sourceChoicePrerequisite(c,entry,owner,true)).toContain('手动核对');
 entry.raw.prerequisite[0].spell=['Authored Damage|XPHB'];expect(sourceChoicePrerequisite(c,entry,owner,true)).toContain('手动核对');
 entry.source='AUTHORED';expect(reviewedLearnedSpellPrerequisite(c,entry,owner)).toContain('手动核对');
 entry.raw.prerequisite=[{otherUnknown:true}];expect(sourceChoicePrerequisite(c,entry,owner,true)).toContain('手动核对');
});

it('uses the actual optional-choice owner when duplicate class identities have different levels',()=>{
 const {c,owner}=setup();c.selections.unshift({...owner,id:'other-owner',level:9});owner.level=1;
 const entry=make('Authored Level Gate','feature',{prerequisite:[{level:{level:2,class:{name:owner.entry.name,source:owner.entry.source}}}]});
 expect(sourceChoicePrerequisite(c,entry,owner,true)).toContain('等级 2');
});
