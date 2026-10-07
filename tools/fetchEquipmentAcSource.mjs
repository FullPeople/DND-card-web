import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

// Test tooling only. One canonical locked file, no fallback, no rule prose in artifacts.
const lock=JSON.parse(await readFile(new URL('../tests/fixtures/equipment-ac-source.lock.json',import.meta.url),'utf8'));
const [flag,destination,...extra]=process.argv.slice(2);
if(flag!=='--output'||!destination||extra.length)throw Error('Usage: node tools/fetchEquipmentAcSource.mjs --output <ignored local file>');
// curl honors the execution environment's existing network proxy; no new identity,
// curl config, redirects, retries, certificate bypass or alternate mirror.
const bytes=execFileSync('curl',['--disable','--fail','--silent','--show-error','--max-time','30','--max-filesize',String(lock.bytes),'--proto','=https',lock.url],{maxBuffer:lock.bytes+1});
const size=bytes.length,sha256=createHash('sha256').update(bytes).digest('hex');
if(size!==lock.bytes||sha256!==lock.sha256)throw Error('Equipment source byte/hash lock mismatch; do not update the lock automatically');
const file=resolve(destination);await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);
console.log(JSON.stringify({verified:true,bytes:size,sha256,selectedIdentityLimit:6,verifiedScope:lock.verifiedScope,missingRuleClauses:lock.missingRuleClauses}));
