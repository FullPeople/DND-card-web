import {readFile,mkdir,copyFile,writeFile,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2),option=(name,fallback)=>{const at=args.indexOf(name);return at<0?fallback:args[at+1];};
const dataRepo=resolve(option('--data-repo','../dnd5e-automation-data'));
const share=join(dataRepo,'.cache/browser-share'),artifact=resolve(option('--artifact',join(dataRepo,'.cache/g4-final/automation.json')));
const target=resolve('src/data/automation'),assets=resolve('public/automation');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(await readFile(join(share,'shared-files.json'),'utf8'));
const bytes=await readFile(artifact);if(bytes.length>33554432)throw Error('Automation artifact exceeds the import size limit');
const {publicArtifact}=await import(pathToFileURL(join(share,'validate.ts')).href);
const envelope=publicArtifact(JSON.parse(bytes.toString('utf8')));
await mkdir(target,{recursive:true});await mkdir(assets,{recursive:true});
for(const [file,sha]of Object.entries(manifest.files)){
  const body=await readFile(join(share,file));if(digest(body)!==sha)throw Error(`Shared file mismatch: ${file}`);await copyFile(join(share,file),join(target,file));
}
await writeFile(join(target,'shared-files.json'),JSON.stringify(manifest,null,2)+'\n');
const body=Buffer.from(JSON.stringify(envelope)),sha256=digest(body),file=`ir-1-${sha256.slice(0,16)}.json`;
await writeFile(join(assets,file),body);
await writeFile(join(target,'default-source.json'),JSON.stringify({path:`automation/${file}`,sha256,bytes:body.length,kiweeVersion:envelope.versionLock.kiweeChangelogVersion,toolVersion:envelope.versionLock.toolVersion,protocol:3,schemaVersion:1},null,2)+'\n');
for(const old of await readdir(assets))if(/^ir-1-[a-f0-9]{16}\.json$/.test(old)&&old!==file)await unlink(join(assets,old));
console.log(JSON.stringify({file,sha256,bytes:body.length,records:envelope.records.length}));
