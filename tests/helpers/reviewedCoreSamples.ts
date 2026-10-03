import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {Entry} from '../../src/core/model';
import type {Mechanics} from '../../src/data/automation/protocol';
import {irFixture} from './irFixture';

/** Main-reviewed G5 regression samples, deliberately excluded from production
 * overlays and coverage. Source text stays in the separate locked corpus. */
export const reviewedSampleInputs={
 fighter:'da2d63f3d4eb692db32f22b081dafecbc08394f27fbaeff7a51503824aefd1e0',
 wizard:'0fb00f638eef1f95948c1c035058afc67c10baf982255aebfc159830b635457a',
 cleric:'949c918679e385384a4979398219165807332ff6ca400f39a87c6fe1779bc65a',
} as const;
export function readReviewedClass(path:string){
 const bytes=readFileSync(path),name=/class-(fighter|wizard|cleric)\.json$/.exec(path)?.[1] as keyof typeof reviewedSampleInputs|undefined;
 if(name&&createHash('sha256').update(bytes).digest('hex')!==reviewedSampleInputs[name])throw Error(`Review the changed ${name} sample before running its regression`);
 return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
}
export function reviewedStartingItems(data:Record<string,any>,directory:string){
 const refs=new Set<string>();
 const walk=(value:any):void=>{if(typeof value==='string'&&value.includes('|'))refs.add(value.toLowerCase());else if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object'){if(typeof value.item==='string')refs.add(value.item.toLowerCase());else Object.values(value).forEach(walk);}};
 for(const row of data.class||[])walk(row.startingEquipment?.defaultData);
 const load=(file:string)=>JSON.parse(readFileSync(`${directory}/${file}`,'utf8').replace(/^\uFEFF/,''));
 const select=(rows:any[])=>rows.filter(row=>[row.name,row.ENG_name].some(name=>typeof name==='string'&&refs.has(`${name}|${row.source}`.toLowerCase())));
 return {...data,baseitem:select(load('data_items-base.json').baseitem||[]),item:select(load('data_items.json').item||[])};
}
function sample(entry:Entry):Mechanics|undefined{
 const identity=entry.automation?.identity,source=entry.source;
 // G3's reviewed, SHA-bound publisher typo: Cleric package A has 7 GP, not
 // 70 GP. The test view retains the publisher snapshot and corrects only IR.
 if(entry.kind==='class'&&entry.english==='Cleric'&&source==='XPHB'&&entry.automation?.mechanics?.startingEquipment){const equipment=structuredClone(entry.automation.mechanics.startingEquipment);for(const block of equipment.blocks)for(const option of block.options)if(option.key==='A')for(const item of option.items)if(item.copper===7000)item.copper=700;return {startingEquipment:equipment};}
 if(entry.kind!=='feature'||!['PHB','XPHB'].includes(source)||entry.raw.classSource!==source)return;
 if(identity?.classEngName==='Fighter'&&entry.english==='Second Wind')return {resources:[{key:'resource:0',max:{value:source==='PHB'?1:2},formula:'1d10 + @class.level',recovery:[{period:'short',amount:source==='PHB'?'all':1},{period:'long',amount:'all'}],...(source==='XPHB'?{scaling:[{level:4,max:{value:3}},{level:10,max:{value:4}}]}:{})}]};
 if(identity?.classEngName==='Wizard'&&(source==='PHB'&&entry.english==='Spellcasting'||source==='XPHB'&&entry.english==='Ritual Adept'))return {classModel:{ritualAccess:'book'}};
 if(identity?.classEngName==='Cleric'&&source==='XPHB'&&entry.english==='Thaumaturge')return {modifiers:[{target:'cantrips',op:'add',value:1},{target:'skill:arcana',op:'add',formula:'max(1,@abilities.wis.mod)'},{target:'skill:religion',op:'add',formula:'max(1,@abilities.wis.mod)'}]};
}
export function reviewCoreSamples(entries:Entry[]):Entry[]{return entries.map(entry=>{
 const reviewed=sample(entry);if(!reviewed)return entry;
 const result=irFixture(entry,{...entry.automation?.mechanics,...reviewed},entries);
 result.automation!.provenance.push({layer:'overlay',ref:'G5-main-reviewed-regression-sample/2026-10-03',reviewer:'Sol (main)',reviewedAt:'2026-10-03'});
 result.automation!.evidence={page:entry.kind==='class'?68:Number(entry.raw.page)};
 return result;
});}
