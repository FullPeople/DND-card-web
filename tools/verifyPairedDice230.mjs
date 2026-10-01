// Real Web DiceFrame, Suite diceRpc/history/token/overlay and installed SDK.
// Synthetic room postMessage transport; physics renderer/controller boundaries
// are inert because this check concerns history labels, not physical rolling.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join,resolve,dirname,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
const input=new Map();for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i];if(!key?.startsWith('--')||!process.argv[i+1])throw Error('Use --suite <path> --sha <full SHA> --dice-build <path> --dev-build <path> [--out <path>]');input.set(key.slice(2),process.argv[i+1]);}
const required=key=>{const value=input.get(key);if(!value)throw Error('Missing --'+key);return value;};
const web=resolve(import.meta.dirname,'..'),suite=resolve(required('suite')),expectedSha=required('sha');
if(!/^[a-f0-9]{40}$/.test(expectedSha))throw Error('--sha must be an exact full lowercase commit SHA');
const actualSha=execFileSync('git',['-C',suite,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(actualSha!==expectedSha)throw Error('Suite source mismatch: '+actualSha+' vs '+expectedSha);
const suiteTrackedStatus=()=>execFileSync('git',['-C',suite,'status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim();
if(suiteTrackedStatus())throw Error('Suite tracked source must be clean before paired verification');
const rebuilt=resolve(required('dice-build')),dev=resolve(required('dev-build')),out=resolve(input.get('out')||join(web,'.local-evidence/paired-dice230-'+expectedSha.slice(0,12)));
if(out===suite||out.startsWith(suite+'/'))throw Error('Output must be outside the Suite checkout');
for(const file of [join(rebuilt,'workbench-dice/index.html'),join(dev,'workbench-launcher.html')])if(!existsSync(file))throw Error('Missing prebuilt production entry: '+file);
mkdirSync(out,{recursive:true});
const reqSuite=createRequire(join(suite,'package.json')),reqWeb=createRequire(join(web,'package.json'));
const {build}=await import(pathToFileURL(reqSuite.resolve('rolldown')).href),{createServer:createVite}=await import(pathToFileURL(reqWeb.resolve('vite')).href),browserType=reqWeb('@playwright/test')[process.env.PAIRED_DICE_BROWSER||'chromium'];
if(!browserType)throw Error('Unsupported PAIRED_DICE_BROWSER');
await build({input:join(suite,'tools/workbench-dice3d-vite.ts'),platform:'node',external:['vite'],output:{file:join(out,'adapter.mjs'),format:'esm'},logLevel:'warn'});
const {workbenchDice3dPlugin}=await import(pathToFileURL(join(out,'adapter.mjs')).href);const adapter=workbenchDice3dPlugin(true),styles=[];
const entry=join(out,'sdk-host.ts');writeFileSync(entry,`
import OBR from '@owlbear-rodeo/sdk';
import {setupWorkbenchDice,getRollHistory,rollListeners,canForwardDiceHistory} from '${suite}/src/workbench/dice';
import {diceRpc,DICE_EVENTS} from '${suite}/src/workbench/dice-rpc';
import {mountOverlay} from '${suite}/extensions/workbench-dice3d/src/overlay';
const g=window as any,protocol='full-suite-workbench/v1',session='suite-web-dice230';let client:Window|undefined;
const send=(type:string,payload={})=>client?.postMessage({protocol,session,type,hostStarted:230,...payload},location.origin);
window.addEventListener('message',async e=>{const m=e.data;if(e.origin!==location.origin||m?.protocol!==protocol||m.session!==session)return;client=e.source as Window;
 if(m.type==='hello'){send('ready',{rolls:getRollHistory()});send('catalog',{sequence:1,cards:[],monsters:[],role:'GM',enabled:{dice:true}});}
 if(m.type==='ping')send('pong');
 if(m.type==='diceRpc'){try{const result=await diceRpc(m.method,m.args,undefined,async()=>{});send('ack',{requestId:m.requestId,ok:true,result});}catch(error){send('ack',{requestId:m.requestId,ok:false,message:String(error)});}}
});
OBR.onReady(async()=>{await setupWorkbenchDice();await mountOverlay(document.body,'local');for(const name of DICE_EVENTS)OBR.broadcast.onMessage(name,event=>{if(name==='com.obr-suite/dice-roll'&&!canForwardDiceHistory(event))return;send('diceEvent',{event:name,data:event});});rollListeners.add(()=>send('rolls',{rolls:getRollHistory()}));g.integration={seed:async rows=>{for(const row of rows)await OBR.broadcast.sendMessage('com.obr-suite/dice-roll',row,{destination:'LOCAL'});},groupControl:(cid,action)=>OBR.broadcast.sendMessage('com.obr-suite/workbench/group-result-control',{id:cid,action},{destination:'LOCAL'}),open:()=>window.open('/integration-web#suite='+session+'&bridge='+encodeURIComponent(location.origin),'suite-web-dice230')};g.integrationReady=true;});
`);
const plugins=[{name:'sdk-and-physics-boundaries',resolveId(id,importer){
 if(id.endsWith('.css'))return '\0css:'+resolve(dirname(importer),id)+'.js';
 if(id.endsWith('?raw'))return this.resolve(id.slice(0,-4),importer,{skipSelf:true}).then(r=>r&&'\0raw:'+r.id);
 if(id.endsWith('/src/controller'))return '\0controller';
 if(importer?.endsWith('/src/overlay.ts')&&['./renderer','./audio-host','./asset-loading','./asset-catalog'].includes(id))return '\0'+id.slice(2);
 if(id==='events')return reqSuite.resolve('events/');
 if(id==='three')return join(dirname(reqSuite.resolve('three')),'three.module.js');
 if(!id.startsWith('.')&&!id.startsWith('/')&&!id.startsWith('\0')&&!id.includes(':'))return reqSuite.resolve(id);
 },load(id){
 if(id.startsWith('\0css:')){styles.push(readFileSync(id.slice(5,-3),'utf8'));return '';}
 if(id.startsWith('\0raw:'))return 'export default '+JSON.stringify(readFileSync(id.slice(5),'utf8'));
 if(id==='\0controller')return `export class Controller{constructor(transport){this.bus=new BroadcastChannel('com.obr-suite/workbench-dice3d.v1:local:'+transport.id)}async init(){this.bus.postMessage({type:'state',state:{ready:true,physics:true,overlay:true,error:''}})}dispose(){this.bus.close()}setProfile(){return Promise.resolve()}fail(){}}`;
 if(id==='\0renderer')return `export class DiceRenderer{constructor(container,catalog,notify){this.notify=notify}async init(){this.notify('renderer-ready',{})}clear(){}}`;
 if(id==='\0audio-host')return 'export const mountAudioHost=()=>({warmup:async()=>{}});';
 if(id==='\0asset-loading')return `export class DiceAssets{plan(){}stage(){}async bytes(){return(await fetch('/font.ttf')).arrayBuffer()}}`;
 if(id==='\0asset-catalog')return 'export const diceCatalog=()=>({themes:{},dice:{}});';
 },transform(code,id){code=code.replaceAll('import.meta.env.BASE_URL',JSON.stringify('/suite-dev/')).replaceAll('import.meta.env.DEV','false').replaceAll('process.env.NODE_ENV',JSON.stringify('production'));return adapter.transform(code,id)||code;}}];
await build({input:entry,plugins,output:{file:join(out,'sdk-host.js'),format:'esm',codeSplitting:false},logLevel:'warn'});writeFileSync(join(out,'style.css'),styles.join('\n'));
const roomScript=`window.sdkRpc=[];window.sdkMessages=[];window.held=[];window.holdReplay=false;window.player={id:'owner',connectionId:'local',name:'Synthetic GM',color:'#ffffff',role:'GM',metadata:{},selection:[],syncView:false};
window.emit=(id,data)=>{for(const f of document.querySelectorAll('iframe'))f.contentWindow.postMessage({id,data},location.origin)};
window.flush=()=>{for(const f of window.held.splice(0))f()};
window.addEventListener('message',e=>{const m=e.data;if(!m?.id)return;if(m.id==='OBR_CONNECT'){e.source.postMessage({id:'OBR_READY',data:{ref:'integration-room',userId:'owner'}},e.origin);return;}if(!m.nonce)return;window.sdkRpc.push(m.id);let data={};const p=window.player;
switch(m.id){case'OBR_PLAYER_GET_ID':data={id:p.id};break;case'OBR_PLAYER_GET_CONNECTION_ID':data={connectionId:p.connectionId};break;case'OBR_PLAYER_GET_ROLE':data={role:p.role};break;case'OBR_PLAYER_GET_NAME':data={name:p.name};break;case'OBR_PLAYER_GET_COLOR':data={color:p.color};break;case'OBR_PLAYER_GET_METADATA':data={metadata:p.metadata};break;case'OBR_PLAYER_GET_SELECTION':data={selection:[]};break;case'OBR_PARTY_GET_PLAYERS':data={players:[]};break;case'OBR_SCENE_IS_READY':data={ready:true};break;case'OBR_SCENE_GET_METADATA':case'OBR_ROOM_GET_METADATA':data={metadata:{}};break;case'OBR_SCENE_ITEMS_GET_ALL_ITEMS':case'OBR_SCENE_ITEMS_GET_ITEMS':data={items:[{id:'unit',visible:true,position:{x:220,y:300},metadata:{}}]};break;case'OBR_VIEWPORT_GET_POSITION':data={position:{x:0,y:0}};break;case'OBR_VIEWPORT_GET_SCALE':data={scale:1};break;case'OBR_VIEWPORT_GET_WIDTH':data={width:innerWidth};break;case'OBR_VIEWPORT_GET_HEIGHT':data={height:innerHeight};break;case'OBR_SCENE_GRID_GET_DPI':data={dpi:150};break;case'OBR_BROADCAST_SEND_MESSAGE':window.sdkMessages.push(m.data);const delivery=()=>{if(m.data.options?.destination!=='REMOTE')window.emit('OBR_BROADCAST_MESSAGE_'+m.data.channel,{connectionId:'local',data:m.data.data})};if(window.holdReplay&&m.data.channel==='com.obr-suite/dice-replay'){window.held.push(delivery,()=>e.source.postMessage({id:m.id+'_RESPONSE'+m.nonce,data},e.origin));return;}delivery();break;}
e.source.postMessage({id:m.id+'_RESPONSE'+m.nonce,data},e.origin);});`;
const vite=await createVite({root:web,configFile:join(web,'vite.config.ts'),server:{middlewareMode:true,fs:{allow:[web,suite]}},appType:'custom'});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.md':'text/plain; charset=utf-8','.json':'application/json'};let origin='';
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;let file;
 if(p==='/room'){const ref=Buffer.from(origin+' integration-room').toString('base64');res.setHeader('Content-Type',mime['.html']);res.end('<meta charset="utf-8"><style>body{margin:0;background:#393b40}#sdk-host{position:absolute;inset:0;width:100%;height:100%;border:0}#action{position:absolute;right:0;top:0;width:360px;height:650px;border:0}</style><script>'+roomScript+'</script><iframe id="sdk-host" src="/sdk-host?obrref='+ref+'"></iframe><iframe id="action" src="/suite-dev/workbench-launcher.html?obrref='+ref+'"></iframe>');return;}
 if(p==='/sdk-host'){res.setHeader('Content-Type',mime['.html']);res.end('<meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#393b40}</style><link rel="stylesheet" href="/style.css"><script type="module" src="/sdk-host.js"></script>');return;}
 if(p==='/integration-web'){res.setHeader('Content-Type',mime['.html']);res.end('<div id="root"></div><style>iframe{width:100%;height:calc(100dvh - 40px);border:0}.workbench-dice{display:block;padding:0}</style><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import("/tests/e2e/harness/dice-frame230.tsx");</script>');return;}
 if(p==='/sdk-host.js'||p==='/style.css')file=join(out,p.slice(1));
 if(p==='/font.ttf')file=join(suite,'extensions/workbench-dice3d/public/assets/fonts/Cinzel-Variable.ttf');
 if(p.startsWith('/workbench-dice/'))file=join(rebuilt,p.slice(1));
 if(p.startsWith('/suite-dev/'))file=join(dev,p.slice('/suite-dev/'.length));
 if(file){if(!existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(readFileSync(file));return;}vite.middlewares(req,res);
});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
const browser=await browserType.launch({...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),headless:true}),checks=[],errors=[];const check=(name,passed,detail={})=>{checks.push({name,passed,...detail});console.log(JSON.stringify(checks.at(-1)))};
try{for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:850}}),room=await context.newPage();room.on('pageerror',e=>errors.push(e.message));await room.goto(origin+'/room');const host=room.frameLocator('#sdk-host'),action=room.frameLocator('#action');await host.locator('body').evaluate(()=>{});await room.evaluate(()=>window.emit('OBR_READY',{ref:'integration-room',userId:'owner'}));await room.frames().find(f=>f.url().includes('/sdk-host?')).waitForFunction(()=>window.integrationReady);
 const waiting=context.waitForEvent('page');await host.locator('body').evaluate(()=>window.integration.open());const page=await waiting;page.on('pageerror',e=>errors.push(e.message));await page.getByLabel('桥接连接').waitFor();const panel=page.frameLocator('iframe');await panel.locator('body[data-bridge-ready="true"]').waitFor();
 const row=(rollId,total,extra={})=>({_3dConnection:'local',_3dRows:[{total,modifier:0}],rollId,rollerId:'owner',rollerName:'Synthetic GM',rollerColor:'#ffffff',itemId:'unit',expression:'1d20',label:rollId,total,modifier:0,winnerIdx:-1,dice:[{type:'d20',value:total}],ts:Date.now(),...extra});const rows=[row('single',16),row('second',20),row('member',14,{collectiveId:'group-synthetic'})];await host.locator('body').evaluate((_,rows)=>window.integration.seed(rows),rows);
 await panel.locator('.tab[data-tab="history"]').click();await panel.locator('.entry[data-cid="single"]').waitFor();const labels=host.locator('.token-result');
 await panel.locator('.entry[data-cid="single"]').click();await labels.first().waitFor();check(width+' Web panel single shows real Suite DOM',await labels.count()===1);
 await panel.locator('.entry[data-cid="single"]').click();await new Promise(r=>setTimeout(r,250));const afterSingle=await labels.evaluateAll(es=>es.map(e=>({group:e.getAttribute('data-group'),text:e.textContent,opacity:getComputedStyle(e).opacity}))),replayIntents=await room.evaluate(()=>window.sdkMessages.filter(m=>m.channel==='com.obr-suite/dice-replay'));check(width+' Web panel second click removes Suite DOM',await labels.count()===0,{replayIntents,remaining:afterSingle});await room.locator('#action').evaluate(e=>e.style.visibility='hidden');await room.screenshot({path:join(out,width+'-single-cancel.png')});await room.locator('#action').evaluate(e=>e.style.visibility='');await host.locator('body').evaluate(()=>window.integration.groupControl('group-synthetic','close'));await labels.waitFor({state:'detached'});
 await panel.locator('.entry[data-cid="group-synthetic"]').click();await labels.first().waitFor();check(width+' Web panel group is exclusive',await labels.count()===1);await panel.locator('.entry[data-cid="group-synthetic"]').click();await labels.waitFor({state:'detached'});check(width+' Web panel group second click removes DOM',await labels.count()===0);
 await action.getByRole('tab',{name:'历史',exact:true}).click();await action.locator('.row[data-cid="single"]').waitFor();await action.locator('.row[data-cid="single"]').click();await labels.first().waitFor();await action.locator('.row[data-cid="single"]').click();await labels.waitFor({state:'detached'});check(width+' Action history same row removes DOM',await labels.count()===0);
 await action.locator('.row[data-cid="single"]').click();await action.locator('.row[data-cid="second"]').click();await labels.locator('strong').filter({hasText:'20'}).waitFor();check(width+' Action switches history exclusively',await labels.count()===1);
 await action.locator('.row[data-cid="second"]').click();await labels.waitFor({state:'detached'});await room.evaluate(()=>{window.holdReplay=true;window.sdkMessages=[]});
 await action.locator('.row[data-cid="single"]').evaluate(e=>{e.dispatchEvent(new MouseEvent('click',{bubbles:true}));e.dispatchEvent(new MouseEvent('click',{bubbles:true}))});await room.waitForFunction(()=>window.sdkMessages.filter(m=>m.channel==='com.obr-suite/dice-replay').length>=2);
 const intent=await room.evaluate(()=>window.sdkMessages.filter(m=>m.channel==='com.obr-suite/dice-replay').map(m=>m.data));await room.evaluate(()=>{window.holdReplay=false;window.flush()});await new Promise(r=>setTimeout(r,150));check(width+' Action rapid double click cancels after delayed SDK delivery',await labels.count()===0,{intent,remaining:await labels.count()});
 await room.screenshot({path:join(out,width+'-room.png')});await page.screenshot({path:join(out,width+'-web-history.png')});await context.close();
}check('no browser script errors',errors.length===0,{errors});
}catch(error){checks.push({name:'integration execution',passed:false,error:String(error)});throw error;}finally{writeFileSync(join(out,'results.json'),JSON.stringify({suiteSource:suite,suiteSha:actualSha,webSha:execFileSync('git',['-C',web,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:await browser.version(),installedSdk:true,productionWebBridge:true,productionSuiteDiceRpc:true,productionSuiteHistory:true,productionOverlayLabels:true,physicalRendererReplaced:true,controllerReplaced:true,realOwlbearRoom:false,checks,errors},null,2));await browser.close();await vite.close();server.closeAllConnections();await new Promise(r=>server.close(r));}

if(suiteTrackedStatus())throw Error('Suite tracked source changed during paired verification');
console.log(JSON.stringify({suiteSha:actualSha,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,out}));
if(checks.some(c=>!c.passed))process.exitCode=1;
