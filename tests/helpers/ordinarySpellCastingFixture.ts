import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hydrateSpellLookup} from '../../src/data/spellLookup';
import {normalizeCatalogData} from '../../src/data/catalog';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {syncFeatures} from '../../src/core/sheet';
import {syncAutoResources} from '../../src/core/resources';
import {prepareSpellEntry} from '../../src/core/spells';
import {learnActiveSpell,chooseCantrip} from '../../src/core/spellWorkspace';
export const ordinarySourceDirectory=process.env.ORDINARY_CASTING_FROZEN_DIR||process.env.REVIEWED_FEATS_FROZEN_DIR;
export const ordinarySnapshot=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const ordinaryInputPins={
 'class/class-wizard.json':'7533f3fb7bab70cd2d2f2b5dfb7e259dc66a2bfee24ee6ad3809042e53ba8a03',
 'class/class-sorcerer.json':'cc1c7c87b28903114e98310b00f6c820541a6f3458bd67e6badb79b014e4c670',
 'class/class-warlock.json':'34721a04db792923cf0a19fbab3f90616093d9f6519a7cfe6f81a9eb52e775d4',
 'spells/spells-phb.json':'e1f2221020cfb5d31995c99b78dc09435c9962476ef1cef81b52399e6df0263d',
 'spells/spells-xphb.json':'87e4b76595ea895e01641de2cba3d75bff590957f08a9210530c28ffa296770d',
 'generated/gendata-spell-source-lookup.json':'8b78d1ce68d080a760b41bc65e846755c98fa1a3916b70d3d5d0dc8f5af1b9a9'
} as const;
export function ordinaryFrozenInput(path:keyof typeof ordinaryInputPins){if(!ordinarySourceDirectory)throw Error('ORDINARY_CASTING_FROZEN_DIR is required for actual-source proof');const index=JSON.parse(readFileSync(`${ordinarySourceDirectory}/index.json`,'utf8')),rows=index.rows.filter((r:any)=>r.url===`https://5e.kiwee.top/data/${path}`);if(rows.length!==1||rows[0].sha256!==ordinaryInputPins[path])throw Error('Exact frozen input required: '+path);const body=JSON.parse(readFileSync(`${ordinarySourceDirectory}/${rows[0].path}`,'utf8'));if(ordinarySnapshot(body)!==ordinaryInputPins[path])throw Error('Frozen hash mismatch: '+path);return body;}
export function ordinarySpellFixture(options:{caster?:'Wizard'|'Sorcerer'|'Warlock';level?:number;spell?:string;cantrip?:boolean;edition?:'2014'|'2024'}={}){
 const caster=options.caster||'Wizard',edition=options.edition||'2014',source=edition==='2014'?'PHB':'XPHB';
 const inputs=['class/class-wizard.json','class/class-sorcerer.json','class/class-warlock.json'] as const;
 const merged:Record<string,any[]>={};for(const path of inputs)for(const [key,rows] of Object.entries(ordinaryFrozenInput(path)))if(Array.isArray(rows))(merged[key]||=[]).push(...rows);
 const lookup=ordinaryFrozenInput('generated/gendata-spell-source-lookup.json');
 const entries=normalizeCatalogData({...merged,spell:ordinaryFrozenInput(edition==='2014'?'spells/spells-phb.json':'spells/spells-xphb.json').spell},'fresh-ordinary-real').map(entry=>hydrateSpellLookup(entry,lookup,'fresh'));
 const find=(kind:Entry['kind'],english:string,book=source)=>{const matches=entries.filter(e=>e.kind===kind&&e.english===english&&e.source===book);if(matches.length!==1)throw Error('Unique real entry required: '+kind+'/'+english+'/'+book);return matches[0];};
 const c=newCharacter(edition);c.automation=newAutomationState();c.profile.enabledSources=[source];c.abilities.int=c.abilities.cha=16;c.baseHp=20;c.runtime.hp=7;c.notes='authored manual sentinel';c.runtime.resources.manual={name:'authored spent counter',max:7,current:2,locked:true};
 const owner={id:'ordinary-owner',entry:find('class',caster),level:options.level||3,quantity:1,equipped:false};c.selections.push(owner);syncFeatures(c,entries);syncAutoResources(c);
 const entry=find('spell',options.spell||(options.cantrip?'Fire Bolt':caster==='Warlock'?'Armor of Agathys':'Magic Missile'));
 let id:string|undefined;if(options.cantrip){const result=chooseCantrip(c,entry,owner.id);if(result.error)throw Error(result.error);id=result.id;}else if(caster==='Wizard')id=prepareSpellEntry(c,entry,undefined,owner.id);else {const result=learnActiveSpell(c,entry,owner.id);if(result.error)throw Error(result.error);id=result.id;}
 if(!id)throw Error('Real acquisition failed');const row=c.selections.find(s=>s.id===id)!;return {c,entries,entry,row,owner,find};
}
