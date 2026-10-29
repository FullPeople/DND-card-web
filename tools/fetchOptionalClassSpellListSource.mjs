import {mkdir,writeFile,link,unlink,lstat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,dirname,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

// One reviewed semantic side-source, NOT an extension of the229 runtime corpus.
// No URL/revision/hash override, mutable-source fallback or retry is exposed.
export const SOURCE=Object.freeze({
 repository:'tjliqy/5etools-cn',revision:'5cc0bbe2c2b241a334e731af4448bdba2168e8bd',
 path:'data/book/book-tce.json',rawBytes:465199,
 gitBlobSha1:'a4b590a1e56a2ffc9cf731e7a2c5661b9f2ee73e',
 rawSha256:'0745f1a881ce2b9e25a13f66923821aa333e3df0622ce9135c273cfb4d62cf33',
 retrievalUrl:'https://raw.githubusercontent.com/tjliqy/5etools-cn/5cc0bbe2c2b241a334e731af4448bdba2168e8bd/data/book/book-tce.json'
});
export const DEADLINE_MS=60_000;
const fail=code=>{throw Error('OPTIONAL_CLASS_LIST_FETCH_'+code);};
const safeCodes=new Set(['ARGUMENT','PATH_SYMLINK','PATH_OVERLAP','OUTPUT_EXISTS','RAW_SIZE','RAW_HASH','TIMEOUT','REDIRECT','HTTP_STATUS','ADVERTISED_SIZE','BODY_MISSING','BODY_LIMIT','TRANSPORT'].map(code=>'OPTIONAL_CLASS_LIST_FETCH_'+code));
const isOwnError=error=>error instanceof Error&&safeCodes.has(error.message);
export function parseArgs(args){
 const options={output:'',receipt:''};
 for(let i=0;i<args.length;i+=2){const flag=args[i],value=args[i+1];if(!['--output','--receipt'].includes(flag)||typeof value!=='string'||!value||value.startsWith('-')||value.includes('\0'))fail('ARGUMENT');const key=flag.slice(2);if(options[key])fail('ARGUMENT');options[key]=value;}
 if(!options.output||!options.receipt)fail('ARGUMENT');return options;
}
async function noSymlink(path){
 for(let cursor=path;;cursor=dirname(cursor)){
  try{if((await lstat(cursor)).isSymbolicLink())fail('PATH_SYMLINK');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(dirname(cursor)===cursor)break;
 }
}
export async function validateDestinations(options){
 const output=resolve(options.output),receipt=resolve(options.receipt);
 const contains=(parent,child)=>{const path=relative(parent,child);return !path||!isAbsolute(path)&&path!=='..'&&!path.startsWith('..'+sep);};
 if(contains(output,receipt)||contains(receipt,output))fail('PATH_OVERLAP');
 for(const path of [output,receipt]){await noSymlink(path);try{await lstat(path);fail('OUTPUT_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}}
 return {output,receipt};
}
export function validateRawBook(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length!==SOURCE.rawBytes)fail('RAW_SIZE');
 const rawSha256=createHash('sha256').update(bytes).digest('hex'),gitBlobSha1=createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');
 if(rawSha256!==SOURCE.rawSha256||gitBlobSha1!==SOURCE.gitBlobSha1)fail('RAW_HASH');
 return {rawBytes:bytes.length,rawSha256,gitBlobSha1};
}
function abortable(promise,signal){
 return new Promise((resolve,reject)=>{const abort=()=>reject(Error('OPTIONAL_CLASS_LIST_FETCH_TIMEOUT'));if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});});
}
export async function fetchVerifiedBook(fetcher=globalThis.fetch){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),DEADLINE_MS);let reader;
 try{
  const response=await abortable(fetcher(SOURCE.retrievalUrl,{redirect:'error',signal:controller.signal}),controller.signal);
  if(response.redirected||response.url&&response.url!==SOURCE.retrievalUrl)fail('REDIRECT');if(!response.ok)fail('HTTP_STATUS');
  // Native fetch may decode compressed transport while Content-Length still
  // describes wire bytes. Bound that header; prove the exact consumed raw file
  // length and both hashes below, never "repair" or reserialize its bytes.
  const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)<1||Number(length)>SOURCE.rawBytes))fail('ADVERTISED_SIZE');
  if(!response.body||typeof response.body.getReader!=='function')fail('BODY_MISSING');reader=response.body.getReader();const chunks=[];let size=0;
  while(true){const part=await abortable(reader.read(),controller.signal);if(part.done)break;size+=part.value.byteLength;if(size>SOURCE.rawBytes)fail('BODY_LIMIT');chunks.push(Buffer.from(part.value));}
  const bytes=Buffer.concat(chunks,size);validateRawBook(bytes);return bytes;
 }catch(error){if(controller.signal.aborted)fail('TIMEOUT');if(isOwnError(error))throw error;fail('TRANSPORT');}
 finally{controller.abort();clearTimeout(timer);try{Promise.resolve(reader?.cancel()).catch(()=>{});}catch{}}
}
async function atomicPrivateFile(path,bytes){
 await noSymlink(path);await mkdir(dirname(path),{recursive:true,mode:0o700});await noSymlink(path);const temporary=`${path}.tmp-${randomUUID()}`;
 try{
  await writeFile(temporary,bytes,{flag:'wx',mode:0o600});await noSymlink(path);
  // Atomic, exclusive publication: unlike rename(), link() cannot overwrite a
  // concurrently created destination. Both names are in the same directory.
  await link(temporary,path);
 }finally{await unlink(temporary).catch(()=>{});}
}
export async function run(args,fetcher=globalThis.fetch){
 const options=await validateDestinations(parseArgs(args)),bytes=await fetchVerifiedBook(fetcher),actual=validateRawBook(bytes);
 const receipt={schemaVersion:1,kind:'optional-class-list-semantic-side-source',verified:true,repository:SOURCE.repository,revision:SOURCE.revision,path:SOURCE.path,retrievalUrl:SOURCE.retrievalUrl,...actual,semanticSideSourceOnly:true,runtimeInputExtension:false,sourceBodiesPublished:false};
 let bodyWritten=false;
 try{await atomicPrivateFile(options.output,bytes);bodyWritten=true;await atomicPrivateFile(options.receipt,Buffer.from(JSON.stringify(receipt,null,2)+'\n'));}
 catch(error){if(bodyWritten)await unlink(options.output).catch(()=>{});throw error;}
 return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))run(process.argv.slice(2)).then(receipt=>process.stdout.write(JSON.stringify(receipt)+'\n')).catch(error=>{
 process.stderr.write((isOwnError(error)?error.message:'OPTIONAL_CLASS_LIST_FETCH_FAILED')+'; no source bodies or arbitrary errors are logged.\n');process.exitCode=1;
});
