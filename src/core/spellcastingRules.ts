import {ownedSpellLevel,irMechanics,irParentClass,irSelectionActive,irModifierValue,applyIrNumber} from './automation/ir';
import {selectionAllowed,type Character,type Entry,type Selection} from './model';
import {parentClass,featureOwner} from './featureOwnership';
import {automationEnabled} from './automation/state';

export type CasterProfile={owner:Selection;casting:Selection;mode:'known'|'prepared';pool:'learned'|'book'|'list';maxLevel:number};
const key=(value:unknown)=>String(value??'').trim().toLowerCase();

/** The source declares *when* preparation changes, not merely whether its table says Prepared. */
export function casterProfiles(c:Character):CasterProfile[]{
 if(!automationEnabled(c))return [];
 return c.selections.filter(s=>s.entry.kind==='class'&&selectionAllowed(c,s.entry)).flatMap(owner=>{
  const subclass=c.selections.find(s=>s.entry.kind==='subclass'&&irParentClass(c,s)?.id===owner.id&&selectionAllowed(c,s.entry));
  const casting=irMechanics(subclass?.entry||owner.entry)?.classModel?.casterProgression&&subclass?subclass:owner,model=irMechanics(casting.entry)?.classModel||{};
  if(!model.casterProgression&&!model.spellcastingAbility&&!model.preparedFormula&&!model.preparedProgression&&!model.knownProgression&&!model.spellSlots)return [];
  const hasPreparation=!!model.preparedFormula||Array.isArray(model.preparedProgression);
  const mode=model.preparedChange==='level'||(!hasPreparation&&!!model.knownProgression)?'known':'prepared';
  const pool=mode==='known'?'learned':model.bookProgression?'book':model.preparedChange==='restLong'?'list':'learned';
  const table=model.spellSlots?.[owner.level-1]||irMechanics(owner.entry)?.classModel?.spellSlots?.[owner.level-1];
  let maxLevel=0;
  if(table)maxLevel=table.reduce((max:number,n:number,i:number)=>n>0?i+1:max,0);
  else if(model.casterProgression==='full')maxLevel=Math.min(9,Math.ceil(owner.level/2));
  else if(['half','1/2','artificer'].includes(model.casterProgression||''))maxLevel=Math.min(5,Math.ceil(owner.level/4));
  else if(['third','1/3'].includes(model.casterProgression||''))maxLevel=owner.level<3?0:Math.min(4,Math.ceil(owner.level/6));
  else if(model.casterProgression==='pact')maxLevel=Math.min(5,Math.ceil(owner.level/2));
  return [{owner,casting,mode,pool,maxLevel}];
 });
}

export function inferredSpellMode(c:Character):'known'|'prepared'|undefined{
 const profiles=casterProfiles(c);return profiles.length?profiles.some(p=>p.mode==='prepared')?'prepared':'known':undefined;
}

/** Match the upstream class lookup by source and either language; never merge translated names. */
export function spellOnClassList(entry:Entry,profile:CasterProfile):boolean{
 const name=key(profile.owner.entry.automation?.identity.engName||profile.owner.entry.english),source=key(profile.owner.entry.source);
 const expansion=!['phb','xphb','dmg','xdmg'].includes(key(entry.source));
 const sameClassSource=(book:string)=>key(book)===source||expansion&&['phb','xphb'].includes(source)&&['phb','xphb'].includes(key(book));
 return (irMechanics(entry)?.spellModel?.classes||[]).some(clazz=>key(clazz.engName)===name&&sameClassSource(clazz.source));
}

/** Full-list access is a read-only projection. Only an actually prepared spell is stored on the card. */
export function availableClassSpells(c:Character,entries:Entry[]):Entry[]{
 const profiles=casterProfiles(c);
 return entries.filter(e=>e.kind==='spell'&&selectionAllowed(c,e)&&profiles.some(p=>spellOnClassList(e,p)&&((ownedSpellLevel(e)??-1)===0?fullCantripList(p):(ownedSpellLevel(e)??-1)>0&&p.mode==='prepared'&&p.pool==='list'&&(ownedSpellLevel(e)??-1)<=p.maxLevel)));
}

/** Capabilities come from the source's casting model, never its translated name. */
export function cantripCapacity(p:CasterProfile,c?:Character):number{
 let value=irMechanics(p.casting.entry)?.classModel?.cantripProgression?.[p.owner.level-1]??irMechanics(p.owner.entry)?.classModel?.cantripProgression?.[p.owner.level-1]??0;
 if(c&&automationEnabled(c))for(const row of c.selections)if(irSelectionActive(c,row)&&irParentClass(c,row)?.id===p.owner.id)for(const modifier of irMechanics(row.entry)?.modifiers||[])if(modifier.target==='cantrips')try{const amount=irModifierValue(c,row,modifier);if(typeof amount==='number')value=applyIrNumber(value,modifier,amount);}catch{}
 return Math.max(0,Math.min(100,value));
}
export const fullCantripList=(p:CasterProfile):boolean=>cantripCapacity(p)>0&&(p.pool==='book'||irMechanics(p.casting.entry)?.classModel?.casterProgression==='artificer'||irMechanics(p.casting.entry)?.classModel?.cantripChange==='restLong');
export const hasKnownLibrary=(p:CasterProfile):boolean=>p.pool==='book'||p.mode==='prepared'&&cantripCapacity(p)>0;

export function spellUsesPreparation(c:Character,entry:Entry,selectionId?:string):boolean{
 if(selectionId&&c.spellSettings?.special?.[selectionId])return false;
 if((ownedSpellLevel(entry)??-1)===0&&(casterProfiles(c).length>0||c.spellSettings?.cantrips?.manual?.some(Boolean)))return false;
 if(c.spellSettings?.modeOverride)return c.spellSettings.mode==='prepared';
 const profiles=casterProfiles(c),matching=profiles.filter(p=>spellOnClassList(entry,p));
 return matching.length?matching.some(p=>p.mode==='prepared'):(inferredSpellMode(c)??c.spellSettings?.mode??'prepared')==='prepared';
}
