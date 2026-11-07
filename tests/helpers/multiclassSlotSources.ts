import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import {hydrateSpellLookup} from '../../src/data/spellLookup';
import {ordinaryFrozenInput} from './ordinarySpellCastingFixture';
import type {Entry} from '../../src/core/model';

const pins={fighter:'a4c5afc0e7ec7a444d1418a04ab4fe392b9a7a25907ac0fb9b8618a79d1ee509',paladin:'aa125ed2f15782924cf4d48677e1ff64c934076bbc4f66fa65f21ba797007b2e',ranger:'a0e58735bc5f1ef9b260b88cf2c9778ffc0d367c0b132e72fadc95baf198310a',rogue:'b5c62a8c5356438a09bc64bc96b71968fa3766d46102a0a1de11713e5ee0d251'};
let cached:Entry[]|undefined;
export function multiclassSlotEntries():Entry[]{
 if(!cached){
  const root=process.env.ORDINARY_CASTING_FROZEN_DIR;if(!root)throw Error('Exact original class corpus required');
  const index=JSON.parse(readFileSync(`${root}/index.json`,'utf8')),bodies=[];
  for(const [name,sha] of Object.entries(pins)){
   const rows=index.rows.filter((r:any)=>r.url===`https://5e.kiwee.top/data/class/class-${name}.json`&&r.sha256===sha);
   if(rows.length!==1)throw Error('Unique original class input required');
   const bytes=readFileSync(`${root}/${rows[0].path}`);
   if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('Exact original class bytes required');
   bodies.push(JSON.parse(bytes.toString('utf8')));
  }
  bodies.push(ordinaryFrozenInput('class/class-wizard.json'),ordinaryFrozenInput('class/class-warlock.json'));
  const merged:Record<string,any[]>={};for(const body of bodies)for(const [key,rows] of Object.entries(body))if(Array.isArray(rows))(merged[key]||=[]).push(...rows);
  cached=normalizeCatalogData(merged,'actual-original-multiclass');
 }
 return structuredClone(cached);
}
export function multiclassSpellEntries(edition:'2014'|'2024'):Entry[]{
 const lookup=ordinaryFrozenInput('generated/gendata-spell-source-lookup.json');
 return normalizeCatalogData(ordinaryFrozenInput(edition==='2014'?'spells/spells-phb.json':'spells/spells-xphb.json'),'actual-multiclass-spells').map(entry=>hydrateSpellLookup(entry,lookup,'fresh'));
}
/** Keep every failing assertion, without attaching private source-bearing errors. */
export async function runMulticlassSourceCheck(index:number,run:()=>unknown):Promise<void>{
 if(!Number.isSafeInteger(index)||index<1)throw Error('MULTICLASS_SOURCE_INDEX_INVALID');
 try{await run();}catch{throw Error(`MULTICLASS_SOURCE_${String(index).padStart(3,'0')}_FAILED`);}
}
