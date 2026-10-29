import {spawn} from 'node:child_process';
import {constants} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const vitest=fileURLToPath(new URL('../node_modules/vitest/vitest.mjs',import.meta.url));
export const offlineCatalogPreloadUrl=new URL('../tests/helpers/offlineCatalogFetchPreload.mjs',import.meta.url).href;
const memory=/^--(?:max-old-space-size|max-semi-space-size|initial-old-space-size)(?:=\d+)?$/;
const single=new Set(['--no-warnings','--trace-warnings','--trace-uncaught','--enable-source-maps']);
function guardedNodeOptions(value){
 if(value!==undefined&&typeof value!=='string')throw Error('Unsupported Node test options.');
 const tokens=(value||'').trim().split(/\s+/).filter(Boolean),safe=[];
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i];
  if(token===`--import=${offlineCatalogPreloadUrl}`)continue;
  if(single.has(token)){safe.push(token);continue;}
  if(memory.test(token)){
   if(token.includes('=')){safe.push(token);continue;}
   if(/^\d+$/.test(tokens[i+1]||'')){safe.push(`${token}=${tokens[++i]}`);continue;}
  }
  // Do not propagate arbitrary loaders, debug listeners or secret-bearing
  // option values, and never echo the rejected environment value.
  throw Error('Unsupported Node test options; only documented memory and diagnostic flags are preserved.');
 }
 return [...safe,`--import=${offlineCatalogPreloadUrl}`].join(' ');
}
export function buildVitestLaunch(args,environment=process.env){
 if(!Array.isArray(args)||args.some(arg=>typeof arg!=='string'))throw Error('Vitest arguments must be strings.');
 return {command:process.execPath,args:[vitest,...args],options:{env:{...environment,NODE_OPTIONS:guardedNodeOptions(environment.NODE_OPTIONS)},stdio:'inherit',shell:false}};
}
export function vitestExitCode(code,signal){return Number.isInteger(code)?code:signal&&constants.signals[signal]?128+constants.signals[signal]:1;}
function main(){
 let launch;try{launch=buildVitestLaunch(process.argv.slice(2));}catch(error){process.stderr.write(`${error.message}\n`);process.exitCode=1;return;}
 const child=spawn(launch.command,launch.args,launch.options),handlers=new Map();
 for(const signal of ['SIGINT','SIGTERM']){const forward=()=>{child.kill(signal);};handlers.set(signal,forward);process.on(signal,forward);}
 const cleanup=()=>{for(const [signal,handler]of handlers)process.off(signal,handler);};
 child.once('error',()=>{cleanup();process.stderr.write('Unable to start the installed Vitest runner.\n');process.exitCode=1;});
 child.once('exit',(code,signal)=>{cleanup();process.exitCode=vitestExitCode(code,signal);});
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main();
