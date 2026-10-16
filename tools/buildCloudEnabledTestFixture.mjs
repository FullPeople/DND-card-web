// Test-only enabled cloud profile. Never used by production build or deployment.
import {build,loadConfigFromFile} from 'vite';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,cpSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),out=join(root,'.local-evidence/cloud-enabled-fixture'),flag=join(root,'src/cloud/availability.ts'),css=join(root,'src/cloud/suspended.css'),bytes=readFileSync(flag,'utf8'),cssBytes=readFileSync(css,'utf8'),needle='export const cloudFeaturesEnabled:boolean=false;',hidden='.suite-website-link[href^="https://dnd.center/library/"]{display:none!important}';
if(bytes.split(needle).length!==2||cssBytes.split(hidden).length!==2)throw Error('Production cloud suspension boundary changed');
const digest=v=>createHash('sha256').update(v).digest('hex');mkdirSync(out,{recursive:true});const builds=[];
for(const [configFile,mode,target]of [['vite.config.ts','standalone','card'],['vite.library.config.ts','cloud-library','library']]){
 let transformed=0,visibilityRestored=0;const fixture={name:'isolated-enabled-cloud-test-profile',enforce:'pre',transform(code,id){const normal=id.replaceAll('\\','/').split('?')[0];if(normal===css.replaceAll('\\','/')){if(code.split(hidden).length!==2)throw Error('Cloud visibility override no longer matches');visibilityRestored++;return code.replace(hidden,'');}if(normal!==flag.replaceAll('\\','/'))return;if(code.split(needle).length!==2)throw Error('Cloud test override no longer matches');transformed++;return code.replace(needle,'export const cloudFeaturesEnabled:boolean=true;');}};
 const {config}=await loadConfigFromFile({command:'build',mode},join(root,configFile));await build({...config,configFile:false,mode,plugins:[...(config.plugins||[]),fixture],build:{...config.build,outDir:join(out,target),emptyOutDir:true}});if(!transformed||!visibilityRestored)throw Error('Enabled fixture did not override both exact suspension boundaries');builds.push({target,transformed,visibilityRestored});
}
copyFileSync(join(root,'tools/fixtures/cloud-enabled-home290.html'),join(out,'index.html'));cpSync(join(root,'dist-cloud/wiki'),join(out,'wiki'),{recursive:true});
if(readFileSync(flag,'utf8')!==bytes||readFileSync(css,'utf8')!==cssBytes)throw Error('Production suspension source changed during fixture build');
writeFileSync(join(out,'fixture-profile.json'),JSON.stringify({testOnly:true,productionCloudEnabled:false,productionSourceSha256:digest(bytes),productionCssSha256:digest(cssBytes),overrides:['src/cloud/availability.ts','src/cloud/suspended.css'],historicalHomeSource:'2948267cf503ea525dd2bc037406460f1572c48f',builds},null,2)+'\n');console.log(JSON.stringify({testOnly:true,out,builds}));
