import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import {hydrateSpellLookup} from '../../src/data/spellLookup';
import {newCharacter,type Entry} from '../../src/core/model';
import evidence from '../../src/core/automation/ordinarySpellCastingEvidence.json';
import {newAutomationState} from '../../src/core/automation/state';
export const limitedSourceDirectory=process.env.LIMITED_SOURCE_FROZEN_DIR||process.env.ORDINARY_CASTING_FROZEN_DIR||process.env.REVIEWED_FEATS_FROZEN_DIR;
export const limitedSnapshot=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function limitedSourceInput(path:string,sha256?:string){if(!limitedSourceDirectory)throw Error('LIMITED_SOURCE_FROZEN_DIR required');const index=JSON.parse(readFileSync(`${limitedSourceDirectory}/index.json`,'utf8')),rows=index.rows.filter((row:any)=>row.url===`https://5e.kiwee.top/data/${path}`);if(rows.length!==1||sha256&&rows[0].sha256!==sha256)throw Error('Exact source input required');const body=JSON.parse(readFileSync(`${limitedSourceDirectory}/${rows[0].path}`,'utf8'));if(limitedSnapshot(body)!==rows[0].sha256)throw Error('Source input mismatch');return body;}
let cached:Entry[]|undefined;
export function limitedSourceEntries():Entry[]{if(cached)return structuredClone(cached);const lookup=limitedSourceInput('generated/gendata-spell-source-lookup.json','8b78d1ce68d080a760b41bc65e846755c98fa1a3916b70d3d5d0dc8f5af1b9a9');const paths=['rewards.json','spells/spells-phb.json','spells/spells-xphb.json','spells/spells-aag.json'];cached=paths.flatMap(path=>{const pin=evidence.inputs.find(row=>row.url===`https://5e.kiwee.top/data/${path}`);if(!pin)throw Error('Pinned source required');return normalizeCatalogData(limitedSourceInput(path,pin.sha256),'limited-real');}).map(entry=>hydrateSpellLookup(entry,lookup,'limited-real'));return structuredClone(cached);}
export function limitedSourceFixture(english='Charm of Animal Conjuring',source='DMG',edition?:'2014'|'2024'){
 const entries=limitedSourceEntries(),matches=entries.filter(entry=>entry.kind==='feature'&&entry.english===english&&entry.source===source);if(matches.length!==1)throw Error('Unique exact real reward required');const entry=matches[0],c=newCharacter(edition||(source==='XDMG'?'2024':'2014'));c.automation=newAutomationState();c.profile.enabledSources=[source,c.edition==='2014'?'PHB':'XPHB','AAG'];c.notes='Authored finite-use sentinel';c.runtime.hp=7;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:2,locked:true};const owner={id:'limited-owned-reward',entry,level:1,quantity:1,equipped:false};c.selections.push(owner);return {c,entry,owner,entries};
}
