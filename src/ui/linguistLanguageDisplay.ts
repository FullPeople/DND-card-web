import type {Character,Entry} from '../core/model';
import {reviewedLinguistLanguageReference,reviewedLinguistLanguageRows} from '../core/automation/reviewedLinguist';
/** Pure display projection, not a grant or manual-text migration. Only the
 * bounded PHB aliases/dialects may be deduplicated; foreign identities survive. */
export function appendReviewedLinguistLanguages(c:Character,existing:string[]):string[]{
 const rows=reviewedLinguistLanguageRows(c);if(!rows.length)return existing;
 const reference=(value:string)=>{const tag=/^\{@language ([^{}]+)\}$/.exec(value),[name,source]=(tag?.[1]||value).split('|');if(value.includes('{@')&&!tag)return;return reviewedLinguistLanguageReference(`${name}|${source||(c.edition==='2024'?'XPHB':'PHB')}`);};
 const present=new Set<string>(),result=existing.filter(value=>{const ref=reference(value);if(!ref)return true;if(present.has(ref))return false;present.add(ref);return true;});
 for(const row of rows){if(present.has(row.reference))continue;present.add(row.reference);result.push(`{@language ${row.reference}|${row.label}}`);}
 return result;
}

/** Keep the granting source on known bounded fixed declarations before their
 * labels reach the deduplicator. This never touches the manual override. */
export function sourceQualifiedLinguistLanguage(value:string,source:string,catalog:Entry[]):string{
 if(value.includes('|')||value.includes('{@'))return value;
 const reference=reviewedLinguistLanguageReference(value);if(!reference)return value;
 const name=source.toUpperCase()==='PHB'?reference.split('|')[0]:value;
 const named=catalog.find(row=>row.raw._category==='language'&&row.source.toUpperCase()===source.toUpperCase()&&[row.english,row.name].some(alias=>alias.toLowerCase()===name.toLowerCase()));
 // A grant book is not necessarily the vocabulary's source (e.g. TCE common).
 // Only the bounded PHB manifest supports a missing-catalog identity fallback.
 if(!named&&source.toUpperCase()!=='PHB')return value;
 return `{@language ${named?.english||name}|${source}|${named?.name||name}}`;
}
