import {selectionAllowed,type Character,type Entry,type Selection} from './model';
import {parentClass,featureOwner} from './featureOwnership';
import {automationEnabled} from './automation/state';
import {optionalClassSpellListDecision} from './automation/optionalClassSpellLists';

export type CasterProfile={owner:Selection;casting:Selection;mode:'known'|'prepared';pool:'learned'|'book'|'list';maxLevel:number};
const key=(value:unknown)=>String(value??'').trim().toLowerCase();

/** Preserve both the declared spell level and the owner's unlock level. */
function expandedSpellClasses(entry:Entry,profile:CasterProfile):string[]{
 const blocks=profile.casting.entry.raw.additionalSpells;
 if(!Array.isArray(blocks)||blocks.length!==1)return [];
 const expanded=blocks[0]?.expanded;
 if(!expanded||typeof expanded!=='object'||Array.isArray(expanded))return [];
 const names:string[]=[];
 for(const [gate,values] of Object.entries(expanded)){
  const active=gate==='_'||/^\d+$/.test(gate)&&profile.owner.level>=Number(gate)||/^s[1-9]$/.test(gate)&&profile.maxLevel>=Number(gate.slice(1));
  if(!active||!Array.isArray(values))continue;
  for(const value of values){
   if(!value||typeof value!=='object'||Object.keys(value).some(k=>k!=='all')||typeof value.all!=='string')continue;
   const parts=value.all.split('|').map((part:string)=>part.split('=')),classes:string[]=[];
   if(!parts.every(([name,text,...extra]:string[])=>{
    if(extra.length||!text)return false;
    if(name==='class'){classes.push(...text.split(';').map(key).filter(Boolean));return classes.length>0;}
    if(name==='level')return text.split(';').every(n=>/^[0-9]$/.test(n))&&text.split(';').includes(String(entry.raw.level));
    return false;
   }))continue;
   names.push(...classes);
  }
 }
 return names;
}

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
 const raw=entry.raw,names=[profile.owner.entry.name,profile.owner.entry.english,profile.owner.entry.raw.name,profile.owner.entry.raw.ENG_name,profile.owner.entry.raw._castingSource?.name,profile.owner.entry.raw._castingSource?.english,...expandedSpellClasses(entry,profile)].map(key).filter(Boolean);
 const source=key(profile.owner.entry.raw._castingSource?.source||profile.owner.entry.source),lookup=raw._spellClasses;
 // Expansion books often predate the 2024 lookup. Their class list remains usable
 // with either PHB class, while the spell's own source-qualified identity stays intact.
 const expansion=!['phb','xphb','dmg','xdmg'].includes(key(entry.source));
 const sameClassSource=(book:unknown)=>key(book)===source||expansion&&['phb','xphb'].includes(source)&&['phb','xphb'].includes(key(book));
 if(lookup&&typeof lookup==='object')for(const [book,classes] of Object.entries(lookup))if(sameClassSource(book)&&classes&&typeof classes==='object'&&Object.keys(classes).some(name=>names.includes(key(name))))return true;
 return [...(raw.classes?.fromClassList||[]),...(raw.classes?.fromClassListVariant||[])].some(row=>sameClassSource(row.source||'PHB')&&[row.name,row.ENG_name].some(name=>names.includes(key(name))));
}

/** Only the reviewed TCE optional domain is consent-sensitive. Preserve the
 * existing base/other-source decoder rather than classifying all variants. */
export function spellOnCurrentClassList(c:Character,entry:Entry,profile:CasterProfile):boolean{
 const decision=optionalClassSpellListDecision(c,entry,profile.owner.id);return decision.scoped?decision.baseOverlap||decision.allowed:spellOnClassList(entry,profile);
}

