import {normalizeCatalogData} from '../../src/data/catalog';
import {homebrewBody} from '../../src/data/homebrew';
import {newCharacter,type Entry,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import baseline from '../../src/core/automation/itemChargeDebitEvidence.json';
import attuned from '../../src/core/automation/attunedItemChargeDebitEvidence.json';
import ordinary from '../../src/core/automation/ordinarySpellCastingEvidence.json';
import {itemChargeInput} from './itemChargeDebitFixture';
export const itemChargeAllSourceRules=[...baseline.rules,...attuned.rules];
export const itemChargeEquipmentPins=['items-base.json','items.json','magicvariants.json'].map(path=>{const pin=ordinary.inputs.find(row=>row.url===`https://5e.kiwee.top/data/${path}`);if(!pin)throw Error('Exact original equipment pin required');return pin;});
let cached:Entry[]|undefined;
/** Pure counterpart of actual source batches plus the final two equipment
 * normalization operations. No loadCatalog, fetch, HTTP or player raw repair. */
export function itemChargeMergedEntries(){if(!cached){const entries=new Map<string,Entry>(),sources=[...new Map(itemChargeAllSourceRules.map(rule=>[rule.input.url,{...rule.input,packId:rule.packId}])).values()],bodies=new Map<string,any>();const body=(pin:{url:string;sha256:string})=>{if(!bodies.has(pin.url))bodies.set(pin.url,itemChargeInput(pin.url,pin.sha256));return bodies.get(pin.url);};for(const pin of sources)for(const entry of normalizeCatalogData(pin.packId==='kiwee-homebrew'?homebrewBody(body(pin)):body(pin),pin.sha256,pin.packId))entries.set(entry.id,entry);const equipment=Object.assign({},...itemChargeEquipmentPins.map(body)),revision=itemChargeEquipmentPins.map(pin=>pin.sha256).join('|');for(const operation of ['normalize','magicItems'] as const)for(const entry of normalizeCatalogData(equipment,revision,'kiwee',operation))entries.set(entry.id,entry);cached=[...entries.values()];}return cached;}
export function itemChargeMergedFixtureForId(id:string){const rule=itemChargeAllSourceRules.find(row=>row.id===id),entries=itemChargeMergedEntries(),matches=entries.filter(e=>e.id===id);if(!rule||matches.length!==1)throw Error('Unique exact source-owned item required');const entry=structuredClone(matches[0]),c=newCharacter((rule.action?.requiredCardEdition||entry.edition)==='2024'?'2024':'2014');c.automation=newAutomationState();c.profile.enabledSources=[...new Set([entry.source,...(entry.dependencies||[]),...(rule.action?.requiredSources||[])])];c.notes='Authored merged item sentinel';c.runtime.hp=7;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:2,locked:true};const owner:Selection={id:'physical-merged-owned-item',entry,level:1,quantity:1,equipped:true,attuned:true};c.selections.push(owner);return {c,entry,owner,entries};}
