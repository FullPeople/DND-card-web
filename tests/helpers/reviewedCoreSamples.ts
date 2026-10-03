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
const reviewedEquipmentInputs:Record<string,string>={'data_items-base.json':'9f1346c69344d66088dbdb1c26ea5872102d318ac148805a8ae9b5fedc5fc94f','data_items.json':'3a4b176a3de1d6a02e8f35ca5c9171c99d174cbc22b7fce64b5ada98c982c1a3'};
export function readReviewedClass(path:string){
 const bytes=readFileSync(path),name=/class-(fighter|wizard|cleric)\.json$/.exec(path)?.[1] as keyof typeof reviewedSampleInputs|undefined;
 if(name&&createHash('sha256').update(bytes).digest('hex')!==reviewedSampleInputs[name])throw Error(`Review the changed ${name} sample before running its regression`);
 return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
}
export function reviewedStartingItems(data:Record<string,any>,directory:string){
 const refs=new Set<string>();
 const walk=(value:any):void=>{if(typeof value==='string'&&value.includes('|'))refs.add(value.toLowerCase());else if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object'){if(typeof value.item==='string')refs.add(value.item.toLowerCase());else Object.values(value).forEach(walk);}};
 for(const row of data.class||[])walk(row.startingEquipment?.defaultData);
 const load=(file:string)=>{const bytes=readFileSync(`${directory}/${file}`);if(createHash('sha256').update(bytes).digest('hex')!==reviewedEquipmentInputs[file])throw Error(`Review the changed equipment input ${file}`);return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));};
 const itemData=load('data_items.json'),groups=(itemData.itemGroup||[]).filter((row:any)=>[row.name,row.ENG_name].some(name=>typeof name==='string'&&refs.has(`${name}|${row.source}`.toLowerCase())));for(const group of groups)for(const ref of group.items||[])if(typeof ref==='string')refs.add(ref.toLowerCase());
 const select=(rows:any[])=>rows.filter(row=>[row.name,row.ENG_name].some(name=>typeof name==='string'&&refs.has(`${name}|${row.source}`.toLowerCase())));
 return {...data,baseitem:select(load('data_items-base.json').baseitem||[]),item:select(itemData.item||[]),itemGroup:groups};
}
function sample(entry:Entry,entries:Entry[]):Mechanics|undefined{
 const identity=entry.automation?.identity,source=entry.source;
 if(entry.english==='Defense'&&(source==='PHB'&&entry.raw._category==='optionalfeature'||source==='XPHB'&&entry.kind==='feat'))return {modifiers:[{target:'ac',op:'add',value:1,condition:{target:'unarmored',op:'eq',value:false}}]};
 // G3's reviewed, SHA-bound publisher typo: Cleric package A has 7 GP, not
 // 70 GP. The test view retains the publisher snapshot and corrects only IR.
 if(entry.kind==='class'&&entry.english==='Cleric'&&source==='XPHB'&&entry.automation?.mechanics?.startingEquipment){const equipment=structuredClone(entry.automation.mechanics.startingEquipment);for(const block of equipment.blocks)for(const option of block.options)if(option.key==='A')for(const item of option.items)if(item.copper===7000)item.copper=700;return {startingEquipment:equipment};}
 if(entry.kind!=='feature'||!['PHB','XPHB'].includes(source)||entry.raw.classSource!==source)return;
 if(identity?.classEngName==='Fighter'&&source==='XPHB'&&entry.english==='Fighting Style'){const from=entries.filter(candidate=>candidate.kind==='feat'&&candidate.source===source&&candidate.raw.category==='FS').map(candidate=>candidate.automation!.identity.key);if(from.length)return {grants:[{type:'feat',key:'reviewed-fighting-style',choose:{count:1,from}}]};}
 if(identity?.classEngName==='Fighter'&&entry.english==='Second Wind')return {resources:[{key:'resource:0',max:{value:source==='PHB'?1:2},formula:'1d10 + @class.level',recovery:[{period:'short',amount:source==='PHB'?'all':1},{period:'long',amount:'all'}],...(source==='XPHB'?{scaling:[{level:4,max:{value:3}},{level:10,max:{value:4}}]}:{})}]};
 if(identity?.classEngName==='Wizard'&&(source==='PHB'&&entry.english==='Spellcasting'||source==='XPHB'&&entry.english==='Ritual Adept'))return {classModel:{ritualAccess:'book'}};
 if(identity?.classEngName==='Cleric'&&source==='XPHB'&&entry.english==='Thaumaturge')return {modifiers:[{target:'cantrips',op:'add',value:1},{target:'skill:arcana',op:'add',formula:'max(1,@abilities.wis.mod)'},{target:'skill:religion',op:'add',formula:'max(1,@abilities.wis.mod)'}]};
}
export function reviewCoreSamples(entries:Entry[]):Entry[]{return entries.map(entry=>{
 const reviewed=sample(entry,entries);if(!reviewed)return entry;
 const result=irFixture(entry,{...entry.automation?.mechanics,...reviewed},entries);
 result.automation!.provenance.push({layer:'overlay',ref:'G5-main-reviewed-regression-sample/2026-10-03',reviewer:'Sol (main)',reviewedAt:'2026-10-03'});
 result.automation!.evidence={page:entry.kind==='class'?68:Number(entry.raw.page)};
 return result;
});}
