import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
export function checkStandaloneCloudBuild({root=process.cwd(),staged=false}={}){
for(const [directory,base,standalone] of staged?[['dist-cloud/card','/card/',true],['dist-cloud/library','/library/',false]]:[['dist-standalone-cloud','/card/',true],['dist-library-cloud','/library/',false]]){
 const folder=path.resolve(root,directory);
 const profile=JSON.parse(fs.readFileSync(path.join(folder,'cloud-profile.json')));
 if(profile.scope!=='standalone-private-cloud-production'||profile.cloudFeaturesEnabled!==true||profile.accountLibrariesPrivate!==true||profile.originalStorageNamespaces!==true||profile.owlbearEnabled!==false||profile.apiBase!=='/api/')throw Error('Wrong production cloud profile');
 const html=fs.readFileSync(path.join(folder,'index.html'),'utf8');
 if(html.includes('data-cloud-lab')||!html.includes(base+'assets/'))throw Error('Isolated lab or wrong public entry');
 for(const file of fs.readdirSync(path.join(folder,'assets')).filter(name=>name.endsWith('.js'))){
  if(fs.readFileSync(path.join(folder,'assets',file),'utf8').includes('cloud-lab2:'))throw Error('Test storage namespace leaked into production');
 }
 if(standalone){
  const audit=JSON.parse(fs.readFileSync(path.join(folder,'standalone-audit.json')));
  if(audit.singlePlayer!==true||!Array.isArray(audit.multiplayerModules)||audit.multiplayerModules.length)throw Error('Multiplayer code in standalone build');
 }
}
return {scope:'standalone-private-cloud-production',targets:['card','library'],originalNamespaces:true,owlbearEnabled:false};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const {values}=parseArgs({options:{staged:{type:'boolean',default:false}}});
 console.log(JSON.stringify(checkStandaloneCloudBuild({staged:values.staged})));
}
