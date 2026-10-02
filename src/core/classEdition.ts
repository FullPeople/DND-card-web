import {entryEdition,type Character,type Edition} from './model';

/** Titles describe saved class rules, independently of the card/Wiki filter. */
export function classRulesEdition(c:Pick<Character,'selections'>):Edition|undefined{
 const classes=c.selections.filter(row=>row.entry.kind==='class');
 if(!classes.length)return undefined;
 const editions=classes.map(row=>entryEdition(row.entry)),first=editions[0];
 return (first==='2014'||first==='2024')&&editions.every(edition=>edition===first)?first:undefined;
}
export function classEditionSuffix(c:Pick<Character,'selections'>):string{
 const edition=classRulesEdition(c);return edition?` · ${edition}`:'';
}
