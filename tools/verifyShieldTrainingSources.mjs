import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {isDeepStrictEqual} from 'node:util';

// Validate only two existing public inputs. No retries, alternate sources,
// redirects, corpus downloads, or fixture fallback on failed verification.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {values}=parseArgs({options:{directory:{type:'string'},'verify-only':{type:'boolean'}}});
const directory=resolve(values.directory||resolve(root,'.local-evidence/shield-training/upstream'));
const fixture=JSON.parse(readFileSync(resolve(root,'tests/fixtures/shield-training-sources.json')));
const out=resolve(root,'.local-evidence/shield-training/source-verification.json');
rmSync(out,{force:true});
mkdirSync(directory,{recursive:true});
const receipt={schemaVersion:1,verifiedAt:new Date().toISOString(),dataRevision:fixture.dataRevision,inputs:[]};
for(const [index,input] of fixture.inputs.entries()){
 const url=new URL(input.url),file=resolve(directory,basename(url.pathname));
 if(url.protocol!=='https:'||url.hostname!=='5e.kiwee.top'||!['/data/class/class-fighter.json','/data/items-base.json'].includes(url.pathname))throw Error('Unexpected input URL');
 if(!values['verify-only'])execFileSync('curl',['--disable','--fail','--silent','--show-error','--proto','=https','--max-time','30','--max-filesize',String(input.bytes),'--output',file,input.url],{stdio:['ignore','ignore','pipe']});
 const bytes=readFileSync(file),sha256=createHash('sha256').update(bytes).digest('hex');
 if(bytes.length!==input.bytes||sha256!==input.sha256)throw Error(`Locked input mismatch: ${url.pathname}`);
 const body=JSON.parse(bytes),category=index===0?'class':'baseitem';
 for(const expected of fixture.projection[category]){
  const matches=body[category].filter(row=>row.source===expected.source&&row.ENG_name===expected.ENG_name);
  if(matches.length!==1)throw Error(`Ambiguous input identity: ${category}/${expected.source}`);
  const raw=matches[0],actual=index===0?{
   name:raw.name,ENG_name:raw.ENG_name,source:raw.source,edition:raw.edition,hd:raw.hd,proficiency:raw.proficiency,
   startingProficiencies:{armor:raw.startingProficiencies?.armor},
   multiclassing:{proficienciesGained:{armor:raw.multiclassing?.proficienciesGained?.armor}},entries:[],
  }:{name:raw.name,ENG_name:raw.ENG_name,source:raw.source,edition:raw.edition,type:raw.type,ac:raw.ac,page:raw.page};
  if(!isDeepStrictEqual(actual,expected))throw Error(`Mechanical projection mismatch: ${category}/${expected.source}`);
 }
 receipt.inputs.push({url:input.url,bytes:bytes.length,sha256,identities:fixture.projection[category].length});
}
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
