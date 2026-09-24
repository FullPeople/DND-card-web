import type {Character} from './model';

/** Remember sources already defaulted so a user's later uncheck stays unchecked. */
export function includeNewDefaultSources(character:Character,sources:readonly string[]):Character{
 const seen=character.profile.autoSourceDefaults;
 if(!seen)return character;
 const known=new Set(seen),added=[...new Set(sources)].filter(source=>!known.has(source));
 if(!added.length)return character;
 return {...character,profile:{...character.profile,autoSourceDefaults:[...seen,...added],enabledSources:[...new Set([...character.profile.enabledSources,...added])]}};
}
export function startAllSources(character:Character,sources:readonly string[]):Character{
 return includeNewDefaultSources({...character,profile:{...character.profile,autoSourceDefaults:[...character.profile.enabledSources]}},sources);
}
