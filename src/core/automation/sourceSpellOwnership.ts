import type {Character,Entry,Selection} from '../model';
import {matchesReference} from '../entryReferences';
import {learnedInvocationRule,invocationSpellMatches} from './invocations';

/** The legacy declared-list route only. Specialized item routes retain their
 * stronger, independently reviewed ownership checks. An ID is not ownership. */
export const declaredSourceSpellKey=(key?:string)=>!!key&&/^source-spell:\d+\/(known|prepared|innate)\//.test(key);
interface Binding {id:string;owner:Selection;key:string;entry:Entry}
// Native validation preserves unknown JSON fields. A legacy sync may not
// overwrite a future client’s configuration merely because owner/key match.
const specialFields=new Set(['mode','max','recovery','label','manualSource','sourceGrant']);
const grantFields=new Set(['ownerId','key','itemChargedSpell','targetScope','targetEntryId','sourceActionTiming','usageKey','resourceKey','resourceName','resourceCost','canUseSlots','ability','active','reason','usage','castLevel']);
const onlyKnown=(value:object,fields:ReadonlySet<string>)=>Reflect.ownKeys(value).every(key=>typeof key==='string'&&fields.has(key));
const itemOnlyFields=['itemChargedSpell','targetScope','targetEntryId','sourceActionTiming'];
const normalized=(value:unknown):unknown=>Array.isArray(value)?value.map(normalized):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,normalized(v)])):value;
const sameTarget=(a:Entry,b:Entry)=>JSON.stringify(normalized(a))===JSON.stringify(normalized(b));
/** Schedule paths end before the UID; a literal slash may belong to the spell name. */
function declaredReference(key:string):string|undefined{
 const match=/^source-spell:\d+\/(?:known|prepared|innate)\/(?:_|s[1-9]|\d+)\/(?:_|will|ritual|(?:daily|rest|limited)\/(?:\d+e?|pbe?)|resource\/\d+)\/(.+)$/.exec(key);
 return match?.[1].split('#')[0];
}
// The reviewed at-will planner resolves translated UIDs through its canonical
// invocation proof, not the editable display label. Reuse that exact narrow
// proof and grant path; arbitrary raw names are not an ownership fallback.
function reviewedInvocationTarget(c:Character,row:Selection):boolean{
 const owners=c.selections.filter(owner=>owner.id===row.parentId);
 if(owners.length!==1)return false;
 const rule=learnedInvocationRule(c,owners[0]);
 return !!rule&&rule.mechanism==='spell'&&!rule.payment&&!!rule.spell&&row.grantKey===`source-spell:0/innate/_/_/${rule.spell.toLowerCase()}`&&invocationSpellMatches(row.entry,rule);
}

/** Verify the saved ownership envelope, not mutable availability, caster
 * ability, PB maximum or shared-pool choice. Those remain legitimate updates.
 * Saved target snapshots still win over catalog refreshes, as in the planner. */
export function declaredSourceSpellOwnedChild(c:Character,row:Selection,binding?:Binding):boolean{
 const key=row.grantKey,config=c.spellSettings?.special?.[row.id],g=config?.sourceGrant;
 if(!declaredSourceSpellKey(key)||!row.parentId||row.entry.kind!=='spell'||c.selections.filter(s=>s.id===row.id).length!==1||row.id!==`auto-spell:${row.parentId}:${encodeURIComponent(key!)}`||!config||config.manualSource!==undefined||!['locked','uses'].includes(config.mode)||!g||g.ownerId!==row.parentId||g.key!==key||typeof g.active!=='boolean'||!onlyKnown(config,specialFields)||!onlyKnown(g,grantFields)||itemOnlyFields.some(field=>Object.hasOwn(g,field)))return false;
 // Withdrawal may no longer have a live plan, but its original UID must still
 // identify this saved target. Never deactivate another spell's configuration.
 const reference=declaredReference(key!);if(!reference)return false;const parts=reference.split('|');
 if(!parts[0]||!matchesReference(row.entry,`${parts[0]}|${parts[1]||'PHB'}`)&&!reviewedInvocationTarget(c,row))return false;
 return !binding||c.selections.filter(s=>s.id===binding.owner.id).length===1&&row.id===binding.id&&row.parentId===binding.owner.id&&key===binding.key&&sameTarget(row.entry,binding.entry);
}
export function declaredSourceSpellCollision(c:Character,binding:Binding):boolean{
 if(!declaredSourceSpellKey(binding.key))return false;
 const rows=c.selections.filter(row=>row.id===binding.id);
 return rows.length>0&&(rows.length!==1||!declaredSourceSpellOwnedChild(c,rows[0],binding));
}
