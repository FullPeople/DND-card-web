import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs,isDeepStrictEqual} from 'node:util';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {values}=parseArgs({options:{directory:{type:'string'},'verify-only':{type:'boolean'}}});
const directory=resolve(values.directory||resolve(root,'.local-evidence/warforged/upstream'));
const fixture=JSON.parse(readFileSync(resolve(root,'tests/fixtures/warforged-tool-sources.json'))),out=resolve(root,'.local-evidence/warforged/source-verification.json');
rmSync(out,{force:true});mkdirSync(directory,{recursive:true});
const receipt={verifiedAt:new Date().toISOString(),dataRevision:fixture.dataRevision,inputs:[]};
const fields=new Set(['name','ENG_name','source','edition','skillProficiencies','toolProficiencies','type','entries']);
for(const [index,input] of fixture.inputs.entries()){
 const url=new URL(input.url),file=resolve(directory,basename(url.pathname));
 if(url.protocol!=='https:'||url.hostname!=='5e.kiwee.top'||!['/data/races.json','/data/items-base.json'].includes(url.pathname))throw Error('Unexpected input URL');
 // Fixed existing inputs; no redirects, mirrors, retries or fixture fallback.
 if(!values['verify-only'])execFileSync('curl',['--disable','--fail','--silent','--show-error','--proto','=https','--max-time','30','--max-filesize',String(input.bytes),'--output',file,input.url],{stdio:['ignore','ignore','pipe']});
 const bytes=readFileSync(file),sha256=createHash('sha256').update(bytes).digest('hex');
 if(bytes.length!==input.bytes||sha256!==input.sha256)throw Error(`Locked input mismatch: ${url.pathname}`);
 const body=JSON.parse(bytes),category=index===0?'race':'baseitem';
 for(const expected of fixture.projection[category]){
  if(Object.keys(expected).some(key=>!fields.has(key))||expected.entries&&expected.entries.length)throw Error('Unexpected projection fields');
  const rows=body[category].filter(row=>row.source===expected.source&&row.ENG_name===expected.ENG_name);if(rows.length!==1)throw Error(`Ambiguous identity: ${category}/${expected.source}`);
  const actual=Object.fromEntries(Object.keys(expected).map(key=>[key,key==='entries'?[]:rows[0][key]]));
  if(!isDeepStrictEqual(actual,expected))throw Error(`Mechanical projection mismatch: ${category}/${expected.source}`);
 }
 receipt.inputs.push({url:input.url,bytes:bytes.length,sha256,identities:fixture.projection[category].length});
}
writeFileSync(out,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
