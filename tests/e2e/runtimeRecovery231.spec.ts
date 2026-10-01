import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Character,type Entry} from '../../src/core/model';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';

async function seed(page:Page,card:Character){
 await mockSource(page,{displayMode:'default'});await suppressAnnouncement(page);
 await page.addInitScript(card=>{
  const open=indexedDB.open('dnd-card-standalone',1);
  open.onupgradeneeded=()=>{open.result.createObjectStore('documents');open.result.createObjectStore('cache');};
  open.onsuccess=()=>{const db=open.result,tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents'),get=store.get('workspace');get.onsuccess=()=>{if(!get.result)store.put({schemaVersion:1,characters:[card],activeId:card.id,packs:[]},'workspace');};tx.oncomplete=()=>db.close();};
 },card);
}
const savedCard=()=>{const card=newCharacter();card.name='恢复验收角色';card.notes='保留笔记';card.runtime.resources.manual={name:'保留次数',current:2,max:5};return card;};

test('a failed editing library exposes recovery and preserves the saved card after reconnecting',async({page,context})=>{
 const card=savedCard();await seed(page,card);
 let failures=0;await page.route('**/assets/cardRuntime-*.js',route=>{failures++;return route.abort('connectionreset');});
 await page.goto('/');await expect(page.locator('.paper')).toBeVisible();
 await expect(page.locator('.editing-load-error')).toBeVisible();
 await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeDisabled();
 await page.locator('[data-sheet-tab=背景]').click();await expect(page.locator('.paper')).toBeVisible();
 await page.screenshot({path:test.info().outputPath('editing-download-failed.png'),fullPage:true});
 expect(failures).toBeGreaterThan(0);
 await page.unroute('**/assets/cardRuntime-*.js');
 await page.getByRole('button',{name:'保存后重新加载编辑功能',exact:true}).click();
 await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();
 await expect(page.locator('.editing-load-error')).toHaveCount(0);
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 await page.getByRole('textbox',{name:'角色姓名',exact:true}).fill('网络恢复后继续编辑');
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const saved=await page.evaluate(async()=>{
  const request=indexedDB.open('dnd-card-standalone');await new Promise<void>(r=>request.onsuccess=()=>r());const db=request.result;
  const workspace=await new Promise<any>(r=>{const get=db.transaction('documents').objectStore('documents').get('workspace');get.onsuccess=()=>r(get.result);});db.close();return workspace.characters.find((c:any)=>c.id===workspace.activeId);
 });
 expect(saved.name).toBe('网络恢复后继续编辑');expect(saved.notes).toBe(card.notes);expect(saved.runtime.resources.manual).toMatchObject({current:2,max:5});
 await context.setOffline(true);await page.getByRole('textbox',{name:'角色姓名',exact:true}).fill('离线仍可保存');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await context.setOffline(false);await page.reload();await expect(page.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue('离线仍可保存');
});

test.describe('physical server outage',()=>{
 test.use({serviceWorkers:'allow'});
 test('cached editing and Wiki reopen when the actual local web server stops',async({page})=>{
  // Stop a real server rather than depending on a browser-specific offline API.
  const root=resolve(process.env.DND_FOLLOWUP_BUILD||process.cwd(),'dist-standalone');
  const server=createServer(async(request,response)=>{
   try{
    const pathname=new URL(request.url||'/','http://localhost').pathname;
    const path=resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
    if(!path.startsWith(root+sep)){response.writeHead(403).end();return;}
    const mime=path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.png')?'image/png':path.endsWith('.html')?'text/html':'application/octet-stream';
    response.setHeader('Content-Type',mime);response.end(await readFile(path));
   }catch{response.writeHead(404).end();}
  });
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  const address=server.address() as {port:number};let stopped=false;
  const stop=async()=>{if(stopped)return;stopped=true;server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));};
  try{
   await seed(page,savedCard());await page.goto(`http://127.0.0.1:${address.port}/`);
   await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();
   await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();
   await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   await page.locator('[data-sheet-tab=法术]').click();await expect(page.locator('.header-法术')).toBeVisible();
   await expect.poll(()=>page.evaluate(async()=>{const names=await caches.keys(),cache=await caches.open(names.find(n=>n.startsWith('dnd-card-shell:'))!),urls=(await cache.keys()).map(r=>r.url);return ['WikiUi','catalog','cardRuntime','SpellsPage'].every(tool=>urls.some(url=>url.includes('/assets/'+tool+'-')));})).toBe(true);
   await stop();
   await page.unroute('https://5e.kiwee.top/data/**');await page.route('https://5e.kiwee.top/data/**',route=>route.abort('connectionrefused'));
   await page.reload();await expect(page.locator('.paper')).toBeVisible();
   await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();
   await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();
   await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await page.getByRole('textbox',{name:'角色姓名',exact:true}).fill('源站断线仍能保存');
   await expect(page.locator('.save-status')).toContainText('已保存到本机');
   await page.locator('[data-sheet-tab=法术]').click();await expect(page.locator('.header-法术')).toBeVisible();
   await page.screenshot({path:test.info().outputPath('cached-card-real-server-offline.png'),fullPage:true});
  }finally{await stop();}
 });
});

test('class warnings are yellow before settings load and custom non-class entries stay quiet',async({page})=>{
 const card=savedCard();
 const entry:Entry={id:'old:class',name:'测试法师',english:'Test Mage',kind:'class',source:'IMPORTED',packId:'imported',edition:'both',revision:'1',entries:[],raw:{}};
 card.selections=[{id:'old-class',entry,quantity:1,level:1,equipped:false}];
 await seed(page,card);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 const banner=page.locator('.class-compatibility-banner'),icon=page.locator('.character-tabs .class-warning-icon');
 await expect(banner).toContainText('当前角色的职业尚未关联资料库，或与当前 2024 职业规则不同。可以核对并同步；其他自定义内容不会触发此提醒。');
 expect(await banner.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(255, 240, 189)');
 expect(await icon.evaluate(el=>getComputedStyle(el).color)).toBe('rgb(255, 204, 56)');
 for(const width of [1512,390]){await page.setViewportSize({width,height:982});await page.screenshot({path:test.info().outputPath('class-warning-'+width+'.png'),fullPage:true});expect(await banner.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
});

test('an editable card with only custom non-class content has no class warning',async({page})=>{
 const card=savedCard();
 card.selections=(['race','background','feature','feat','item','spell'] as const).map((kind,i)=>({id:'custom-'+i,entry:{id:'personal:'+kind,name:'自定义'+kind,english:'Personal '+kind,kind,source:'CUSTOM',packId:'custom',edition:'both',revision:'1',entries:[],raw:{_custom:true}},quantity:1,level:1,equipped:false}));
 await seed(page,card);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await expect(page.locator('.class-compatibility-banner')).toHaveCount(0);await expect(page.locator('.class-warning-icon')).toHaveCount(0);
});