/** Full-list access is a read-only projection. Only an actually prepared spell is stored on the card. */
export function availableClassSpells(c:Character,entries:Entry[]):Entry[]{
 const profiles=casterProfiles(c);
 return entries.filter(e=>e.kind==='spell'&&selectionAllowed(c,e)&&profiles.some(p=>spellOnCurrentClassList(c,e,p)&&(Number(e.raw.level)===0?fullCantripList(p):Number(e.raw.level)>0&&p.mode==='prepared'&&p.pool==='list'&&Number(e.raw.level)<=p.maxLevel)));
}

/** Capabilities come from the source's casting model, never its translated name. */
export function cantripCapacity(p:CasterProfile,c?:Character):number{
 let bonus=0;
 if(c&&automationEnabled(c))for(const row of c.selections){
  if(row.entry.kind!=='feature'||!selectionAllowed(c,row.entry))continue;
  let owner=featureOwner(c,row);const owners=new Set<string>();
  while(owner&&owner.entry.kind!=='class'){if(owners.has(owner.id)){owner=undefined;break;}owners.add(owner.id);owner=featureOwner(c,owner);}
  if(owner?.id!==p.owner.id)continue;
  let active=true,current=row;const seen=new Set<string>();
  while(current.parentId){if(seen.has(current.id)){active=false;break;}seen.add(current.id);const parent=c.selections.find(s=>s.id===current.parentId);if(!parent||!selectionAllowed(c,parent.entry)){active=false;break;}current=parent;}
  if(!active)continue;
  const declared=row.entry.raw.cantripBonus;
  if(Number.isSafeInteger(declared)&&declared>=0&&declared<=100){bonus+=declared;continue;}
  // Narrow prose adapter: an explicit extra-cantrip count AND a source class
  // filter in the same clause. Ignore unchosen option branches entirely.
  const walk=(v:unknown):string[]=>typeof v==='string'?[v]:Array.isArray(v)?v.flatMap(walk):v&&typeof v==='object'?(v as any).type==='options'?[]:walk((v as any).entries):[];
  for(const text of walk(row.entry.entries))for(const clause of text.split(/[。.!！]/)){
   const filter=clause.match(/\{@filter [^|}]+\|spells\|class=([^|}]+)/);
   if(!filter||![p.owner.entry.name,p.owner.entry.english,p.owner.entry.raw.name,p.owner.entry.raw.ENG_name].map(key).includes(key(filter[1])))continue;
   const n=clause.match(/额外学会([一二三四五六七八九十\d]+)(?:道|个)戏法|学会([一二三四五六七八九十\d]+)个额外的.*戏法/);
   if(n){const value=n[1]||n[2],amount=Number(value)||({'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10} as Record<string,number>)[value];if(amount>0&&amount<=100)bonus+=amount;}
  }
 }
 return Math.max(0,Math.min(100,(Number(p.casting.entry.raw.cantripProgression?.[p.owner.level-1]??p.owner.entry.raw.cantripProgression?.[p.owner.level-1])||0)+bonus));
}
export const fullCantripList=(p:CasterProfile):boolean=>cantripCapacity(p)>0&&(p.pool==='book'||p.casting.entry.raw.casterProgression==='artificer'||p.casting.entry.raw.cantripChange==='restLong');
export const hasKnownLibrary=(p:CasterProfile):boolean=>p.pool==='book'||p.mode==='prepared'&&cantripCapacity(p)>0;

export function spellUsesPreparation(c:Character,entry:Entry,selectionId?:string,ownerId?:string):boolean{
 if(selectionId&&c.spellSettings?.special?.[selectionId])return false;
 if(Number(entry.raw.level)===0&&(casterProfiles(c).length>0||c.spellSettings?.cantrips?.manual?.some(Boolean)))return false;
 if(c.spellSettings?.modeOverride)return c.spellSettings.mode==='prepared';
 const profiles=casterProfiles(c),matching=profiles.filter(p=>spellOnCurrentClassList(c,entry,p));
 if(ownerId){const profile=matching.find(row=>row.owner.id===ownerId);return profile?.mode==='prepared';}
 return matching.length?matching.some(p=>p.mode==='prepared'):(inferredSpellMode(c)??c.spellSettings?.mode??'prepared')==='prepared';
}
