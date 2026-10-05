import type {Plugin} from 'vite';
import {gzipSync} from 'node:zlib';
import {generateProgress,progressDigest} from './automationProgress.ts';
import {validProgress,PROGRESS_LIMIT} from '../src/platform/automationProgress.ts';
export function automationProgressPlugin():Plugin{
 let root:string,mode:string,reference:string,identity:object;
 const virtual='virtual:automation-progress',resolved='\0'+virtual;
 return {name:'public-automation-progress',configResolved(config){root=config.root;mode=config.mode;},
  buildStart(){const manifest=generateProgress(root,mode);if(!validProgress(manifest))throw Error('Invalid generated public automation manifest');const content=JSON.stringify(manifest);if(Buffer.byteLength(content)>PROGRESS_LIMIT)throw Error('Automation manifest exceeded 48 KiB');
   identity={sourceCommit:manifest.build.sourceCommit,fingerprint:manifest.build.fingerprint,mode,manifestSha256:progressDigest(content)};
   if(this.meta.watchMode||process.env.NODE_ENV!=='production')reference='';
   else reference=this.emitFile({type:'asset',name:'automation-progress.json',source:content});
  },
  resolveId(id){if(id===virtual)return resolved;},
  load(id){if(id!==resolved)return;return `export const identity=${JSON.stringify(identity)}; export const manifestUrl=${reference?`import.meta.ROLLUP_FILE_URL_${reference}`:JSON.stringify('/__automation-progress.json')};`;},
  configureServer(server){server.middlewares.use('/__automation-progress.json',(_req,res)=>{try{const manifest=generateProgress(root,mode);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(manifest));}catch{res.statusCode=503;res.end('{}');}});},
  generateBundle(_,bundle){
   const chunks=Object.values(bundle).filter(c=>c.type==='chunk'),first=new Set<string>();
   const firstVisit=(file:string)=>{if(first.has(file))return;first.add(file);const c=bundle[file];if(c?.type==='chunk')c.imports.forEach(firstVisit);};
   chunks.filter(c=>c.isEntry||/\/ui\/(App|PlayerViewer)\.tsx$/.test(c.facadeModuleId?.replaceAll('\\','/')||'')).forEach(c=>firstVisit(c.fileName));
   const progress=chunks.filter(c=>Object.keys(c.modules).some(id=>id.replaceAll('\\','/').endsWith('/src/ui/AutomationProgress.tsx')));
   const available=new Set(first);
   const noticeVisit=(file:string)=>{if(available.has(file))return;available.add(file);const c=bundle[file];if(c?.type==='chunk')c.imports.forEach(noticeVisit);};
   chunks.filter(c=>/\/ui\/Announcement\.tsx$/.test(c.facadeModuleId?.replaceAll('\\','/')||'')).forEach(c=>noticeVisit(c.fileName));
   const added=new Set<string>();
   for(const chunk of progress){
    if(first.has(chunk.fileName))throw Error('Progress tab leaked into the startup graph');
    const visit=(file:string)=>{if(available.has(file)||added.has(file))return;added.add(file);const c=bundle[file];if(c?.type==='chunk'){
     if(Object.keys(c.modules).some(id=>/\/src\/(core|data)\//.test(id.replaceAll('\\','/'))))throw Error('Progress tab imported extra rules or character data');c.imports.forEach(visit);
    }};visit(chunk.fileName);
   }
   const assets=Object.values(bundle).flatMap(a=>a.type==='asset'&&a.names?.includes('automation-progress.json')?[a]:[]);
   this.emitFile({type:'asset',fileName:'assets/automation-progress.audit.json',source:JSON.stringify({schemaVersion:1,manifest:assets.map(a=>({file:a.fileName,bytes:Buffer.byteLength(a.source),gzip:gzipSync(a.source).length})),addedChunks:[...added].map(file=>{const c=bundle[file];return c?.type==='chunk'?{file,bytes:Buffer.byteLength(c.code),gzip:gzipSync(c.code).length,modules:Object.keys(c.modules).filter(id=>id.includes('/src/')).map(id=>id.slice(id.lastIndexOf('/src/')+1))}:undefined;}),deferred:true,extraRuleModules:[]},null,2)});
  }
 };
}
