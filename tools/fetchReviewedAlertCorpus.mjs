import {readFile,mkdir,writeFile,rename,unlink,realpath} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,relative,isAbsolute,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const INPUT_COUNT=229;
export const INPUT_SET_SHA256='c32dc7d8000a47bf3b5b6d00022f968e87d02bc3bcce54b4d7986ee5bc245d7e';
export const MAX_FILE_BYTES=8*1024*1024;
export const SOURCE_REVISIONS=Object.freeze({'tjliqy/5etools-cn':'5cc0bbe2c2b241a334e731af4448bdba2168e8bd','tjliqy/homebrew-deploy':'546b44d773394f71bffe598f0161338361c26f56'});
const MAPPING_FILE=new URL('./reviewedAlertCorpusSources.json',import.meta.url);
const SHA256=/^[a-f0-9]{64}$/,SHA1=/^[a-f0-9]{40}$/;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const fail=code=>{throw new Error(`REVIEWED_CORPUS_${code}`);};
const canonical=bytes=>{try{return Buffer.from(JSON.stringify(JSON.parse(bytes.toString('utf8'))));}catch{fail('JSON');}};
function originalUrl(value){
 if(typeof value!=='string')fail('SOURCE_URL');let url;try{url=new URL(value);}catch{fail('SOURCE_URL');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||!['5e.kiwee.top','homebrew.kiwee.top'].includes(url.hostname)||url.href!==value||!url.pathname.endsWith('.json'))fail('SOURCE_URL');
 let path;try{path=decodeURIComponent(url.pathname.slice(1));}catch{fail('SOURCE_PATH');}
 if(path.includes('\\')||path.split('/').some(part=>!part||part==='.'||part==='..')||url.hostname==='5e.kiwee.top'&&!path.startsWith('data/'))fail('SOURCE_PATH');return {url,path};
}
export function validateInputs(inputs){
 if(!Array.isArray(inputs)||inputs.length!==INPUT_COUNT||inputs.some(row=>!exactKeys(row,['url','sha256'])||!SHA256.test(row.sha256)))fail('INPUTS');
 if(new Set(inputs.map(row=>row.url)).size!==INPUT_COUNT)fail('DUPLICATE_INPUT');
 const hosts=inputs.map(row=>originalUrl(row.url).url.hostname);if(hosts.filter(host=>host==='5e.kiwee.top').length!==173||hosts.filter(host=>host==='homebrew.kiwee.top').length!==56)fail('SOURCE_COUNTS');
 const fingerprint=sha(JSON.stringify(inputs.map(({url,sha256})=>({url,sha256})).sort((a,b)=>a.url.localeCompare(b.url))));if(fingerprint!==INPUT_SET_SHA256)fail('INPUT_SET_HASH');return inputs;
}
export function readMapping(){return JSON.parse(readFileSync(MAPPING_FILE,'utf8'));}
export function validateMapping(mapping,inputs){
 validateInputs(inputs);if(!exactKeys(mapping,['schemaVersion','inputSetSha256','rows'])||mapping.schemaVersion!==1||mapping.inputSetSha256!==INPUT_SET_SHA256||!Array.isArray(mapping.rows)||mapping.rows.length!==INPUT_COUNT||new Set(mapping.rows.map(row=>row.url)).size!==INPUT_COUNT)fail('MAPPING');
 const expected=new Map(inputs.map(row=>[row.url,row.sha256]));
 for(const row of mapping.rows){
  if(!exactKeys(row,['url','sha256','repository','revision','path','gitBlobSha1','sourceBytes','retrievalUrl'])||expected.get(row.url)!==row.sha256||!SHA1.test(row.gitBlobSha1)||!Number.isSafeInteger(row.sourceBytes)||row.sourceBytes<1||row.sourceBytes>MAX_FILE_BYTES)fail('MAPPING_ROW');
  const {url,path}=originalUrl(row.url),repository=url.hostname==='5e.kiwee.top'?'tjliqy/5etools-cn':'tjliqy/homebrew-deploy';
  if(row.repository!==repository||row.revision!==SOURCE_REVISIONS[repository]||row.path!==path||row.retrievalUrl!==`https://raw.githubusercontent.com/${repository}/${row.revision}/${url.pathname.slice(1)}`)fail('MAPPING_SOURCE');
 }
 return mapping.rows;
}
function verifiedCanonical(bytes,expected){const body=canonical(bytes);if(sha(body)!==expected)fail('CANONICAL_HASH');return body;}
function abortable(promise,signal){return new Promise((resolve,reject)=>{const abort=()=>reject(new Error('REVIEWED_CORPUS_TIMEOUT'));if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});});}
/** Retrieved values are never repaired, normalized or transformed. Gitblob
 * validates the exact raw bytes; canonicalSHA validates JSON.parse/stringify. */
