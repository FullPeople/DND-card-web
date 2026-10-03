import type {Character,Entry} from './model';
/** Legacy API: automatic loading does not adopt raw casting declarations.
 * Explicit card review selects a validated source snapshot instead. */
export function hydrateImportedCasting(_c:Character,_entries:Entry[]):boolean{return false;}
