import {selectionEffectsAllowed,type Character,type Entry,type Selection} from '../model';
import {matchesReference} from '../entryReferences';
import evidence from './invocationEvidence.json' with {type:'json'};
import dualEvidence from './invocationDualEvidence.json' with {type:'json'};
import {activeSelections} from './active';
import {casterProfiles} from '../spellcastingRules';

export interface ReviewedInvocationRule {reference:string;page:number;mechanism:string;skills?:string[];spell?:string;spellReference?:string;spellLevel?:number;requiredClassLevel?:number;selfOnly?:boolean;payment?:'pact-and-use';boundary:string}
const reviewedRules:ReviewedInvocationRule[]=[...evidence.rules,...dualEvidence.rules as ReviewedInvocationRule[]];

const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const matchesIdentity=(entry:Entry,reference:string)=>matchesReference({...entry,name:entry.english},reference);
const consistentIdentity=(entry:Entry,reference:string)=>matchesIdentity(entry,reference)&&matchesIdentity({...entry,english:entry.raw.ENG_name||entry.raw.name,source:entry.raw.source},reference);
/** Stable family discriminator also accepts retained, edited historical records.
 * It authorizes archival storage, never automatic mechanics. */
export function invocationRecord(entry:Entry){return entry.kind==='feature'&&entry.raw._category==='optionalfeature'&&same(entry.raw.featureType,['EI']);}
/** Narrow source identities and declared mechanical shapes. Display-name-only,
 * copied, altered, cross-edition and additional mechanical payloads stay manual. */
export function invocationRule(entry:Entry):ReviewedInvocationRule|undefined{
 if(!invocationRecord(entry)||entry.edition!=='2014'||entry.effects?.length||entry.choices?.length)return;
 const raw=entry.raw;
 if(Object.keys(raw).some(key=>!['name','ENG_name','source','page','srd','reprintedAs','featureType','prerequisite','skillProficiencies','additionalSpells','entries','translator','_category'].includes(key)))return;
 const rule=reviewedRules.find(rule=>consistentIdentity(entry,rule.reference));if(!rule)return;
 if(!same(raw.prerequisite,rule.requiredClassLevel?[{level:{level:rule.requiredClassLevel,class:{ENG_name:'Warlock',name:'魔契师'}}}]:undefined))return;
 if(rule.mechanism==='skills')return raw.additionalSpells===undefined&&same(raw.skillProficiencies,[Object.fromEntries(rule.skills!.map(skill=>[skill,true]))])?rule:undefined;
 return raw.skillProficiencies===undefined&&same(raw.additionalSpells,[{innate:{_:rule.payment==='pact-and-use'?{daily:{'1e':[rule.spell]}}:[rule.spell]}}])?rule:undefined;
}
/** A reviewed invocation payment belongs to the exact PHB spell identity, not a
 * translated display-name match, copied identity, or custom mechanics. The
 * reviewed spell level is declared per rule; higher-level grants never inherit
 * a first-level payment or authorize an arbitrary same-label spell. */
export function invocationSpellMatches(entry:Entry,rule:NonNullable<ReturnType<typeof invocationRule>>):boolean{
 const raw=entry.raw;
 return rule.mechanism==='spell'&&!!rule.spellReference&&entry.kind==='spell'&&entry.edition==='2014'&&raw._category==='spell'&&raw.edition!=='one'&&raw.level===rule.spellLevel&&!raw._copy&&!raw._unresolvedParent&&!entry.effects?.length&&!entry.choices?.length&&matchesIdentity(entry,rule.spellReference)&&matchesIdentity({...entry,english:raw.ENG_name||raw.name,source:raw.source},rule.spellReference);
}
export function invocationProgression(owner:Entry,group:unknown):boolean{
 const raw=group as {featureType?:unknown;progression?:unknown}|undefined;
 return owner.kind==='class'&&owner.edition==='2014'&&!owner.raw._copy&&!owner.raw._unresolvedParent&&owner.raw.edition!=='one'&&consistentIdentity(owner,evidence.owner)&&!!raw&&same(raw.featureType,['EI'])&&same(raw.progression,evidence.knownProgression);
}
/** The parent must be the active declared grant, not a manual same-name feature. */
export function invocationSource(c:Character,owner:Selection,group:unknown):Selection|undefined{
 if(!invocationProgression(owner.entry,group)||!selectionEffectsAllowed(c,owner.entry)||!Number.isSafeInteger(owner.level)||owner.level<2||owner.level>20)return;
 const refs=Array.isArray(owner.entry.raw.classFeatures)?owner.entry.raw.classFeatures.flatMap((raw:unknown)=>{const ref=typeof raw==='string'?raw:(raw as {classFeature?:unknown})?.classFeature;return typeof ref==='string'?[ref]:[];}):[];
 const rows=c.selections.filter(row=>row.parentId===owner.id&&row.entry.raw._category==='classFeature'&&row.entry.raw.level===2&&row.entry.english===evidence.classFeatureEnglish&&!row.entry.raw._copy&&!row.entry.raw._unresolvedParent&&row.entry.edition==='2014'&&matchesReference(row.entry,evidence.classFeatureReference)&&selectionEffectsAllowed(c,row.entry)&&refs.some(ref=>row.grantKey===`ref:${ref}`&&matchesReference(row.entry,ref)&&!c.dismissedFeatures?.includes(`${owner.id}|ref:${ref}`)));
 return rows.length===1?rows[0]:undefined;
}
export const invocationChoiceHint='已核对的 PHB 祈唤自动授予技能熟练、随意施法或次数与契约位双消耗施法资格；法术实际效果与替换时机仍手动处理。未适配祈唤只保留学习记录。';

