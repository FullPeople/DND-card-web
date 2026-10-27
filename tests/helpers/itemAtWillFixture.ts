import {normalizeCatalogData} from '../../src/data/catalog';
import {hydrateSpellLookup} from '../../src/data/spellLookup';
import {newCharacter,type Entry,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import ordinary from '../../src/core/automation/ordinarySpellCastingEvidence.json';
import {itemChargeInput,itemChargeSnapshot} from './itemChargeDebitFixture';
export const itemAtWillSnapshot=itemChargeSnapshot;
export const itemAtWillDirectory=process.env.ITEM_CHARGE_FROZEN_DIR||process.env.LIMITED_SOURCE_FROZEN_DIR||process.env.ORDINARY_CASTING_FROZEN_DIR;
let cached:Entry[]|undefined;
export function itemAtWillEntries(){if(!cached){const pin=(path:string)=>{const p=ordinary.inputs.find(r=>r.url===`https://5e.kiwee.top/data/${path}`);if(!p)throw Error('Exact original input required');return p;};const equipmentPins=['items-base.json','items.json','magicvariants.json'].map(pin),equipment=Object.assign({},...equipmentPins.map(p=>itemChargeInput(p.url,p.sha256))),revision=equipmentPins.map(p=>p.sha256).join('|'),items=new Map<string,Entry>();for(const operation of ['normalize','magicItems'] as const)for(const e of normalizeCatalogData(equipment,revision,'kiwee',operation))items.set(e.id,e);const lookupPin=pin('generated/gendata-spell-source-lookup.json'),lookup=itemChargeInput(lookupPin.url,lookupPin.sha256),spells=['spells/spells-phb.json','spells/spells-xphb.json'].flatMap(path=>{const spellPin=pin(path);return normalizeCatalogData(itemChargeInput(spellPin.url,spellPin.sha256),spellPin.sha256).map(e=>hydrateSpellLookup(e,lookup,lookupPin.sha256));});cached=[...items.values(),...spells];}return cached;}
export function itemAtWillFixture(english='Helm of Comprehending Languages',source='DMG'){
 const entries=itemAtWillEntries(),matches=entries.filter(e=>e.kind==='item'&&e.english===english&&e.source===source);if(matches.length!==1)throw Error('Unique actual item required');const entry=structuredClone(matches[0]),c=newCharacter(entry.edition==='2024'?'2024':'2014');c.automation=newAutomationState();c.profile.enabledSources=[entry.source,entry.edition==='2024'?'XPHB':'PHB',...(entry.dependencies||[])];c.notes='Authored at-will sentinel';c.runtime.hp=7;c.runtime.resources.manual={name:'Authored spent counter',max:7,current:2,locked:true};const owner:Selection={id:'owned-at-will-item',entry,level:1,quantity:1,equipped:true,attuned:true};c.selections.push(owner);return {c,entries,entry,owner};
}
