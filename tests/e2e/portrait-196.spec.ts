import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter,type Character} from '../../src/core/model';
import {exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
// 玩家反馈：绑定棋子的角色卡打不开，提示「枭熊角色读取失败：Error: 头像数据无效。」，
// 而玩家并没有更换过头像。这里固定两条边界：棋子图片只是显示回退，绝不写进角色；
// 已损坏的头像字段不再让整张卡打不开。
const tokenUrl='https://assets.example.com/token-portrait.png';
const session='portrait196';
async function openBoundCard(page:Page,baseURL:string|undefined,portrait?:Character['portrait']){
  await mockSource(page);
  await page.goto(baseURL+'/#suite='+session+'&bridge='+encodeURIComponent(new URL(baseURL!).origin));
  await expect(page.locator('.app-shell')).toBeVisible();
  const c=newCharacter();c.name='绑定棋子英雄';if(portrait)c.portrait=portrait;
  const state={key:'room:card:one',itemId:'card:one',cardId:'one',kind:'character',name:c.name,role:'PLAYER',write:true,pinned:true,locked:false,documentRevision:1,stats:{health:10,'max health':20,'temporary health':0,'armor class':12},resources:[],conditions:[],tokenPortrait:{url:tokenUrl,width:256,height:256}};
  const document={...exportOwlbear(c,evaluate(c)),dnd_card_web:structuredClone(c),_suiteRevision:1};
  await page.evaluate(({state,document,session})=>{
    const emit=(type:string,payload:any)=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session,hostStarted:196,type,...payload}}));
    (window as any).saves=[];
    window.addEventListener('message',event=>{if(event.data?.type==='save')(window as any).saves.push(event.data);});
    emit('ready',{});
    emit('catalog',{sequence:1,role:'PLAYER',cards:[{...state,id:'one',inScene:true}],monsters:[],enabled:{},visibility:{wiki:true,monsters:true}});
    emit('selection',{sequence:2,state,document});
    emit('navigate',{});
  },{state,document,session});
  await page.getByRole('tab',{name:c.name,exact:true}).click();
  await expect(page.locator('.identity-name')).toContainText(c.name);
}
test('棋子图片回退只用于显示，不会当成头像数据写进角色',async({page,baseURL})=>{
  await openBoundCard(page,baseURL);
  await expect(page.getByAltText('角色头像')).toHaveAttribute('src',tokenUrl);
  await page.getByRole('switch',{name:'编辑模式'}).click();
  await page.locator('.portrait-view').hover();
  await page.mouse.wheel(0,-300);
  await page.waitForTimeout(400);
  expect(JSON.stringify(await page.evaluate(()=>(window as any).saves))).not.toContain(tokenUrl);
  await expect(page.locator('.portrait-move')).toHaveCount(0);
  await page.screenshot({path:test.info().outputPath('196-fallback-only.png')});
});
test('无法读取的头像不再让整张角色卡打不开',async({page,baseURL})=>{
  await openBoundCard(page,baseURL,{data:tokenUrl,x:0,y:0,zoom:1});
  await expect(page.locator('.suite-toast')).toContainText('头像');
  await expect(page.locator('.suite-toast')).not.toContainText('读取失败');
  await expect(page.locator('.identity-name')).toContainText('绑定棋子英雄');
  await page.screenshot({path:test.info().outputPath('196-repaired-card.png')});
});
test('本机工作区里的坏头像不会让整个工作区打不开',async({page})=>{
  await mockSource(page);
  await page.goto('/');
  await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
  const c=newCharacter();c.name='本机角色';c.portrait={data:tokenUrl,x:0,y:0,zoom:1};
  await page.evaluate(async character=>{
    const request=indexedDB.open('dnd-card-workspace',1);
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({schemaVersion:1,characters:[character],activeId:character.id,packs:[]},'workspace');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
    db.close();
  },c);
  await page.reload();
  await expect(page.locator('.suite-toast')).toContainText('图片数据无法读取');
  await expect(page.getByLabel('角色姓名')).toHaveValue('本机角色');
});
