import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import {homebrewBody} from '../../src/data/homebrew';
import evidence from '../../src/core/automation/itemChargeDebitEvidence.json';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
export const itemChargeSourceDirectory=process.env.ITEM_CHARGE_FROZEN_DIR||process.env.LIMITED_SOURCE_FROZEN_DIR||process.env.ORDINARY_CASTING_FROZEN_DIR;
export const itemChargeSnapshot=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
let cached:Entry[]|undefined;
export function itemChargeInput(url:string,sha256:string){if(!itemChargeSourceDirectory)throw Error('ITEM_CHARGE_FROZEN_DIR required');const index=JSON.parse(readFileSync(`${itemChargeSourceDirectory}/index.json`,'utf8')),rows=index.rows.filter((r:any)=>r.url===url&&r.sha256===sha256);if(rows.length!==1)throw Error('Exact original source input required');const body=JSON.parse(readFileSync(`${itemChargeSourceDirectory}/${rows[0].path}`,'utf8'));if(itemChargeSnapshot(body)!==sha256)throw Error('Original source input hash mismatch');return body;}
export function itemChargeEntries(){if(!cached){const sources=[...new Map(evidence.rules.map(r=>[r.input.url,{...r.input,packId:r.packId}])).values()];cached=sources.flatMap(pin=>{const body=itemChargeInput(pin.url,pin.sha256);return normalizeCatalogData(pin.packId==='kiwee-homebrew'?homebrewBody(body):body,pin.sha256,pin.packId);});}return cached;}
export function itemChargeFixtureForId(id:string,edition?:'2014'|'2024'){
 const entries=itemChargeEntries(),matches=entries.filter(e=>e.id===id);if(matches.length!==1)throw Error('Unique exact physical source item required');const entry=structuredClone(matches[0]),rule=evidence.rules.find(r=>r.id===id),c=newCharacter(edition||((rule?.action?.requiredCardEdition||entry.edition)==='2024'?'2024':'2014'));c.automation=newAutomationState();c.profile.enabledSources=[...new Set([entry.source,...(entry.dependencies||[]),...(rule?.action?.requiredSources||[])])];c.notes='Authored item charge sentinel';c.runtime.hp=7;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:2,locked:true};const owner={id:'physical-owned-item',entry,level:1,quantity:1,equipped:false};c.selections.push(owner);return {c,entry,owner,entries};
}
export function itemChargeFixture(english='Earring of Message',source='CRCOTN',edition?:'2014'|'2024'){
 const matches=itemChargeEntries().filter(e=>e.kind==='item'&&e.english===english&&e.source===source);if(matches.length!==1)throw Error('Unique exact physical source item required');return itemChargeFixtureForId(matches[0].id,edition);
}