export async function fetchVerifiedBody(row,fetcher=fetch){
 const {url,path}=originalUrl(row.url),repository=url.hostname==='5e.kiwee.top'?'tjliqy/5etools-cn':'tjliqy/homebrew-deploy';
 if(row.repository!==repository||row.path!==path||row.revision!==SOURCE_REVISIONS[repository]||row.retrievalUrl!==`https://raw.githubusercontent.com/${repository}/${row.revision}/${url.pathname.slice(1)}`||!SHA1.test(row.gitBlobSha1)||!SHA256.test(row.sha256)||!Number.isSafeInteger(row.sourceBytes)||row.sourceBytes<1||row.sourceBytes>MAX_FILE_BYTES)fail('RETRIEVAL_METADATA');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60_000);let reader;
 try{
  const response=await abortable(fetcher(row.retrievalUrl,{redirect:'error',signal:controller.signal}),controller.signal);
  if(response.redirected||response.url&&response.url!==row.retrievalUrl)fail('REDIRECT');if(!response.ok)fail('HTTP_STATUS');
  const advertised=response.headers.get('content-length');if(advertised!==null&&(!/^\d+$/.test(advertised)||Number(advertised)>MAX_FILE_BYTES))fail('BODY_LIMIT');
  if(!response.body)fail('BODY_MISSING');reader=response.body.getReader();const chunks=[];let size=0;
  while(true){const part=await abortable(reader.read(),controller.signal);if(part.done)break;if(controller.signal.aborted)fail('TIMEOUT');size+=part.value.byteLength;if(size>MAX_FILE_BYTES||size>row.sourceBytes)fail('BODY_LIMIT');chunks.push(Buffer.from(part.value));}
  if(size!==row.sourceBytes)fail('RAW_SIZE');const bytes=Buffer.concat(chunks,size),gitBlob=createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');if(gitBlob!==row.gitBlobSha1)fail('RAW_BLOB');return verifiedCanonical(bytes,row.sha256);
 }catch(error){if(controller.signal.aborted)fail('TIMEOUT');if(error instanceof Error&&/^REVIEWED_CORPUS_[A-Z_]+$/.test(error.message))throw error;fail('FETCH');}
 finally{
  // Native transport must be stopped even when the body/size/hash failed.
  // Cancellation is best-effort: a hostile/stalled cancel promise must neither
  // extend the fixed deadline nor leak a rejected cleanup promise.
  controller.abort();clearTimeout(timer);try{Promise.resolve(reader?.cancel()).catch(()=>{});}catch{}
 }
}
/** Cache metadata and paths are untrusted. Only a matching original URL and
 * exact canonicalSHA may supply a body; a bad cache never changes the source. */
