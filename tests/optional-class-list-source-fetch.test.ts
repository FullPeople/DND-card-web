import {afterAll,expect,it,vi} from 'vitest';
import {readFileSync,mkdtempSync,rmSync,writeFileSync,mkdirSync,symlinkSync,existsSync,statSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {SOURCE,DEADLINE_MS,parseArgs,validateDestinations,validateRawBook,fetchVerifiedBook,run} from '../tools/fetchOptionalClassSpellListSource.mjs';

const scratch=mkdtempSync(join(tmpdir(),'optional-class-side-fetch-'));
afterAll(()=>rmSync(scratch,{recursive:true,force:true}));
const denyMarker=()=>{const guard=(globalThis as any)[Symbol.for('dnd.offlineCatalogFetch.v1')];expect(Object.isFrozen(guard)).toBe(true);expect(globalThis.fetch===guard.deny).toBe(true);expect(guard.unexpected.length).toBe(0);};
const output=()=>{const root=mkdtempSync(join(scratch,'case-'));return {root,output:join(root,'private','book.json'),receipt:join(root,'metadata','receipt.json')};};
const response=(bytes:Uint8Array,changes:any={})=>({ok:true,redirected:false,url:SOURCE.retrievalUrl,headers:new Headers(),body:new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}}),...changes});
const args=(p:ReturnType<typeof output>)=>['--output',p.output,'--receipt',p.receipt];

