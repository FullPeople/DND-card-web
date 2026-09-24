import {chromium,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {spawn} from 'node:child_process';
const out=resolve('test-results/native-dialog');mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=createServer((req,res)=>{try{const file=join(resolve('dist'),new URL(req.url,'http://local').pathname==='/'?'index.html':new URL(req.url,'http://local').pathname);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(5211,'127.0.0.1',r));
const instance=await chromium.launchServer({channel:'msedge',headless:false,args:['--window-size=1400,1000']});
const browser=await chromium.connect(instance.wsEndpoint()),context=await browser.newContext({viewport:{width:1400,height:950}}),page=await context.newPage();
try{
 await context.route('https://5e.kiwee.top/**',route=>route.fulfill({json:{},headers:{'access-control-allow-origin':'*'}}));
 await page.goto('http://127.0.0.1:5211/');await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 const cdp=await context.newCDPSession(page);await cdp.send('Page.setInterceptFileChooserDialog',{enabled:false});
 const browserCDP=await browser.newBrowserCDPSession(),info=await browserCDP.send('SystemInfo.getProcessInfo');const nativePID=info.processInfo.find(p=>p.type==='browser').id;console.log('Native browser PID',nativePID,'launcher',instance.process().pid);
 const cancel=new Promise((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-File',resolvePath('tests/native-dialog-cancel.ps1'),'-BrowserProcessId',String(nativePID)],{windowsHide:true});let output='';child.stdout.on('data',v=>output+=v);child.stderr.on('data',v=>output+=v);child.on('exit',code=>code===0?resolve(output):reject(Error(output)));});
 const [native]=await Promise.all([cancel,page.getByRole('button',{name:'导入完整备份',exact:true}).click({timeout:23000})]);
 const finished=performance.now();await page.getByRole('button',{name:'关闭弹窗',exact:true}).click({timeout:2500});await page.getByRole('button',{name:'角色簿',exact:false}).click({timeout:2500});
 const elapsed=performance.now()-finished;await expect(page.getByRole('heading',{name:'角色簿',exact:true})).toBeVisible();await page.screenshot({path:join(out,'native-cancel.png')});
 writeFileSync(join(out,'result.json'),JSON.stringify({nativeWindowsDialog:true,actionableAfterCancelMs:Math.round(elapsed),native:String(native).trim()},null,2));console.log('PASS native Windows cancel; subsequent two page clicks in '+Math.round(elapsed)+' ms');
}finally{await browser.close();await instance.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
function resolvePath(path){return resolve(path);}
