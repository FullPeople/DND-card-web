import {build} from 'vite';
import {writeFileSync,mkdirSync} from 'node:fs';
mkdirSync('.local-evidence',{recursive:true});
await build({mode:'standalone',plugins:[{name:'inspect-startup',generateBundle(_,bundle){
 writeFileSync('.local-evidence/startup-graph.json',JSON.stringify(Object.values(bundle).filter(x=>x.type==='chunk').map(x=>({file:x.fileName,entry:x.facadeModuleId,imports:x.imports,dynamic:x.dynamicImports,bytes:x.code.length,modules:Object.entries(x.modules).map(([id,v])=>({id,size:v.renderedLength}))})),null,2));
}}]});