it('has one fixed immutable URL/source contract and60-second bound, with no mutable override or229receipt claim',()=>{
 denyMarker();expect(Object.isFrozen(SOURCE)).toBe(true);expect(DEADLINE_MS).toBe(60000);
 expect(SOURCE.retrievalUrl).toBe('https://raw.githubusercontent.com/tjliqy/5etools-cn/5cc0bbe2c2b241a334e731af4448bdba2168e8bd/data/book/book-tce.json');expect(SOURCE.rawBytes).toBe(465199);
 const valid=['--output','private.json','--receipt','metadata.json'];expect(parseArgs(valid)).toEqual({output:'private.json',receipt:'metadata.json'});
 for(const bad of [[],valid.slice(0,-1),valid.slice(0,-2),[...valid,'--url','https://example.invalid'],[...valid,'--revision','main'],[...valid,'--cache','anything'],[...valid,'--output','again'],[...valid,'--unknown','extra'],['--output','--receipt','metadata.json'],['--output','',...valid.slice(2)]])expect(()=>parseArgs(bad)).toThrow('OPTIONAL_CLASS_LIST_FETCH_ARGUMENT');
});
it('actual CLI rejects missing/extra/url flags without transport or echoing supplied private values',()=>{
 const cli=resolve('tools/fetchOptionalClassSpellListSource.mjs'),secret='AUTHORED_PRIVATE_ARGUMENT';
 for(const bad of [[],['--output',secret],['--output','x','--receipt','y','--url',secret]]){
  const result=spawnSync(process.execPath,[cli,...bad],{encoding:'utf8',timeout:5000,env:process.env});expect(result.status).toBe(1);expect(result.stdout).toBe('');expect(result.stderr).toBe('OPTIONAL_CLASS_LIST_FETCH_ARGUMENT; no source bodies or arbitrary errors are logged.\n');expect(result.stderr.includes(secret)).toBe(false);
 }
 denyMarker();
});
it('rejects overlapping/existing outputs and symlinked files or parents before invoking the injected transport',async()=>{
 const p=output();await expect(validateDestinations({output:p.output,receipt:p.output})).rejects.toThrow('PATH_OVERLAP');await expect(validateDestinations({output:p.output,receipt:join(p.output,'child')})).rejects.toThrow('PATH_OVERLAP');
 mkdirSync(join(p.root,'actual'));symlinkSync(join(p.root,'actual'),join(p.root,'private'),'dir');let calls=0;await expect(run(args(p),()=>{calls++;throw Error('AUTHORED_PRIVATE_BODY');})).rejects.toThrow('PATH_SYMLINK');expect(calls).toBe(0);
 const q=output();writeFileSync(join(q.root,'target'),'AUTHORED_PRIVATE_BODY');mkdirSync(join(q.root,'private'));symlinkSync(join(q.root,'target'),q.output);await expect(validateDestinations(q)).rejects.toThrow('PATH_SYMLINK');
 const r=output();mkdirSync(join(r.root,'private'));writeFileSync(r.output,'AUTHORED_OLD_BODY');await expect(validateDestinations(r)).rejects.toThrow('OUTPUT_EXISTS');
});
it('positive byte proof uses only the existing private immutable book and writes identical0600raw bytes plus closed metadata atomically',async()=>{
 denyMarker();const path=process.env.OPTIONAL_CLASS_LIST_SIDE_SOURCE_FILE;if(!path)throw Error('Existing pinned private side-source fixture required');const bytes=readFileSync(path),p=output();expect(validateRawBook(bytes)).toEqual({rawBytes:SOURCE.rawBytes,rawSha256:SOURCE.rawSha256,gitBlobSha1:SOURCE.gitBlobSha1});
 // Like native fetch, the response stream here is already decoded while the
 // transport length describes the compressed wire representation.
 const wireBytes=gzipSync(bytes).length;expect(wireBytes).toBeLessThan(SOURCE.rawBytes);
 let calls=0;const receipt=await run(args(p),async(url:string,options:any)=>{calls++;expect(url).toBe(SOURCE.retrievalUrl);expect(options.redirect).toBe('error');expect(options.signal instanceof AbortSignal).toBe(true);return response(bytes,{headers:new Headers({'content-length':String(wireBytes),'content-encoding':'gzip'})});});
 expect(calls).toBe(1);expect(readFileSync(p.output).equals(bytes)).toBe(true);expect(statSync(p.output).mode&0o777).toBe(0o600);expect(statSync(p.receipt).mode&0o777).toBe(0o600);expect(JSON.parse(readFileSync(p.receipt,'utf8'))).toEqual(receipt);
 expect(Object.keys(receipt).sort()).toEqual(['schemaVersion','kind','verified','repository','revision','path','retrievalUrl','rawBytes','rawSha256','gitBlobSha1','semanticSideSourceOnly','runtimeInputExtension','sourceBodiesPublished'].sort());expect(receipt.runtimeInputExtension).toBe(false);expect(receipt.semanticSideSourceOnly).toBe(true);expect(receipt.sourceBodiesPublished).toBe(false);expect(JSON.stringify(receipt).includes(p.root)).toBe(false);expect(Object.hasOwn(receipt,'inputCount')).toBe(false);
 expect(readdirSync(join(p.root,'private'))).toEqual(['book.json']);expect(readdirSync(join(p.root,'metadata'))).toEqual(['receipt.json']);
 const actual={rawSha256:createHash('sha256').update(bytes).digest('hex'),gitBlobSha1:createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex')};expect(actual.rawSha256).toBe(SOURCE.rawSha256);expect(actual.gitBlobSha1).toBe(SOURCE.gitBlobSha1);denyMarker();
});
it('refuses redirects, non-success responses, wrong advertised sizes, missing bodies and stream overflow without writing files',async()=>{
 for(const changes of [{redirected:true},{url:'https://example.invalid/AUTHORED_PRIVATE_BODY'},{ok:false},{headers:new Headers({'content-length':'not-a-size'})},{headers:new Headers({'content-length':String(SOURCE.rawBytes+1)})},{body:null}]){
  const p=output();await expect(run(args(p),async()=>response(Buffer.from('AUTHORED_PRIVATE_BODY'),changes))).rejects.toThrow(/^OPTIONAL_CLASS_LIST_FETCH_/);expect(existsSync(p.output)).toBe(false);expect(existsSync(p.receipt)).toBe(false);
 }
 const p=output();await expect(run(args(p),async()=>response(new Uint8Array(SOURCE.rawBytes+1)))).rejects.toThrow('BODY_LIMIT');expect(existsSync(p.output)).toBe(false);expect(existsSync(p.receipt)).toBe(false);
});
it('rejects short or exact-size authored hash mismatches; arbitrary transport errors and failing cancellation never disclose bodies',async()=>{
 expect(()=>validateRawBook(Buffer.from('AUTHORED_PRIVATE_BODY'))).toThrow('RAW_SIZE');expect(()=>validateRawBook(Buffer.alloc(SOURCE.rawBytes,32))).toThrow('RAW_HASH');
 const p=output();await expect(run(args(p),async()=>response(Buffer.alloc(SOURCE.rawBytes,32)))).rejects.toThrow('RAW_HASH');expect(existsSync(p.output)).toBe(false);expect(existsSync(p.receipt)).toBe(false);
 await expect(fetchVerifiedBook(async()=>{throw Error('AUTHORED_PRIVATE_BODY_SECRET');})).rejects.toThrow('OPTIONAL_CLASS_LIST_FETCH_TRANSPORT');
 await expect(fetchVerifiedBook(async()=>{throw Error('OPTIONAL_CLASS_LIST_FETCH_AUTHORED_PRIVATE_BODY_SECRET');})).rejects.toThrow('OPTIONAL_CLASS_LIST_FETCH_TRANSPORT');
 const body={getReader:()=>({read:async()=>{throw Error('AUTHORED_PRIVATE_BODY_SECRET');},cancel:()=>Promise.reject(Error('AUTHORED_PRIVATE_CANCEL_SECRET'))})};await expect(fetchVerifiedBook(async()=>response(new Uint8Array(),{body}))).rejects.toThrow('OPTIONAL_CLASS_LIST_FETCH_TRANSPORT');denyMarker();
 vi.useFakeTimers();try{const timeout=fetchVerifiedBook(()=>new Promise<never>(()=>{})).catch((error:unknown)=>error instanceof Error?error.message:'UNEXPECTED_NON_ERROR');await vi.advanceTimersByTimeAsync(DEADLINE_MS);expect(await timeout).toBe('OPTIONAL_CLASS_LIST_FETCH_TIMEOUT');}finally{vi.useRealTimers();}
});
