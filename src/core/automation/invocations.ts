import {selectionEffectsAllowed,type Character,type Entry,type Selection} from '../model';
import {matchesReference} from '../entryReferences';
import evidence from './invocationEvidence.json' with {type:'json'};

const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const matchesIdentity=(entry:Entry,reference:string)=>matchesReference({...entry,name:entry.english},reference);
/** Stable family discriminator also accepts retained, edited historical records.
 * It authorizes archival storage, never automatic mechanics. */
export function invocationRecord(entry:Entry){return entry.kind==='feature'&&entry.raw._category==='optionalfeature'&&same(entry.raw.featureType,['EI']);}
/** Narrow source identities and declared mechanical shapes. Display-name-only,
 * copied, altered, cross-edition and additional mechanical payloads stay manual. */
export function invocationRule(entry:Entry){
 if(!invocationRecord(entry)||entry.edition!=='2014'||entry.effects?.length||entry.choices?.length)return;
 const raw=entry.raw;
 if(Object.keys(raw).some(key=>!['name','ENG_name','source','page','srd','reprintedAs','featureType','skillProficiencies','additionalSpells','entries','translator','_category'].includes(key)))return;
 const rule=evidence.rules.find(rule=>matchesIdentity(entry,rule.reference));if(!rule)return;
 if(rule.mechanism==='skills')return raw.additionalSpells===undefined&&same(raw.skillProficiencies,[Object.fromEntries(rule.skills!.map(skill=>[skill,true]))])?rule:undefined;
 return raw.skillProficiencies===undefined&&same(raw.additionalSpells,[{innate:{_:[rule.spell]}}])?rule:undefined;
}
/** A reviewed free payment belongs to the exact PHB spell identity, not a
 * translated display-name match, copied identity, or custom mechanics. All
 * currently reviewed spell grants cast a 1st-level spell. */
export function invocationSpellMatches(entry:Entry,rule:NonNullable<ReturnType<typeof invocationRule>>):boolean{
 const raw=entry.raw;
 return rule.mechanism==='spell'&&!!rule.spellReference&&entry.kind==='spell'&&entry.edition==='2014'&&raw._category==='spell'&&raw.edition!=='one'&&raw.level===1&&!raw._copy&&!raw._unresolvedParent&&!entry.effects?.length&&!entry.choices?.length&&matchesIdentity(entry,rule.spellReference)&&matchesIdentity({...entry,english:raw.ENG_name||raw.name,source:raw.source},rule.spellReference);
}
export function invocationProgression(owner:Entry,group:unknown):boolean{
 const raw=group as {featureType?:unknown;progression?:unknown}|undefined;
 return owner.kind==='class'&&owner.edition==='2014'&&!owner.raw._copy&&!owner.raw._unresolvedParent&&matchesIdentity(owner,evidence.owner)&&!!raw&&same(raw.featureType,['EI'])&&same(raw.progression,evidence.knownProgression);
}
/** The parent must be the active declared grant, not a manual same-name feature. */
export function invocationSource(c:Character,owner:Selection,group:unknown):Selection|undefined{
 if(!invocationProgression(owner.entry,group)||!selectionEffectsAllowed(c,owner.entry)||!Number.isSafeInteger(owner.level)||owner.level<2||owner.level>20)return;
 const refs=Array.isArray(owner.entry.raw.classFeatures)?owner.entry.raw.classFeatures.flatMap((raw:unknown)=>{const ref=typeof raw==='string'?raw:(raw as {classFeature?:unknown})?.classFeature;return typeof ref==='string'?[ref]:[];}):[];
 const rows=c.selections.filter(row=>row.parentId===owner.id&&row.entry.raw._category==='classFeature'&&row.entry.raw.level===2&&row.entry.english===evidence.classFeatureEnglish&&!row.entry.raw._copy&&!row.entry.raw._unresolvedParent&&row.entry.edition==='2014'&&matchesReference(row.entry,evidence.classFeatureReference)&&selectionEffectsAllowed(c,row.entry)&&refs.some(ref=>row.grantKey===`ref:${ref}`&&matchesReference(row.entry,ref)&&!c.dismissedFeatures?.includes(`${owner.id}|ref:${ref}`)));
 return rows.length===1?rows[0]:undefined;
}
export const invocationChoiceHint='已核对的 PHB 祈唤自动授予技能熟练或随意施法资格；法术实际效果与替换时机仍手动处理。未适配祈唤只保留学习记录。';

/** Free payment is this class-learning grant only, not an automatic upgrade of
 * directly imported/manual invocations or other grant mechanisms. */
export function learnedInvocationRule(c:Character,row:Selection){
 const rule=invocationRule(row.entry);if(!rule||!row.requirementId||row.grantKey!==`choice:${row.requirementId}:${row.entry.id}`)return;
 const source=c.selections.find(parent=>parent.id===row.parentId),owner=source&&c.selections.find(parent=>parent.id===source.parentId&&parent.entry.kind==='class');if(!owner)return;
 const prefix=`${owner.id}:class-optional:`,index=row.requirementId.startsWith(prefix)?row.requirementId.slice(prefix.length):'';if(!/^\d+$/.test(index))return;
 const group=owner.entry.raw.optionalfeatureProgression?.[Number(index)];if(invocationSource(c,owner,group)?.id!==source!.id)return;
 const answers=(c.answers[row.requirementId]||[]).slice(0,evidence.knownProgression[owner.level-1]),position=answers.indexOf(row.entry.id);if(position<0)return;
 const snapshots={...Object.fromEntries(c.selections.map(selection=>[selection.entry.id,selection.entry])),...c.classChoiceSnapshots};
 if(answers.slice(0,position).some(id=>snapshots[id]&&invocationRule(snapshots[id])?.reference===rule.reference))return;
 return rule;
}
