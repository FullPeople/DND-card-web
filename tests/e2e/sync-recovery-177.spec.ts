import {test,expect,type Page} from '@playwright/test';
import {newCharacter} from '../../src/core/model';
import {exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
import {mockSource} from './fixtures';
const session='uncertain177';
const c=newCharacter();c.name='确认丢失验收';c.runtime.hp=5;c.baseHp=20;
const target={key:'r:card:one',itemId:'card:one',cardId:'one',name:c.name,kind:'character',role:'GM',write:true,documentRevision:1,stats:{health:5,'max health':20},resources:[]};
const doc=(hp:number,revision:number)=>{const native=structuredClone(c);native.runtime.hp=hp;return {...exportOwlbear(native,evaluate(native)),dnd_card_web:native,_suiteRevision:revision};};
async function host(page:Page,type:string,fields:Record<string,unknown>={}){await page.evaluate(({type,fields,session})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session,hostStarted:100,type,...fields}})),{type,fields,session});}
for(const recovery of ['ack','readback','adopt'] as const)test(`unknown save preserves local edits and safely unlocks after ${recovery}`,async({page})=>{
 await page.clock.install();await mockSource(page);await page.goto('/#suite='+session+'&bridge='+encodeURIComponent(String(test.info().project.use.baseURL)));await expect(page.locator('.app-shell')).toBeVisible();
 await page.evaluate(()=>{(window as any).sent=[];window.addEventListener('message',event=>{if(event.data?.type==='save')(window as any).sent.push(event.data);});});
 await host(page,'ready');await host(page,'catalog',{sequence:1,role:'GM',cards:[{...target,id:'one',inScene:true,locked:false}],monsters:[],enabled:{},visibility:{wiki:true,monsters:true}});await host(page,'selection',{sequence:2,state:target,document:doc(5,1)});await host(page,'navigate');
 const hp=page.getByLabel('当前生命值',{exact:true});await expect(hp).toHaveValue('5');await hp.fill('17');await hp.blur();await page.clock.runFor(600);await expect.poll(()=>page.evaluate(()=>(window as any).sent.length)).toBe(1);
 await page.clock.fastForward(181000);await expect(page.locator('.save-status')).toContainText('待核对');await expect(hp).toHaveValue('17');
 await host(page,'ready');await host(page,'selection',{sequence:10,state:target,document:doc(5,1)});await expect(hp).toHaveValue('17');
 const requestId=await page.evaluate(()=>(window as any).sent[0].requestId);await host(page,'ack',{requestId,ok:false,uncertain:true,message:'写入结果待核对'});await expect(hp).toHaveValue('17');await expect(page.locator('.save-status')).toContainText('待核对');if(recovery==='ack')await host(page,'ack',{requestId,ok:true,result:{snapshot:{sequence:11,state:{...target,documentRevision:2,stats:{health:17,'max health':20}},document:doc(17,2)}}});
 else if(recovery==='readback')await host(page,'selection',{sequence:11,state:{...target,documentRevision:2,stats:{health:17,'max health':20}},document:doc(17,2)});
 else await page.getByRole('button',{name:'核对并采用枭熊数据'}).click();
 await expect(hp).toHaveValue(recovery==='adopt'?'5':'17');await expect(page.locator('.save-status')).not.toContainText('待核对');await expect(page.getByRole('button',{name:'核对并采用枭熊数据'})).toHaveCount(0);
 await hp.fill('18');await hp.blur();await page.clock.runFor(600);await expect.poll(()=>page.evaluate(()=>(window as any).sent.length)).toBe(2);
});
