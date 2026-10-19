// Static payload only. Existing authenticated lab sessions and documents stay on the server.
import {readFileSync,writeFileSync,existsSync,mkdirSync,cpSync,readdirSync,statSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
if(git('status','--porcelain','--untracked-files=no'))throw Error('Commit the exact tested candidate before packaging');
const commit=git('rev-parse','HEAD'),evidence=join(root,'.local-evidence/cloud-stage2'),baseline=JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'));
const stage=join(evidence,'frontend-update-'+commit.slice(0,12));if(existsSync(stage))throw Error('Payload already exists; inspect its receipt before retrying');
mkdirSync(stage);const source=execFileSync('git',['archive','--format=zip','HEAD'],{cwd:root,maxBuffer:32*1024*1024});
for(const folder of ['card','library']){
 const build=join(evidence,folder);if(!readFileSync(join(build,'index.html'),'utf8').includes('data-cloud-lab="stage2"'))throw Error('Missing isolated lab marker');
 cpSync(build,join(stage,folder),{recursive:true});
 const manifests=readdirSync(join(build,'assets')).filter(name=>/^automation-progress-[\w-]+\.json$/.test(name));if(manifests.length!==1)throw Error('Expected one exact progress manifest');
 const progress=JSON.parse(readFileSync(join(build,'assets',manifests[0]),'utf8'));
 if(progress.build.sourceCommit!==commit)throw Error('Build does not match the current commit');
 writeFileSync(join(stage,folder,'source.zip'),source);
 writeFileSync(join(stage,folder,'release.json'),JSON.stringify({scope:'standalone-private-cloud-stage2',version:'cloud-stage2-switch-'+commit.slice(0,12),sourceCommit:commit},null,2));
}
const files={};const scan=dir=>{for(const item of readdirSync(dir)){const path=join(dir,item);if(statSync(path).isDirectory())scan(path);else files[relative(stage,path).replaceAll('\\','/')]=createHash('sha256').update(readFileSync(path)).digest('hex');}};scan(stage);
writeFileSync(join(stage,'manifest.json'),JSON.stringify({scope:'standalone-private-cloud-stage2-frontend-update',commit,previousCardIndexSha256:baseline.cardIndexSha256,previousLibraryIndexSha256:baseline.libraryIndexSha256,files},null,2));
const archive=join(evidence,'frontend-update-'+commit.slice(0,12)+'.tar.gz');execFileSync('tar',['-czf',archive,'-C',stage,'.']);
const receipt={commit,stage,archive,bytes:statSync(archive).size,sha256:createHash('sha256').update(readFileSync(archive)).digest('hex')};
writeFileSync(join(evidence,'card-switch-package.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
