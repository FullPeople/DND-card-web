import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewedObservantData} from '../e2e/reviewedObservantFixture';
export const observantSourceDirectory=process.env.REVIEWED_FEATS_FROZEN_DIR;
export const observantSourceAvailable=!!observantSourceDirectory;
if(!observantSourceAvailable&&process.env.REVIEWED_OBSERVANT_FROZEN_REQUIRED==='1')throw Error('Required Observant frozen source directory is unavailable');
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const textDigest=(value:string)=>createHash('sha256').update(value).digest('hex');
let verified:any;
/** Private test materialization only. Neither full input nor publisher prose is
 * written into Git or public artifacts, and authored prose never qualifies as either edition. */
export function reviewedObservantSourceData(){
 if(!observantSourceDirectory)throw Error('Observant tests require REVIEWED_FEATS_FROZEN_DIR; there is no authored qualifying fallback.');
 if(!verified){
  const index=JSON.parse(readFileSync(`${observantSourceDirectory}/index.json`,'utf8')),rows=index.rows.filter((row:any)=>row.url.endsWith('/data/feats.json'));
  if(rows.length!==1||rows[0].sha256!=='0491b421f5f1db6628c3a8aeb86bbc3b72b56bf101a14ba96acbe19c829a56a6')throw Error('Observant frozen feat source index mismatch');
  const body=JSON.parse(readFileSync(`${observantSourceDirectory}/${rows[0].path}`,'utf8'));
  if(digest(body)!=='0491b421f5f1db6628c3a8aeb86bbc3b72b56bf101a14ba96acbe19c829a56a6')throw Error('Observant frozen feat input hash mismatch');
  const candidates=body.feat.filter((row:any)=>row.ENG_name==='Observant'&&row.source==='PHB');
  if(candidates.length!==1||digest(candidates[0])!=='dc6366743eb9242179fa25e00124d79e7e281c966242ac3beac52a9b9c905e8b')throw Error('Exact PHB Observant raw source hash mismatch');
  const items=candidates[0].entries?.[1]?.items;
  if(!Array.isArray(items)||items.length!==2||items.some(row=>typeof row!=='string')||textDigest(items[0])!=='3dafc45f7a4cfe5101dfb90eca3ad9211ee49330363df8ffe9ada38b1e7bc240'||textDigest(items[1])!=='e698e33cae17248724563b933c5fc9425c009996a73c2a6a7de206b0a9c5b983')throw Error('Exact PHB Observant lip-reading/passive source clauses mismatch');
  const modern=body.feat.filter((row:any)=>row.ENG_name==='Observant'&&row.source==='XPHB');
  if(modern.length!==1||digest(modern[0])!=='7008f8c724a3a19a2aa276bff3e19c354ff218f461934dfd66dcebd0125b5855')throw Error('Exact XPHB Observant compatibility source hash mismatch');
  verified={PHB:candidates[0],XPHB:modern[0]};
 }
 const authored=structuredClone(reviewedObservantData);
 return {...authored,feat:authored.feat.map(row=>row.ENG_name==='Observant'&&['PHB','XPHB'].includes(row.source)?structuredClone(verified[row.source]):row)};
}
