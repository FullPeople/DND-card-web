import {expect,it} from 'vitest';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {catalogSourceDiscovery,verifyCommittedSourceDirectory} from '../tools/catalogSourceDiscovery';
import {mergeSourceDirectoryBooks} from '../src/platform/sourceDirectory';
import {PROGRESS_LIMIT} from '../src/platform/automationProgress';
it('adds all 425 discovered source IDs to the real directory, retaining 509 sources and 364 unknown inventories',()=>{
 const {directory}=catalogSourceDiscovery(process.cwd()),snapshot=JSON.parse(readFileSync('docs/data/automation-rule-status.json','utf8')),lock=JSON.parse(readFileSync('docs/data/automation-rule-status.lock.json','utf8')),registry=JSON.parse(readFileSync('src/data/sourceRegistry.json','utf8')),sources=new Map(Object.entries(registry).map(([id,value]:any)=>[id,{id,name:value.name}]));for(const source of snapshot.sources)if(!sources.has(source.id))sources.set(source.id,{id:source.id,name:source.name});
 const manifest:any={audit:{counts:{total:snapshot.records.length},snapshot:{artifactSha256:lock.sha256}},sources:[...sources.values()]},books=mergeSourceDirectoryBooks(manifest,directory),registered=new Set(snapshot.sources.map((source:any)=>source.id));expect(books).toHaveLength(509);expect(books.filter(book=>!registered.has(book.id))).toHaveLength(364);expect(directory.summary.newCandidateIdentities).toBe(28880);expect(Buffer.byteLength(JSON.stringify(directory))).toBeLessThan(PROGRESS_LIMIT);for(const book of directory.sources)expect(books.some(source=>source.id===book.id)).toBe(true);
});
it('checks the exact committed Data artifact and rejects a forged local hash',()=>{
 const {bytes,lock}=catalogSourceDiscovery(process.cwd()),base=resolve(tmpdir()),data=mkdtempSync(join(base,'source-directory-fixture-')),git=(...args:string[])=>execFileSync('git',args,{cwd:data,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{mkdirSync(join(data,'reports/progress'),{recursive:true});writeFileSync(join(data,lock.path),bytes);git('init','-q');git('remote','add','origin','https://github.com/FullPeople/dnd5e-automation-data.git');git('add',lock.path);git('-c','user.name=Source directory fixture','-c','user.email=fixture@example.invalid','commit','-qm','Authored source-directory verification fixture');const exact={...lock,revision:git('rev-parse','HEAD')};
  expect(verifyCommittedSourceDirectory(data,exact,bytes).verified).toBe(true);expect(()=>verifyCommittedSourceDirectory(data,{...exact,sha256:'0'.repeat(64)},bytes)).toThrow();expect(()=>verifyCommittedSourceDirectory(data,{...exact,revision:'0'.repeat(40)},bytes)).toThrow();git('remote','set-url','origin','https://example.invalid/unrelated.git');expect(()=>verifyCommittedSourceDirectory(data,exact,bytes)).toThrow('origin');
 }finally{if(dirname(resolve(data))!==base||!basename(data).startsWith('source-directory-fixture-'))throw Error('Unsafe fixture cleanup');rmSync(data,{recursive:true,force:true});}
});
it('rejects unknown diagnostic values rather than converting them into zero',()=>{
 const original=JSON.parse(readFileSync('docs/data/catalog-source-discovery.json','utf8')),lock=JSON.parse(readFileSync('docs/data/catalog-source-discovery.lock.json','utf8')),base=resolve(tmpdir()),fixture=mkdtempSync(join(base,'source-schema-fixture-'));mkdirSync(join(fixture,'docs/data'),{recursive:true});
 try{for(const change of [(value:any)=>value.diagnostics.counts['identity-unresolved']=null,(value:any)=>value.diagnostics.counts.futureDiagnostic=1,(value:any)=>value.unclassifiedExtraFiles='unknown']){const value=structuredClone(original);change(value);const bytes=Buffer.from(JSON.stringify(value));writeFileSync(join(fixture,'docs/data/catalog-source-discovery.json'),bytes);writeFileSync(join(fixture,'docs/data/catalog-source-discovery.lock.json'),JSON.stringify({...lock,sha256:createHash('sha256').update(bytes).digest('hex')}));expect(()=>catalogSourceDiscovery(fixture)).toThrow();}}
 finally{if(dirname(resolve(fixture))!==base||!basename(fixture).startsWith('source-schema-fixture-'))throw Error('Unsafe schema fixture cleanup');rmSync(fixture,{recursive:true,force:true});}
});
