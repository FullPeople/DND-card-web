import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import {homebrewBody} from '../../src/data/homebrew';
import {newCharacter,type Entry,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import evidence from '../../src/core/automation/racialDarkvisionEvidence.json';

export const racialDarkvisionDirectory=process.env.RACIAL_DARKVISION_FROZEN_DIR;
export const racialDarkvisionDigest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
let cached:Entry[]|undefined;
export function racialDarkvisionInput(url:string,sha256:string){
 if(!racialDarkvisionDirectory)throw Error('RACIAL_DARKVISION_FROZEN_DIR required');
 const index=JSON.parse(readFileSync(`${racialDarkvisionDirectory}/index.json`,'utf8'));
 const rows=index.rows.filter((r:any)=>r.url===url&&r.sha256===sha256);
 if(rows.length!==1)throw Error('Exact original racial input required');
 const body=JSON.parse(readFileSync(`${racialDarkvisionDirectory}/${rows[0].path}`,'utf8'));
 if(racialDarkvisionDigest(body)!==sha256)throw Error('Original racial source SHA mismatch');
 return body;
}
export function racialDarkvisionEntries():Entry[]{
 if(!cached)cached=evidence.inputs.flatMap(pin=>{
  const body=racialDarkvisionInput(pin.url,pin.sha256),brew=pin.url.includes('homebrew.kiwee');
  return normalizeCatalogData(brew?homebrewBody(body):body,pin.sha256,brew?'kiwee-homebrew':'kiwee');
 });
 return cached;
}
/** The actual App adds a complete normalized subrace/variant as one root race,
 * replacing an earlier race; no separate parent selection or guessed grants. */
export function racialDarkvisionFixture(id='kiwee:race:phb:dwarf::::::'){
 const entries=racialDarkvisionEntries(),matches=entries.filter(e=>e.id===id);
 if(matches.length!==1)throw Error('Exact unique playable racial entry required');
 const entry=structuredClone(matches[0]),rule=evidence.rules.find(r=>r.id===id);
 const c=newCharacter(entry.edition==='2024'?'2024':'2014');c.automation=newAutomationState();
 c.profile.enabledSources=[...new Set([entry.source,...(entry.dependencies||[]),...(rule?.requiredSources||[])])];
 c.notes='Authored manual vision note: 777 feet, not parsed as permission';
 c.runtime.hp=7;c.runtime.resources.manual={name:'Authored spent counter',max:7,current:2,locked:true};
 c.adjustments=[{id:'manual-ac',target:'ac',value:13,reason:'Authored manual total'}];
 c.sheetBonuses={ac:2,speed:3};c.skillBonuses={perception:4};c.saveBonuses={wis:5};
 const owner:Selection={id:'racial-owner',entry,quantity:1,level:1,equipped:false};c.selections.push(owner);
 return {c,entry,owner,entries};
}
