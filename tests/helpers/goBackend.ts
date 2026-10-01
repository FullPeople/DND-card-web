import {spawn,execFileSync,type ChildProcess} from 'node:child_process';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
/**
 * Real Go backend on a fresh temporary SQLite database. Nothing here mocks
 * persistence or the network; each call builds/launches the actual server.
 */
export interface TestUser { id:string; name:string; token:string }
export interface Backend { baseUrl:string; origin:string; users:Record<string,TestUser>; stop():Promise<void>; dir:string }
const backendDir=fileURLToPath(new URL('../../backend',import.meta.url));
let binary:string|undefined;
function build(){
  if(binary&&existsSync(binary))return binary;
  const out=join(mkdtempSync(join(tmpdir(),'dnd-go-bin-')),process.platform==='win32'?'dnd-backend.exe':'dnd-backend');
  execFileSync('go',['build','-o',out,'./cmd/server'],{cwd:backendDir,stdio:'inherit',env:{...process.env,CGO_ENABLED:'0'}});
  return binary=out;
}
const freePort=()=>new Promise<number>((done,fail)=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=(s.address() as any).port;s.close(()=>done(port));});s.on('error',fail);});
export async function startBackend(env:Record<string,string>={},users=['owner','player','viewer'],fixedPort?:number):Promise<Backend>{
  const exe=build(),dir=mkdtempSync(join(tmpdir(),'dnd-go-db-')),database=join(dir,'dnd.db'),port=fixedPort??await freePort();
  const base={...process.env,DND_DATABASE:database,DND_LOG_LEVEL:'error',...env};
  const created:Record<string,TestUser>={};
  for(const name of users){const out=JSON.parse(execFileSync(exe,['-create-user',name],{cwd:dir,env:base}).toString());created[name]={id:out.user.id,name,token:out.token};}
  const child:ChildProcess=spawn(exe,[],{cwd:dir,env:{...base,DND_LISTEN:`127.0.0.1:${port}`},stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr?.on('data',chunk=>{stderr+=chunk;});
  const origin=`http://127.0.0.1:${port}`;
  for(let i=0;;i++){
    try{if((await fetch(origin+'/health')).ok)break;}catch{/* starting */}
    if(i>100||child.exitCode!==null)throw new Error('backend did not start: '+stderr);
    await new Promise(r=>setTimeout(r,100));
  }
  return {baseUrl:origin+'/api/v1',origin,users:created,dir,async stop(){child.kill('SIGTERM');await new Promise(r=>child.exitCode!==null?r(null):child.once('exit',r));rmSync(dir,{recursive:true,force:true});}};
}
/** Node WebSocket with Bearer header (browsers use the HttpOnly cookie instead). */
export const bearerSocket=(token:string)=>(url:string)=>new (WebSocket as any)(url,{headers:{Authorization:`Bearer ${token}`}});