/** Invocation payment is this class-learning grant only, not an automatic upgrade of
 * directly imported/manual invocations or other grant mechanisms. */
export function learnedInvocationRule(c:Character,row:Selection){
 const rule=invocationRule(row.entry);if(!rule||!row.requirementId||row.grantKey!==`choice:${row.requirementId}:${row.entry.id}`)return;
 const source=c.selections.find(parent=>parent.id===row.parentId),owner=source&&c.selections.find(parent=>parent.id===source.parentId&&parent.entry.kind==='class');if(!owner||owner.level<(rule.requiredClassLevel??2))return;
 const prefix=`${owner.id}:class-optional:`,index=row.requirementId.startsWith(prefix)?row.requirementId.slice(prefix.length):'';if(!/^\d+$/.test(index))return;
 const group=owner.entry.raw.optionalfeatureProgression?.[Number(index)];if(invocationSource(c,owner,group)?.id!==source!.id)return;
 const answers=(c.answers[row.requirementId]||[]).slice(0,evidence.knownProgression[owner.level-1]),position=answers.indexOf(row.entry.id);if(position<0)return;
 const snapshots={...Object.fromEntries(c.selections.map(selection=>[selection.entry.id,selection.entry])),...c.classChoiceSnapshots};
 if(answers.slice(0,position).some(id=>snapshots[id]&&invocationRule(snapshots[id])?.reference===rule.reference))return;
 return rule;
}

/** Family recognition blocks unsupported/edited invocations from falling through
 * to the generic daily-free-cast adapter. It grants no mechanics by itself. */
export function invocationCandidate(entry:Entry):boolean{
 return entry.raw._category==='optionalfeature'&&Array.isArray(entry.raw.featureType)&&entry.raw.featureType.includes('EI')||reviewedRules.some(rule=>matchesIdentity(entry,rule.reference));
}
/** One current PHB Warlock and its actual Pact Magic grant own this global slot
 * pool. Multiple pact casters cannot be disambiguated by a bare resource ID. */
export function invocationPactSlot(c:Character,row:Selection):{resourceId:string;level:number;max:number}|undefined{
 const rule=learnedInvocationRule(c,row);if(rule?.payment!=='pact-and-use')return;
 const source=c.selections.find(parent=>parent.id===row.parentId),owner=source&&c.selections.find(parent=>parent.id===source.parentId);
 if(!owner||owner.entry.raw.casterProgression!=='pact'||owner.entry.raw.spellcastingAbility!=='cha'||source!.entry.kind!=='feature'||source!.entry.raw.ENG_name!==evidence.classFeatureEnglish||source!.entry.raw.source!=='PHB'||source!.entry.raw.edition==='one'||source!.entry.effects?.length||source!.entry.choices?.length)return;
 const active=activeSelections(c),profiles=casterProfiles(c).filter(profile=>active.some(row=>row.id===profile.owner.id));
 const pacts=profiles.filter(profile=>profile.casting.entry.raw.casterProgression==='pact');
 if(pacts.length!==1||pacts[0].owner.id!==owner.id||pacts[0].casting.id!==owner.id)return;
 const refs=Array.isArray(owner.entry.raw.classFeatures)?owner.entry.raw.classFeatures.flatMap((raw:unknown)=>{const ref=typeof raw==='string'?raw:(raw as {classFeature?:unknown})?.classFeature;return typeof ref==='string'?[ref]:[];}):[];
 const grants=active.filter(feature=>feature.parentId===owner.id&&feature.entry.kind==='feature'&&feature.entry.raw._category==='classFeature'&&feature.entry.raw.level===1&&feature.entry.english===dualEvidence.pactFeatureEnglish&&feature.entry.raw.ENG_name===dualEvidence.pactFeatureEnglish&&feature.entry.edition==='2014'&&feature.entry.raw.edition!=='one'&&!feature.entry.effects?.length&&!feature.entry.choices?.length&&!feature.entry.raw._copy&&!feature.entry.raw._unresolvedParent&&matchesReference(feature.entry,dualEvidence.pactFeatureReference)&&feature.entry.raw.source==='PHB'&&refs.some(ref=>feature.grantKey===`ref:${ref}`&&matchesReference(feature.entry,ref)&&!c.dismissedFeatures?.includes(`${owner.id}|ref:${ref}`)));
 if(grants.length!==1)return;
 const level=Math.min(5,Math.ceil(owner.level/2)),max=owner.level<11?2:owner.level<17?3:4;
 if(level<(rule.spellLevel??10))return;
 return {resourceId:`pact-slot:${level}`,level,max};
}
