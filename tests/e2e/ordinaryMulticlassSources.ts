import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {readOrdinaryBrowserInputs} from './ordinaryCastingBrowserFixture';

export const multiclassBrowserPaths=['class/class-fighter.json','class/class-paladin.json','class/class-ranger.json'] as const;
const evidence:{inputs:{url:string;sha256:string}[]}=JSON.parse(readFileSync(new URL('../../src/core/automation/ordinarySpellCastingEvidence.json',import.meta.url),'utf8'));
export function readMulticlassBrowserInputs(){
 try{
  const bodies=readOrdinaryBrowserInputs(),root=process.env.ORDINARY_CASTING_FROZEN_DIR||process.env.REVIEWED_FEATS_FROZEN_DIR;
  if(!root)throw Error('Missing originals');const index=JSON.parse(readFileSync(`${root}/index.json`,'utf8'));
  for(const path of multiclassBrowserPaths){
   const url=`https://5e.kiwee.top/data/${path}`,pins=evidence.inputs.filter(p=>p.url===url),rows=index.rows.filter((r:any)=>r.url===url);
   if(pins.length!==1||rows.length!==1||rows[0].sha256!==pins[0].sha256)throw Error('Input identity mismatch');
   const body=JSON.parse(readFileSync(`${root}/${rows[0].path}`,'utf8'));
   if(createHash('sha256').update(JSON.stringify(body)).digest('hex')!==pins[0].sha256)throw Error('Input content mismatch');bodies[path]=body;
  }
  return bodies;
 }catch{throw Error('MULTICLASS_BROWSER_ORIGINAL_INPUTS_FAILED');}
}
export function verifyMulticlassResourceBinding(){
 const report=JSON.parse(readFileSync(new URL('../../docs/data/automation-runtime-coverage.json',import.meta.url),'utf8'));
 const rows=report.consumer.modules.filter((r:any)=>r.path==='src/core/resources.ts'),bytes=readFileSync(new URL('../../src/core/resources.ts',import.meta.url));
 if(rows.length!==1||createHash('sha256').update(bytes).digest('hex')!==rows[0].sha256)throw Error('MULTICLASS_BROWSER_RESOURCE_REPLAY_STALE');
 return {consumer:report.consumer.revision,resourcesSha256:rows[0].sha256};
}