export async function readVerifiedCache(row,caches){
 for(const directory of caches){try{
  const root=await realpath(directory),index=JSON.parse(await readFile(join(root,'index.json'),'utf8'));
  if(!Array.isArray(index.rows))continue;const matches=index.rows.filter(entry=>entry?.url===row.url&&entry?.sha256===row.sha256);if(matches.length!==1)continue;
  const entry=matches[0];if(typeof entry.path!=='string'||isAbsolute(entry.path)||entry.path.includes('\\')||entry.path.split('/').some(part=>!part||part==='.'||part==='..'))continue;
  const file=await realpath(resolve(root,entry.path)),within=relative(root,file);if(within.startsWith('..')||isAbsolute(within))continue;
  const bytes=await readFile(file);if(bytes.length>MAX_FILE_BYTES)continue;return verifiedCanonical(bytes,row.sha256);
 }catch{}}
 return undefined;
}
async function atomicJson(path,value){const temporary=`${path}.tmp-${randomUUID()}`;try{await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{flag:'wx'});await rename(temporary,path);}finally{await unlink(temporary).catch(()=>{});}}
/** CLI callers validate the fixed229 contract first. This small transport/file
 * transaction is independently testable using authored data and mocked fetch. */
export async function materializeRows(rows,{output,caches,fetcher=fetch}){
 await mkdir(join(output,'files'),{recursive:true});let cursor=0,reusedInputs=0,downloadedInputs=0,failed;
 await Promise.all(Array.from({length:4},async()=>{while(!failed&&cursor<rows.length){const row=rows[cursor++];try{
  let body=await readVerifiedCache(row,caches);if(body)reusedInputs++;else{body=await fetchVerifiedBody(row,fetcher);downloadedInputs++;}
  // Even a mock or later refactor cannot write a body before canonical proof.
  if(sha(body)!==row.sha256)fail('CANONICAL_HASH');await writeFile(join(output,'files',row.sha256+'.json'),body);
 }catch(error){failed=error;}}}));
 if(failed)throw failed;
 const index={rows:rows.map(row=>({url:row.url,sha256:row.sha256,path:`files/${row.sha256}.json`}))};await atomicJson(join(output,'index.json'),index);return {reusedInputs,downloadedInputs};
}
export function buildReceipt({reportSha256,mappingSha256,reusedInputs,downloadedInputs}){
 if(!SHA256.test(reportSha256)||!SHA256.test(mappingSha256)||!Number.isSafeInteger(reusedInputs)||!Number.isSafeInteger(downloadedInputs)||reusedInputs<0||downloadedInputs<0||reusedInputs+downloadedInputs!==INPUT_COUNT)fail('RECEIPT');
 return {schemaVersion:1,verified:true,inputCount:INPUT_COUNT,inputSetSha256:INPUT_SET_SHA256,reportSha256,mappingSha256,sourceRevisions:{...SOURCE_REVISIONS},reusedInputs,downloadedInputs,sourceBodiesPublished:false};
}
export function parseArgs(args){
 const options={report:'',output:'',receipt:'',caches:[]};
 for(let i=0;i<args.length;i+=2){const flag=args[i],value=args[i+1];if(!['--report','--output','--receipt','--cache'].includes(flag)||!value||value.startsWith('--'))fail('ARGUMENT');if(flag==='--cache')options.caches.push(value);else{const key=flag.slice(2);if(options[key])fail('ARGUMENT');options[key]=value;}}
 if(!options.report||!options.output||!options.receipt)fail('ARGUMENT');return options;
}
async function main(){
 const options=parseArgs(process.argv.slice(2));await unlink(options.receipt).catch(error=>{if(error.code!=='ENOENT')fail('RECEIPT_PATH');});
 const reportBytes=await readFile(options.report),report=JSON.parse(reportBytes.toString('utf8')),mappingBytes=await readFile(MAPPING_FILE),mapping=JSON.parse(mappingBytes.toString('utf8')),inputs=validateInputs(report.inputs),rows=validateMapping(mapping,inputs);
 const stats=await materializeRows(rows,options),receipt=buildReceipt({reportSha256:sha(reportBytes),mappingSha256:sha(mappingBytes),...stats});await mkdir(dirname(options.receipt),{recursive:true});await atomicJson(options.receipt,receipt);process.stdout.write(JSON.stringify(receipt)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{const code=error instanceof Error&&/^REVIEWED_CORPUS_[A-Z_]+$/.test(error.message)?error.message:'REVIEWED_CORPUS_FAILED';process.stderr.write(code+'; no source response bodies or raw errors are logged.\n');process.exitCode=1;});
