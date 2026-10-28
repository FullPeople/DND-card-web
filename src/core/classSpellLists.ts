import type {Entry} from './model';
const key=(value:unknown)=>String(value??'').trim().toLowerCase();
/** Existing direct-base decoder, shared without reclassifying lookup objects.
 * In particular plural definedInSources is not globally rewritten here. */
export function directBaseClassList(entry:Entry,owner:Entry):boolean{
 const names=[owner.name,owner.english,owner.raw.name,owner.raw.ENG_name].map(key),source=key(owner.source),raw=entry.raw;
 const matches=(row:any)=>row&&key(row.source||'PHB')===source&&[row.name,row.ENG_name].some(name=>names.includes(key(name)));
 if(Array.isArray(raw.classes?.fromClassList)&&raw.classes.fromClassList.some(matches))return true;
 const lookup=raw._spellClasses;if(lookup&&typeof lookup==='object'&&!Array.isArray(lookup))for(const [book,classes]of Object.entries(lookup))if(key(book)===source&&classes&&typeof classes==='object'&&!Array.isArray(classes))for(const [name,definition]of Object.entries(classes)){if(!names.includes(key(name)))continue;const value=definition as any;if(value===true||value&&typeof value==='object'&&!Array.isArray(value)&&!value.definedInSource&&!value.isVariant)return true;}
 return false;
}
