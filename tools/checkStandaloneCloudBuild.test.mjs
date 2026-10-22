import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkStandaloneCloudBuild} from './checkStandaloneCloudBuild.mjs';

const profile={scope:'standalone-private-cloud-production',cloudFeaturesEnabled:true,accountLibrariesPrivate:true,originalStorageNamespaces:true,owlbearEnabled:false,apiBase:'/api/'};
function fixture(t,staged=true){
 const parent=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'production-profile-'));
 t.after(()=>{assert.equal(path.dirname(fs.realpathSync(root)),parent);fs.rmSync(root,{recursive:true});});
 const folders=(staged?['dist-cloud/card','dist-cloud/library']:['dist-standalone-cloud','dist-library-cloud']).map(p=>path.join(root,p));
 for(const [i,folder] of folders.entries()){
  fs.mkdirSync(path.join(folder,'assets'),{recursive:true});
  fs.writeFileSync(path.join(folder,'cloud-profile.json'),JSON.stringify(profile));
  fs.writeFileSync(path.join(folder,'index.html'),'<script src="/'+(i?'library':'card')+'/assets/app.js"></script>');
  fs.writeFileSync(path.join(folder,'assets/app.js'),'/* authored bundle fixture */');
 }
 fs.writeFileSync(path.join(folders[0],'standalone-audit.json'),JSON.stringify({singlePlayer:true,multiplayerModules:[]}));
 return {root,folders};
}
test('validates both direct production outputs and the actual staged card/library payload',t=>{
 for(const staged of [false,true]){const {root}=fixture(t,staged);assert.deepEqual(checkStandaloneCloudBuild({root,staged}).targets,['card','library']);}
});
test('refuses the default suspended package without either formal profile',t=>{
 for(const missing of [0,1]){const {root,folders}=fixture(t);fs.unlinkSync(path.join(folders[missing],'cloud-profile.json'));assert.throws(()=>checkStandaloneCloudBuild({root,staged:true}),/ENOENT/);}
});
test('refuses disabled, non-private, renamed storage, plugin and alternate API profiles',t=>{
 for(const patch of [{cloudFeaturesEnabled:false},{cloudFeaturesEnabled:'true'},{accountLibrariesPrivate:false},{originalStorageNamespaces:false},{owlbearEnabled:true},{apiBase:'/cloud-lab/api/'}]){
  const {root,folders}=fixture(t);fs.writeFileSync(path.join(folders[1],'cloud-profile.json'),JSON.stringify({...profile,...patch}));assert.throws(()=>checkStandaloneCloudBuild({root,staged:true}),/Wrong production cloud profile/);
 }
});
test('refuses isolated lab HTML, wrong asset bases and isolated storage in executable bundles',t=>{
 for(const mutation of ['lab','base','storage']){
  const {root,folders}=fixture(t);
  if(mutation==='lab')fs.appendFileSync(path.join(folders[0],'index.html'),'<body data-cloud-lab>');
  if(mutation==='base')fs.writeFileSync(path.join(folders[1],'index.html'),'<script src="/cloud-lab/assets/app.js"></script>');
  if(mutation==='storage')fs.writeFileSync(path.join(folders[1],'assets/app.js'),'localStorage.getItem("cloud-lab2:cards")');
  assert.throws(()=>checkStandaloneCloudBuild({root,staged:true}),/Isolated lab|wrong public entry|Test storage namespace/);
 }
});
test('checks the staged card multiplayer audit as well as the direct build audit',t=>{
 const {root,folders}=fixture(t);fs.writeFileSync(path.join(folders[0],'standalone-audit.json'),JSON.stringify({singlePlayer:true,multiplayerModules:['fixture-host-write']}));
 assert.throws(()=>checkStandaloneCloudBuild({root,staged:true}),/Multiplayer code/);
});
