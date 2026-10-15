import {test,expect,type Page} from '@playwright/test';
import {newCharacter,type Entry} from '../../src/core/model';
import {exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
import {mockSource} from './fixtures';
const protocol='full-suite-workbench/v1',session='instant217';
const auth=(epoch=1,ids=['a','b'])=>({room:'room',scope:'room:scene',epoch,role:'GM',enabled:{characterCards:true},cards:ids.map(id=>({id,itemId:'token-'+id,write:true,locked:false})),monsters:[]});
function snapshot(id:string,revision=1,hp=id==='a'?11:22){
 const c=newCharacter();c.name='缓存验收 '+id;c.baseHp=40;c.runtime.hp=hp;
 for(let i=0;i<85;i++){const e:Entry={id:'fixture:'+id+':'+i,kind:'feature',name:`原创负载 ${i}`,english:`Fixture ${i}`,source:'IMPORTED',edition:'both',packId:'imported',revision:'1',raw:{},entries:['原创缓存验收正文。'.repeat(12)]};c.selections.push({id:e.id,entry:e,quantity:1,level:1,equipped:false});}
 return {state:{key:'room:card:'+id,cardId:id,itemId:'token-'+id,name:c.name,kind:'character',role:'GM',write:true,locked:false,pinned:false,documentRevision:revision,stats:{health:hp,'max health':40,'temporary health':0,'armor class':10},resources:[],conditions:[]},document:{...exportOwlbear(c,evaluate(c)),dnd_card_web:c,_suiteRevision:revision}};
}

const saves=(host:Page)=>host.evaluate(()=>(window as any).requests.filter((m:any)=>m.type==='save'));
async function editing(host:Page){const page=await pair(host);await page.getByRole('switch',{name:'编辑模式',exact:true}).click();return page;}
async function receipt(host:Page,request:any,name:string,player='',revision=2){const accepted=snapshot('a',revision);accepted.document.dnd_card_web.name=name;accepted.document.dnd_card_web.player=player;accepted.state.name=name;await send(host,'ack',{requestId:request.requestId,ok:true,result:{snapshot:{sequence:20+revision,...accepted,access:auth()}}});}

test('a later confirmed replacement of the failed field clears failure and accepts runtime updates',async({page:host})=>{
 const page=await editing(host);await page.getByLabel('角色姓名',{exact:true}).fill('Failed B');await expect.poll(()=>saves(host).then(rows=>rows.length)).toBe(1);const [first]=await saves(host);
 await send(host,'ack',{requestId:first.requestId,ok:false,message:'Synthetic terminal failure'});await expect(page.locator('.save-status')).toContainText('同步失败');
 await page.getByLabel('角色姓名',{exact:true}).fill('Confirmed C');await expect.poll(()=>saves(host).then(rows=>rows.length)).toBe(2);await receipt(host,(await saves(host))[1],'Confirmed C');
 await expect(page.getByLabel('角色姓名',{exact:true})).toHaveValue('Confirmed C');await expect(page.locator('.save-status')).not.toContainText('同步失败');
 await send(host,'cacheSnapshot',{sequence:30,...snapshot('a',3,7),access:auth()});await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('7');
});

test('replacing only one failed field keeps the other draft unresolved',async({page:host})=>{
 const page=await editing(host);await page.getByLabel('角色姓名',{exact:true}).fill('Failed B');await expect.poll(()=>saves(host).then(rows=>rows.length)).toBe(1);const [first]=await saves(host);
 await send(host,'ack',{requestId:first.requestId,ok:false,message:'Synthetic terminal failure'});await expect(page.locator('.save-status')).toContainText('同步失败');
 await page.getByLabel('玩家姓名',{exact:true}).fill('Unsent player');await expect.poll(()=>saves(host).then(rows=>rows.length)).toBe(2);await send(host,'ack',{requestId:(await saves(host))[1].requestId,ok:false,message:'Second terminal failure'});await expect(page.locator('.save-status')).toContainText('同步失败');
 await page.getByLabel('角色姓名',{exact:true}).fill('Confirmed C');await expect.poll(()=>saves(host).then(rows=>rows.length)).toBe(3);await receipt(host,(await saves(host))[2],'Confirmed C');
 await expect(page.locator('.save-status')).toContainText('同步失败');await expect(page.getByLabel('玩家姓名',{exact:true})).toHaveValue('Unsent player');
 await send(host,'cacheSnapshot',{sequence:30,...snapshot('a',3,7),access:auth()});await expect(page.getByLabel('玩家姓名',{exact:true})).toHaveValue('Unsent player');
});

test('a queued replacement succeeds after the earlier known failure without retaining obsolete intent',async({page:host})=>{
 const page=await editing(host);await page.getByLabel('角色姓名',{exact:true}).fill('Queued B');await expect.poll(()=>saves(host).then(rows=>rows.length)).toBe(1);const [first]=await saves(host);
 await page.getByLabel('角色姓名',{exact:true}).fill('Queued C');await page.waitForTimeout(180);expect((await saves(host)).length).toBe(1);
 await send(host,'ack',{requestId:first.requestId,ok:false,message:'Synthetic terminal failure'});await expect.poll(()=>saves(host).then(rows=>rows.length)).toBe(2);await receipt(host,(await saves(host))[1],'Queued C');
 await expect(page.getByLabel('角色姓名',{exact:true})).toHaveValue('Queued C');await expect(page.locator('.save-status')).not.toContainText('同步失败');
});

test('unknown writes stay protected from new edits and unrelated newer bodies',async({page:host})=>{
 const page=await editing(host);await page.getByLabel('角色姓名',{exact:true}).fill('Unknown B');await expect.poll(()=>saves(host).then(rows=>rows.length)).toBe(1);const [first]=await saves(host);
 await send(host,'ack',{requestId:first.requestId,ok:false,uncertain:true,message:'Synthetic unknown result'});await expect(page.locator('.save-status')).toContainText('待核对');
 await page.getByLabel('角色姓名',{exact:true}).fill('Must not be sent');await expect(page.getByLabel('角色姓名',{exact:true})).toHaveValue('Unknown B');
 await send(host,'cacheSnapshot',{sequence:10,...snapshot('a',2,7),access:auth()});await expect(page.locator('.save-status')).toContainText('待核对');expect((await saves(host)).length).toBe(1);
 await receipt(host,first,'Unknown B','',3);await expect(page.locator('.save-status')).not.toContainText('待核对');await expect(page.getByLabel('角色姓名',{exact:true})).toHaveValue('Unknown B');
});

for(const completion of ['ack','body'] as const)test(`a late first ${completion} cannot discard a blocked draft or revive a superseded confirmed field`,async({page:host})=>{
 const page=await editing(host);await page.getByLabel('角色姓名',{exact:true}).fill('Unknown B');await expect.poll(()=>saves(host).then(rows=>rows.length)).toBe(1);const [first]=await saves(host);
 await page.getByLabel('玩家姓名',{exact:true}).fill('Blocked player');await page.waitForTimeout(180);expect((await saves(host)).length).toBe(1);
 await send(host,'ack',{requestId:first.requestId,ok:false,uncertain:true,message:'Synthetic unknown result'});await expect(page.locator('.save-status')).toContainText('待核对');
 if(completion==='ack')await receipt(host,first,'Unknown B');else{const confirmed=snapshot('a',2);confirmed.document.dnd_card_web.name='Unknown B';confirmed.state.name='Unknown B';await send(host,'cacheSnapshot',{sequence:22,...confirmed,access:auth()});}
 await expect(page.locator('.save-status')).not.toContainText('待核对');
 await expect(page.getByLabel('玩家姓名',{exact:true})).toHaveValue('Blocked player');await expect(page.locator('.save-status')).toContainText('同步失败');expect((await saves(host)).length).toBe(1);
 // Another player changes the already-confirmed name while our player draft
 // remains local. Retrying that draft must not demand the old name back.
 const peer=snapshot('a',3);peer.document.dnd_card_web.name='Peer name';peer.state.name='Peer name';await send(host,'cacheSnapshot',{sequence:23,...peer,access:auth()});
 await page.getByLabel('玩家姓名',{exact:true}).fill('Confirmed player');await expect.poll(()=>saves(host).then(rows=>rows.length)).toBe(2);
 expect((await saves(host))[1].delta.native.some((row:any)=>row.path.join('.')==='name')).toBe(false);
 await receipt(host,(await saves(host))[1],'Peer name','Confirmed player',4);
 await expect(page.getByLabel('玩家姓名',{exact:true})).toHaveValue('Confirmed player');await expect(page.getByLabel('角色姓名',{exact:true})).toHaveValue('Peer name');await expect(page.locator('.save-status')).not.toContainText('同步失败');
});
async function send(host:Page,type:string,payload:any={}){await host.evaluate(({protocol,session,type,payload})=>(window as any).viewer.postMessage({protocol,session,type,hostStarted:217,...payload},location.origin),{protocol,session,type,payload});}
async function pair(host:Page){
 await mockSource(host);await host.route('**/instant-host217',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic delayed host</title>'}));await host.goto('/instant-host217');
 await host.evaluate(({protocol,session})=>{(window as any).requests=[];window.addEventListener('message',e=>{const m=e.data;if(m?.protocol!==protocol||m.session!==session)return;(window as any).requests.push({...m,at:performance.now()});if(m.type==='hello'||m.type==='ping')(e.source as Window).postMessage({protocol,session,type:m.type==='hello'?'ready':'pong',hostStarted:217},location.origin);});},{protocol,session});
 const waiting=host.context().waitForEvent('page');await host.evaluate(session=>{(window as any).viewer=window.open('/#suite='+session+'&bridge='+encodeURIComponent(location.origin)+'&measureSwitch=1','instant217');},session);const page=await waiting;await mockSource(page);await expect(page.locator('.app-shell')).toBeVisible();
 const a=snapshot('a'),b=snapshot('b');await send(host,'ready');await send(host,'catalog',{sequence:1,access:auth(),cards:[a,b].map(s=>({...s.state,id:s.state.cardId,inScene:true})),monsters:[],role:'GM',enabled:{characterCards:true},visibility:{wiki:true,monsters:true}});
 await send(host,'selection',{sequence:2,...a,access:auth()});await send(host,'cacheSnapshot',{sequence:3,...b,access:auth()});await send(host,'navigate');await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('11');return page;
}

