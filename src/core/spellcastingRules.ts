import {selectionAllowed,type Character,type Entry,type Selection} from './model';
import {parentClass} from './featureOwnership';

export type CasterProfile={owner:Selection;casting:Selection;mode:'known'|'prepared';pool:'learned'|'book'|'list';maxLevel:number};
const key=(value:unknown)=>String(value??'').trim().toLowerCase();

/** The source declares *when* preparation changes, not merely whether its table says Prepared. */
export function casterProfiles(c:Character):CasterProfile[]{
 return c.selections.filter(s=>s.entry.kind==='class'&&selectionAllowed(c,s.entry)).flatMap(owner=>{
  const subclass=c.selections.find(s=>s.entry.kind==='subclass'&&parentClass(c,s)?.id===owner.id&&selectionAllowed(c,s.entry));
  const casting=subclass?.entry.raw.casterProgression?subclass:owner,raw=casting.entry.raw;
  if(!raw.casterProgression&&!raw.spellcastingAbility&&!raw.preparedSpells&&!raw.preparedSpellsProgression&&!raw.spellsKnownProgression&&!raw.classTableGroups?.some((g:any)=>g.rowsSpellProgression))return [];
  const hasPreparation=!!raw.preparedSpells||Array.isArray(raw.preparedSpellsProgression);
  const mode=raw.preparedSpellsChange==='level'||(!hasPreparation&&!!raw.spellsKnownProgression)?'known':'prepared';
  const pool=mode==='known'?'learned':raw.spellsKnownProgressionFixed?'book':raw.preparedSpellsChange==='restLong'?'list':'learned';
  const groups=[...(owner.entry.raw.classTableGroups||[]),...(casting.entry.raw.subclassTableGroups||[])];
  const table=groups.map((g:any)=>g.rowsSpellProgression?.[owner.level-1]).find((row:any)=>Array.isArray(row)&&row.every((n:any)=>typeof n==='number'));
  let maxLevel=0;
  if(table)maxLevel=table.reduce((max:number,n:number,i:number)=>n>0?i+1:max,0);
  else if(raw.casterProgression==='full')maxLevel=Math.min(9,Math.ceil(owner.level/2));
  else if(['half','1/2','artificer'].includes(raw.casterProgression))maxLevel=Math.min(5,Math.ceil(owner.level/4));
  else if(['third','1/3'].includes(raw.casterProgression))maxLevel=owner.level<3?0:Math.min(4,Math.ceil(owner.level/6));
  else if(raw.casterProgression==='pact')maxLevel=Math.min(5,Math.ceil(owner.level/2));
  return [{owner,casting,mode,pool,maxLevel}];
 });
}

export function inferredSpellMode(c:Character):'known'|'prepared'|undefined{
 const profiles=casterProfiles(c);return profiles.length?profiles.some(p=>p.mode==='prepared')?'prepared':'known':undefined;
}

/** Match the upstream class lookup by source and either language; never merge translated names. */
export function spellOnClassList(entry:Entry,profile:CasterProfile):boolean{
 const raw=entry.raw,names=[profile.owner.entry.name,profile.owner.entry.english,profile.owner.entry.raw.name,profile.owner.entry.raw.ENG_name].map(key);
 const source=key(profile.owner.entry.source),lookup=raw._spellClasses;
 // Expansion books often predate the 2024 lookup. Their class list remains usable
 // with either PHB class, while the spell's own source-qualified identity stays intact.
 const expansion=!['phb','xphb','dmg','xdmg'].includes(key(entry.source));
 const sameClassSource=(book:unknown)=>key(book)===source||expansion&&['phb','xphb'].includes(source)&&['phb','xphb'].includes(key(book));
 if(lookup&&typeof lookup==='object')for(const [book,classes] of Object.entries(lookup))if(sameClassSource(book)&&classes&&typeof classes==='object'&&Object.keys(classes).some(name=>names.includes(key(name))))return true;
 return [...(raw.classes?.fromClassList||[]),...(raw.classes?.fromClassListVariant||[])].some(row=>sameClassSource(row.source||'PHB')&&[row.name,row.ENG_name].some(name=>names.includes(key(name))));
}

/** Full-list access is a read-only projection. Only an actually prepared spell is stored on the card. */
export function availableClassSpells(c:Character,entries:Entry[]):Entry[]{
 const profiles=casterProfiles(c).filter(p=>p.mode==='prepared'&&p.pool==='list');
 return entries.filter(e=>e.kind==='spell'&&Number(e.raw.level)>0&&selectionAllowed(c,e)&&profiles.some(p=>Number(e.raw.level)<=p.maxLevel&&spellOnClassList(e,p)));
}

export function spellUsesPreparation(c:Character,entry:Entry):boolean{
 if(c.selections.some(s=>s.entry.id===entry.id&&c.spellSettings?.special?.[s.id]))return false;
 if(!(Number(entry.raw.level)>0))return false;
 if(c.spellSettings?.modeOverride)return c.spellSettings.mode==='prepared';
 const profiles=casterProfiles(c),matching=profiles.filter(p=>spellOnClassList(entry,p));
 return matching.length?matching.some(p=>p.mode==='prepared'):(inferredSpellMode(c)??c.spellSettings?.mode??'prepared')==='prepared';
}
