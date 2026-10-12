import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

// Disposable cards built from the verified public snapshot, never user documents.
export async function performanceCards(adapterPath:string,entries:any[],count:number,avatarData?:string,kind:'mixed'|'typical'|'large'='mixed'){
 if(!Number.isSafeInteger(count)||count<1||count>300)throw Error('Invalid bounded card scenario');
 const api=await import(pathToFileURL(resolve(adapterPath)).href);
 const classEntry=entries.find(e=>e.kind==='class'&&e.source==='XPHB'&&e.raw.casterProgression==='full');
 const race=entries.find(e=>e.kind==='race'&&e.source==='XPHB'),background=entries.find(e=>e.kind==='background'&&e.source==='XPHB');
 const spells=entries.filter(e=>e.kind==='spell'&&e.source==='XPHB'&&Number(e.raw.level)<=3).slice(0,100);
 if(!classEntry||!race||!background||spells.length<20)throw Error('The corpus does not contain the expected scenario ingredients');
 const prototypes=[api.newCharacter('2024')];
 for(const spellCount of [20,100]){
  const card=api.newCharacter('2024');card.automation=api.newAutomationState();card.profile.enabledSources=['PHB','XPHB'];
  for(const entry of [classEntry,race,background,...spells.slice(0,spellCount)])card.selections.push({id:randomUUID(),entry:structuredClone(entry),level:entry.kind==='class'?5:1,quantity:1,equipped:false});
  api.syncFeatures(card,entries);api.syncSourceSpells(card,entries);api.syncAutoResources(card);
  if(spellCount===100){card.notes='Disposable capacity test. '.repeat(1200);if(avatarData)card.portrait={data:avatarData,x:0,y:0,zoom:1};}
  prototypes.push(card);
 }
 const prototypeIndex=(index:number)=>kind==='typical'?1:kind==='large'?2:index%prototypes.length;
 const cards=Array.from({length:count},(_,i)=>({...structuredClone(prototypes[prototypeIndex(i)]),id:randomUUID(),name:`性能测试 ${i+1}`}));
 return {cards,summary:{count,kind,mixture:kind==='typical'?'level-5 caster with 20 spells':kind==='large'?'caster with up to 100 spells, 30k notes and a synthetic PNG avatar':'empty / level-5 caster with 20 spells / caster with up to 100 spells, 30k notes and a synthetic PNG avatar',prototypeSelectionCounts:prototypes.map(c=>c.selections.length),activePrototype:prototypeIndex(Math.min(1,count-1)),avatars:cards.filter(c=>c.portrait).length,avatarDataBytes:avatarData?Buffer.byteLength(avatarData):0,serializedBytes:Buffer.byteLength(JSON.stringify(cards))}};
}
