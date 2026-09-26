import {evaluate} from '../core/engine';
import {exportLinkedOwlbear} from '../core/export';
import {parseFile,readCharacter,importOwlbear} from '../core/validation';
/** Shared upload boundary for the legacy host; no browser storage or Wiki IO. */
export function normalizeLegacyUpload(input:unknown){
 const value=(typeof input==='string'?parseFile(input):input) as any;
 const native=value?.dnd_card_web??(value?.format==='dnd-card-web'?value.character:value?.schemaVersion===1?value:undefined);
 const card=native?readCharacter(native).character:importOwlbear(value);
 return exportLinkedOwlbear(card,evaluate(card));
}
