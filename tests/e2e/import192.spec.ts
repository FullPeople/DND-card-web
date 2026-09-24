import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter} from '../../src/core/model';
import {exportCharacter,exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
const card=newCharacter();card.name='导入验收角色';card.player='测试玩家';card.abilities.int=18;card.baseHp=24;card.runtime.hp=17;card.runtime.resources={test:{name:'测试资源',current:2,max:3,type:'count'}};
async function setup(page:Page,url:string,role='PLAYER',connected=true){
 await mockSource(page);const target=new URL(url);target.hash='suite=import192&bridge='+encodeURIComponent(target.origin);await page.goto(target.href);await expect(page.locator('.app-shell')).toBeVisible();
 await page.evaluate(({role,connected})=>{
  const w=window as any;w.creates=[];w.cards=[];w.docs={};let sequence=0;
  const emit=(type:string,payload:any={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session:'import192',hostStarted:192,type,...payload}}));
  const catalog=()=>emit('catalog',{sequence:++sequence,role,cards:w.cards,monsters:[],enabled:{characterCards:true},visibility:{wiki:true,monsters:true}});
  w.finish=(fail=false)=>{const m=w.creates.at(-1);if(fail){emit('ack',{requestId:m.requestId,ok:false,message:'测试拒绝创建'});return;}const id='created-'+w.creates.length;w.docs['card:'+id]=m.data;w.cards.push({id,cardId:id,itemId:'card:'+id,key:'room:card:'+id,name:m.data.identity.character_name,kind:'character',role,write:true,inScene:false,locked:false,documentRevision:1,resources:[],stats:{}});emit('ack',{requestId:m.requestId,ok:true,result:{created:{id}}});catalog();};
  window.addEventListener('message',event=>{const m=event.data;if(m?.protocol!=='full-suite-workbench/v1'||m.session!=='import192')return;if(m.type==='ping')emit('pong');if(m.type==='createCard')w.creates.push(m);if(m.type==='select'){const data=w.docs[m.itemId],state=w.cards.find((c:any)=>c.itemId===m.itemId);if(data)emit('selection',{sequence:++sequence,state,document:{...data,_suiteRevision:1}});}});
  if(connected){emit('ready');catalog();}
 },{role,connected});await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
}
async function upload(page:Page){await page.getByTestId('character-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(card)))});}
for(const legacy of [false,true])test(legacy?'Owlbear pasted JSON creates a shared character':'complete backup creates a shared character without a selected token',async({page,baseURL})=>{
 await setup(page,baseURL!,legacy?'GM':'PLAYER');
 if(legacy){await page.getByLabel('枭熊 JSON 文本').fill(JSON.stringify(exportOwlbear(card,evaluate(card))));await page.getByRole('button',{name:'从文本导入枭熊',exact:true}).click();}else await upload(page);
 await expect.poll(()=>page.evaluate(()=>(window as any).creates.length)).toBe(1);await expect(page.getByText('角色已导入枭熊角色簿。',{exact:true})).toHaveCount(0);
 const sent=await page.evaluate(()=>(window as any).creates[0]);expect(sent.key).toBeUndefined();expect(sent.itemId).toBeUndefined();expect(sent.data.dnd_card_web.abilities.int).toBe(18);expect(sent.data.dnd_card_web.runtime.hp).toBe(17);expect(sent.data.dnd_card_web.id).not.toBe(card.id);
 if(!legacy)expect(sent.data.dnd_card_web.runtime.resources.test.current).toBe(2);
 await page.evaluate(()=>(window as any).finish());await expect(page.getByRole('tab',{name:'导入验收角色（导入）',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'角色名',exact:true}).getByRole('button',{name:'导入验收角色（导入）',exact:true})).toBeVisible();await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('17');
 await page.getByRole('button',{name:/角色簿/}).click();await expect(page.locator('.character-list')).toContainText('导入验收角色（导入）');
});
test('host rejection keeps import open, reports failure and creates no hidden local copy',async({page,baseURL})=>{
 await setup(page,baseURL!);await upload(page);await expect.poll(()=>page.evaluate(()=>(window as any).creates.length)).toBe(1);await page.evaluate(()=>(window as any).finish(true));await expect(page.getByRole('alert')).toContainText('测试拒绝创建');await expect(page.getByText('角色已作为新副本导入。',{exact:true})).toHaveCount(0);
 const names=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const req=indexedDB.open('dnd-card-workspace');req.onsuccess=()=>resolve(req.result);});return new Promise<string[]>(resolve=>{const req=db.transaction('documents').objectStore('documents').get('workspace');req.onsuccess=()=>{db.close();resolve(req.result.characters.map((c:any)=>c.name));};});});expect(names).not.toContain('导入验收角色（导入）');
});
test('disconnected import reports failure instead of local success',async({page,baseURL})=>{
 await setup(page,baseURL!,'PLAYER',false);await upload(page);await expect(page.getByRole('alert')).toContainText('枭熊未连接');expect(await page.evaluate(()=>(window as any).creates.length)).toBe(0);
});
