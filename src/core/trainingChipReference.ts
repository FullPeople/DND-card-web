import type {Entry} from './model';

type ResolveReference=(reference:string,kind?:string)=>Entry|undefined;
/** Resolve only the visible caption. The original UID remains the link and saved value. */
export function trainingChipReference(value:string,defaultKind:string,resolve?:ResolveReference){
 const tag=/^\{@(\w+) ([^{}]+)\}$/.exec(value),kind=tag?.[1]||defaultKind,reference=tag?.[2]||value;
 const entry=resolve?.(reference,kind),parts=reference.split('|');
 // Explicit source labels and user captions win. Unknown entries keep a readable
 // name until their catalog arrives, without guessing a translation or a source.
 const label=parts[2]||entry?.name||parts[0];
 return {reference,kind,label,entry};
}
