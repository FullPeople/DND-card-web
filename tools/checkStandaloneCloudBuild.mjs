import fs from 'node:fs';
import path from 'node:path';
for(const [folder,base] of [['dist-standalone-cloud','/card/'],['dist-library-cloud','/library/']]){
 const profile=JSON.parse(fs.readFileSync(path.join(folder,'cloud-profile.json')));
 if(profile.scope!=='standalone-private-cloud-production'||!profile.cloudFeaturesEnabled||!profile.originalStorageNamespaces||profile.owlbearEnabled||profile.apiBase!=='/api/')throw Error('Wrong production cloud profile');
 const html=fs.readFileSync(path.join(folder,'index.html'),'utf8');
 if(html.includes('data-cloud-lab')||!html.includes(base+'assets/'))throw Error('Isolated lab or wrong public entry');
 for(const file of fs.readdirSync(path.join(folder,'assets')).filter(name=>name.endsWith('.js'))){
  if(fs.readFileSync(path.join(folder,'assets',file),'utf8').includes('cloud-lab2:'))throw Error('Test storage namespace leaked into production');
 }
 if(folder==='dist-standalone-cloud'){
  const audit=JSON.parse(fs.readFileSync(path.join(folder,'standalone-audit.json')));
  if(!audit.singlePlayer||audit.multiplayerModules.length)throw Error('Multiplayer code in standalone build');
 }
}
console.log(JSON.stringify({scope:'standalone-private-cloud-production',targets:['card','library'],originalNamespaces:true,owlbearEnabled:false}));
