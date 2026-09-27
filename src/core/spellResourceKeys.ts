import type {Character} from './model';

export const specialSpellResource=(id:string,c?:Character)=>c?.spellSettings?.special?.[id]?.sourceGrant?.resourceKey||`innate-spell:${id}`;
