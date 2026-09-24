import type {Character,RuleProfile} from './model';

/** Remember sources already defaulted so a user's later uncheck stays unchecked. */
export function includeNewDefaultSources(character:Character,sources:readonly string[]):Character{
 const profile=includeNewProfileSources(character.profile,sources);
 return profile===character.profile?character:{...character,profile};
}
export function includeNewProfileSources<T extends Pick<RuleProfile,'enabledSources'|'autoSourceDefaults'>>(profile:T,sources:readonly string[]):T{
 const seen=profile.autoSourceDefaults;
 if(!seen)return profile;
 const known=new Set(seen),added=[...new Set(sources)].filter(source=>!known.has(source));
 if(!added.length)return profile;
 return {...profile,autoSourceDefaults:[...seen,...added],enabledSources:[...new Set([...profile.enabledSources,...added])]};
}
export function startAllSources(character:Character,sources:readonly string[]):Character{
 return includeNewDefaultSources({...character,profile:{...character.profile,autoSourceDefaults:[...character.profile.enabledSources]}},sources);
}
