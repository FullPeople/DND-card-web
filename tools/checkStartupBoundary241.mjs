import {build} from 'vite';
import {gzipSync} from 'node:zlib';
import {mkdirSync,writeFileSync} from 'node:fs';
const reports=[];
for(const mode of ['standalone','production'])await build({mode,plugins:[{name:'verify-real-startup-boundaries',generateBundle(_,bundle){
 const chunks=Object.values(bundle).filter(x=>x.type==='chunk'),roots=chunks.filter(x=>x.isEntry||/\/ui\/(App|PlayerViewer)\.tsx$/.test(x.facadeModuleId?.replaceAll('\\','/')||'')),first=new Set();
 const visit=name=>{if(first.has(name))return;const chunk=bundle[name];if(chunk?.type!=='chunk')return;first.add(name);chunk.imports.forEach(visit);};roots.forEach(x=>visit(x.fileName));
 const modules=[...first].flatMap(name=>Object.keys(bundle[name].modules)).map(id=>id.replaceAll('\\','/'));
 for(const suffix of ['/src/core/classMigration.ts','/src/core/automation/sourceSpells.ts'])if(modules.some(id=>id.endsWith(suffix)))throw Error(`Nonessential mutation implementation leaked into ${mode} first-card graph: ${suffix}`);
 const mutation=chunks.find(x=>Object.keys(x.modules).some(id=>id.replaceAll('\\','/').endsWith('/src/core/automation/sourceSpells.ts')));if(!mutation||first.has(mutation.fileName))throw Error('Editing reconciliation was dropped or still preloaded');
 const files=[...first].map(name=>({file:name,bytes:Buffer.byteLength(bundle[name].code),gzip:gzipSync(bundle[name].code).length}));reports.push({mode,files,deferredMutation:mutation.fileName,modules:modules.map(id=>id.slice(id.lastIndexOf('/src/')))});
}}]});
mkdirSync('.local-evidence/startup-tail241',{recursive:true});writeFileSync('.local-evidence/startup-tail241/boundaries.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports.map(r=>({mode:r.mode,entryUnionJsGzip:r.files.reduce((n,f)=>n+f.gzip,0),deferredMutation:r.deferredMutation}))));
