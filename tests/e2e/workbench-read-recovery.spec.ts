import {test,expect,type Page} from '@playwright/test';
import {newCharacter} from '../../src/core/model';
import {evaluate} from '../../src/core/engine';
import {exportOwlbear} from '../../src/core/export';
import {mockSource} from './fixtures';
const protocol='full-suite-workbench/v1',session='read-recovery';
const access={room:'synthetic-room',scope:'synthetic-room:scene',epoch:1,role:'PLAYER',cards:[{id:'missing',itemId:'token',write:true,locked:false}],monsters:[],enabled:{characterCards:true}};
async function send(host:Page,type:string,extra:any={}){await host.evaluate(({protocol,session,type,extra})=>(window as any).viewer.postMessage({protocol,session,type,hostStarted:1,...extra},location.origin),{protocol,session,type,extra});}
async function pair(host:Page){
 await mockSource(host);await host.route('**/read-recovery-host',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic read failure host</title>'}));await host.goto('/read-recovery-host');
 await host.evaluate(({protocol,session})=>{(window as any).requests=[];window.addEventListener('message',event=>{const m=event.data;if(m?.protocol!==protocol||m.session!==session)return;(window as any).requests.push(m);if(m.type==='hello'||m.type==='ping')(event.source as Window).postMessage({protocol,session,hostStarted:1,type:m.type==='hello'?'ready':'pong'},location.origin);});},{protocol,session});
 const opened=host.context().waitForEvent('page');await host.evaluate(session=>{(window as any).viewer=window.open('/#suite='+session+'&bridge='+encodeURIComponent(location.origin));},session);const page=await opened;await mockSource(page);await expect(page.locator('.app-shell')).toBeVisible();
 await send(host,'catalog',{sequence:1,access,cards:[{id:'missing',name:'Missing test card',itemId:'token',write:true,locked:false,inScene:true,resources:[],stats:{}}],monsters:[],role:'PLAYER',enabled:{characterCards:true},visibility:{wiki:true,monsters:false}});await send(host,'navigate',{itemId:'card:missing'});
 await send(host,'selectionError',{sequence:2,access,targetId:'card:missing',clientSelection:0,status:404,message:'synthetic missing',diagnostic:{status:404,code:'CARD_READ_FAILED',requestId:'synthetic-read-1',version:'1.0.243-dev',url:'https://private.invalid/?token=do-not-copy',document:{name:'private character'}}});return page;
}
for(const width of [1280,390])test(`404 has a usable recovery surface at ${width}px and retry restores the card`,async({page:host},info)=>{
 const page=await pair(host);await page.setViewportSize({width,height:900});await expect(page.getByRole('heading',{name:'这张角色卡暂时无法读取'})).toBeVisible();await expect(page.getByText('读取角色资料…',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'复制诊断信息',exact:true})).toBeVisible();
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(Error('denied'))}}));await page.getByRole('button',{name:'复制诊断信息',exact:true}).click();const diagnostic=page.getByRole('textbox',{name:'同步诊断信息'});await expect(diagnostic).toBeVisible();const copied=await diagnostic.inputValue();expect(copied).toContain('CARD_READ_FAILED');expect(copied).toContain('404');expect(copied).not.toMatch(/do-not-copy|private.invalid|private character/);
 await info.attach(`read-error-${width}`,{body:await page.screenshot({path:info.outputPath(`read-error-${width}.png`)}),contentType:'image/png'});await page.getByRole('button',{name:'重试读取这张卡',exact:true}).click();await expect.poll(()=>host.evaluate(()=>(window as any).requests.filter((m:any)=>m.type==='refreshCard').length)).toBe(1);
 await page.screenshot({path:info.outputPath(`read-retry-${width}.png`)});
 const request=await host.evaluate(()=>(window as any).requests.find((m:any)=>m.type==='refreshCard'));const character=newCharacter();character.name='Recovered test card';character.baseHp=20;character.runtime.hp=12;await send(host,'ack',{requestId:request.requestId,ok:true,result:{snapshot:{sequence:3,access,state:{key:'synthetic-room:card:missing',targetId:'card:missing',cardId:'missing',itemId:'token',name:character.name,kind:'character',role:'PLAYER',write:true,locked:false,pinned:false,stats:{health:12,'max health':20},resources:[]},document:{...exportOwlbear(character,evaluate(character)),dnd_card_web:character,_suiteRevision:1}}}});
 await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('12');await expect(page.getByRole('heading',{name:'这张角色卡暂时无法读取'})).toHaveCount(0);expect(await host.evaluate(()=>(window as any).requests.filter((m:any)=>['delete','save','stats'].includes(m.type)).length)).toBe(0);
 await page.screenshot({path:info.outputPath(`read-restored-${width}.png`)});
});
