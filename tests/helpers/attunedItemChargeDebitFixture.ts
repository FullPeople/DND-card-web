import {normalizeCatalogData} from '../../src/data/catalog';
import {homebrewBody} from '../../src/data/homebrew';
import {newCharacter,type Entry,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {itemChargeInput} from './itemChargeDebitFixture';
import evidence from '../../src/core/automation/attunedItemChargeDebitEvidence.json';
export {itemChargeSnapshot as attunedItemChargeSnapshot} from './itemChargeDebitFixture';
let cached:Entry[]|undefined;
export function attunedItemChargeEntries(){if(!cached){const sources=[...new Map(evidence.rules.map(r=>[r.input.url,{...r.input,packId:r.packId}])).values()];cached=sources.flatMap(pin=>normalizeCatalogData(pin.packId==='kiwee-homebrew'?homebrewBody(itemChargeInput(pin.url,pin.sha256)):itemChargeInput(pin.url,pin.sha256),pin.sha256,pin.packId));}return cached;}
export function attunedItemChargeFixtureForId(id:string){const entries=attunedItemChargeEntries(),matches=entries.filter(e=>e.id===id);if(matches.length!==1)throw Error('Unique exact physical source item required');const entry=structuredClone(matches[0]),rule=evidence.rules.find(r=>r.id===id),c=newCharacter((rule?.action?.requiredCardEdition||entry.edition)==='2024'?'2024':'2014');c.automation=newAutomationState();c.profile.enabledSources=[...new Set([entry.source,...(entry.dependencies||[]),...(rule?.action?.requiredSources||[])])];c.notes='Authored attuned item charge sentinel';c.runtime.hp=7;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:2,locked:true};const owner:Selection={id:'physical-attuned-owned-item',entry,level:1,quantity:1,equipped:false,attuned:false};c.selections.push(owner);return {c,entry,owner,entries};}
export function attunedItemChargeFixture(english='Wand of Enemy Detection',source='DMG'){const matches=evidence.rules.filter(r=>r.english===english&&r.source===source);if(matches.length!==1)throw Error('Unique reviewed source identity required');return attunedItemChargeFixtureForId(matches[0].id);}
