import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {extractClassFilterSourceMetadata} from './classFilterSourceMetadata.ts';

const args=process.argv.slice(2);assert(args.length===2,'Usage: exportClassFilterSourceMetadata.mjs PRIVATE_PRIMARY_PARSER NEW_OUTPUT_JSON');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{cwd:root,env:{...process.env,GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0'}});
const producerRevision=git('rev-parse','HEAD').toString().trim();
for(const file of ['tools/classFilterSourceMetadata.ts','tools/exportClassFilterSourceMetadata.mjs'])assert(readFileSync(resolve(root,file)).equals(git('cat-file','blob',producerRevision+':'+file)),'Commit the exact source metadata generator first');
const provenance={repository:'tjliqy/5etools-cn',revision:'774a320e4a92d71d100673bc0df965661d9e8c1b',path:'js/parser.js',gitBlob:'6e77ec858f2878a173d4d57ee4b7c63aa7978b6f',sha256:'62471bc02e090de6ff6f967610fcfb5add66506c273b3520e43f46ffeb10060c'};
const raw=readFileSync(resolve(args[0]));assert.equal(sha(raw),provenance.sha256,'Primary source metadata bytes changed');assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${raw.length}\0`),raw])).digest('hex'),provenance.gitBlob,'Primary Git object changed');
const metadata=extractClassFilterSourceMetadata(raw.toString('utf8'));
const report={...metadata,provenance,producerRevision,scope:'source labels and classification only; no rule bodies, entitlement or completion credit'};
assert.equal(git('rev-parse','HEAD').toString().trim(),producerRevision,'Metadata producer changed');
const bytes=JSON.stringify(report,null,2)+'\n';writeFileSync(resolve(args[1]),bytes,{flag:'wx'});console.log(JSON.stringify({producerRevision,sha256:sha(bytes),sources:Object.keys(metadata.abbreviations).length,nonstandardSources:metadata.nonstandardSources.length,bytes:Buffer.byteLength(bytes)}));
