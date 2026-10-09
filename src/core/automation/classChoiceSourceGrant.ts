import {selectionEffectsAllowed,type Character,type Selection} from '../model';
import {matchesReference} from '../entryReferences';

/** Restore an already saved source grant, not a new rule inferred from a name.
 * Both the parked parent and the independently retained source snapshot must
 * agree with the active owner's exact declaration and legal current level.
 */
export function retainedClassFeatureGrant(c:Character,owner:Selection,ref:string){
 const at=Number(ref.split('|')[3]);
 if(owner.entry.kind!=='class'||!Number.isSafeInteger(owner.level)||owner.level<1||owner.level>20||!Number.isSafeInteger(at)||at<1||at>owner.level||
  !selectionEffectsAllowed(c,owner.entry)||c.dismissedFeatures?.includes(`${owner.id}|ref:${ref}`))return;
 const declared=Array.isArray(owner.entry.raw.classFeatures)&&owner.entry.raw.classFeatures.some((raw:unknown)=>(typeof raw==='string'?raw:raw&&typeof raw==='object'?(raw as {classFeature?:unknown}).classFeature:undefined)===ref);
 if(!declared)return;
 return Object.values(c.classChoiceArchive||{}).map(archive=>({archive,parent:archive.parent})).find(({archive,parent})=>{
  if(!parent||parent.entry.kind!=='feature'||parent.entry.raw._category!=='classFeature'||parent.parentId!==owner.id||parent.grantKey!==`ref:${ref}`||
   archive.selections[0]?.parentId!==parent.id||![`${owner.id}:class-feat:`,`${owner.id}:class-typed-feat:`].some(prefix=>archive.choiceId.startsWith(prefix))||c.selections.some(row=>row.id===parent.id)||
   !selectionEffectsAllowed(c,parent.entry)||!matchesReference(parent.entry,ref))return false;
  const raw=parent.entry.raw,snapshot=c.classChoiceSnapshots?.[parent.entry.id];
  const key=(value:unknown)=>String(value??'').trim().toLowerCase(),ownerNames=[owner.entry.name,owner.entry.english,owner.entry.raw.name,owner.entry.raw.ENG_name].map(key).filter(Boolean);
  return raw.level===at&&key(raw.classSource||'PHB')===key(owner.entry.source)&&[raw.className,raw.classEnglish].map(key).filter(Boolean).some(name=>ownerNames.includes(name))&&
   (owner.entry.edition==='both'||parent.entry.edition==='both'||owner.entry.edition===parent.entry.edition)&&
   !!snapshot&&snapshot.id===parent.entry.id&&JSON.stringify(snapshot)===JSON.stringify(parent.entry);
 })?.parent;
}
