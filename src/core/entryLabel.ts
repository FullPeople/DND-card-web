import type {Entry} from './model';
export const entryLabel=(entry:Entry)=>`${entry.source==='IMPORTED'||entry.packId==='imported'||entry.raw?._custom?'▞ ':''}${entry.name.replace(/^▞\s*/, '')}`;
