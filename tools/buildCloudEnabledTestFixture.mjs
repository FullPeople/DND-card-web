// Test-only enabled cloud profile. Never used by production build or deployment.
import {build,loadConfigFromFile} from 'vite';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,cpSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),out=join(root,'.local-evidence/cloud-enabled-fixture'),flag=join(root,'src/cloud/availability.ts'),bytes=readFileSync(flag,'utf8'),needle='export const cloudFeaturesEnabled:boolean=false;';
if(bytes.split(needle).length!==2)throw Error('Production cloud suspension boundary changed');
const sourceHash=createHash('sha256').update(bytes).digest('hex');mkdirSync(out,{recursive:true});const builds=[];
for(const [configFile,mode,target]of [['vite.config.ts','standalone','card'],['vite.library.config.ts','cloud-library','library']]){
 let transformed=0;const fixture={name:'isolated-enabled-cloud-test-profile',enforce:'pre',transform(code,id){if(id.replaceAll('\\','/').split('?')[0]!==flag.replaceAll('\\','/'))return;if(code.split(needle).length!==2)throw Error('Cloud test override no longer matches');transformed++;return code.replace(needle,'export const cloudFeaturesEnabled:boolean=true;');}};
 const {config}=await loadConfigFromFile({command:'build',mode},join(root,configFile));await build({...config,configFile:false,mode,plugins:[...(config.plugins||[]),fixture],build:{...config.build,outDir:join(out,target),emptyOutDir:true}});if(!transformed)throw Error('Enabled fixture did not override its exact module');builds.push({target,transformed});
}
copyFileSync(join(root,'tools/fixtures/cloud-enabled-home290.html'),join(out,'index.html'));cpSync(join(root,'dist-cloud/wiki'),join(out,'wiki'),{recursive:true});
if(readFileSync(flag,'utf8')!==bytes)throw Error('Production cloud flag changed during fixture build');
writeFileSync(join(out,'fixture-profile.json'),JSON.stringify({testOnly:true,productionCloudEnabled:false,productionSourceSha256:sourceHash,override:'src/cloud/availability.ts',historicalHomeSource:'2948267cf503ea525dd2bc037406460f1572c48f',builds},null,2)+'\n');console.log(JSON.stringify({testOnly:true,out,builds}));
