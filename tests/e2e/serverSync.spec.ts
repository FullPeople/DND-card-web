import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Character,type Entry} from '../../src/core/model';
import {CharacterApi} from '../../src/platform/server/characterApi';
import {SERVER_SYNC_E2E} from '../helpers/serverSyncBrowserBackend.ts';
/**
 * Real-browser server sync acceptance (playwright.server-sync.config.ts): real
 * Go backend + temporary SQLite behind the Vite proxy, cookie session, real
 * IndexedDB, Web Locks and BroadcastChannel. Only failures are injected.
 */
test.skip(!process.env.DND_SERVER_SYNC_E2E,'needs playwright.server-sync.config.ts (Go backend)');
type Creds={baseUrl:string;users:Record<string,{id:string;token:string}>};
const creds=():Creds=>JSON.parse(readFileSync(SERVER_SYNC_E2E.credentials,'utf8'));
const owner=()=>new CharacterApi({baseUrl:creds().baseUrl,token:creds().users.owner.token});
function synthetic(name:string){const c=newCharacter('2024');c.name=name;c.baseHp=30;c.runtime.hp=30;return c;}
async function remoteChurn(id:string,count=5){const api=owner();for(let i=0;i<count;i++){const s=await api.get(id);await api.submit(id,{operationId:crypto.randomUUID(),clientId:crypto.randomUUID(),baseRevision:s.revision,operations:[{op:'set',path:'/abilities/str',value:10+i}]});}}
/** Legacy workspace + backup exactly as stored in this browser profile. */
async function legacy(page:Page){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('dnd-card-standalone');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});try{const get=(key:string)=>new Promise<any>((resolve,reject)=>{const req=db.transaction('documents').objectStore('documents').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return {workspace:await get('workspace'),backup:await get('backup')};}finally{db.close();}});}
async function expectNoServerRows(page:Page){
  const {workspace,backup}=await legacy(page);
  expect(workspace).toBeDefined();
  for(const w of [workspace,backup].filter(Boolean)){expect(JSON.stringify(w.characters.map((c:Character)=>c.id))).not.toContain('server:');expect(w.activeId).not.toMatch(/^server:/);}
  return workspace;
}
async function boot(page:Page){await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled({timeout:30000});}
async function serverPanel(page:Page){await page.getByRole('button',{name:/^角色簿/}).click();await page.getByRole('button',{name:'服务器角色…',exact:true}).click();return page.getByRole('dialog',{name:'服务器角色',exact:true});}
async function login(page:Page){
  const panel=await serverPanel(page);
  await panel.getByLabel('管理员提供的令牌').fill(creds().users.owner.token);await panel.getByRole('button',{name:'登录',exact:true}).click();
  await expect(panel).toContainText('已登录');return panel;
}
async function openServer(page:Page,id:string,panel?:ReturnType<Page['getByRole']>,expected='已同步'){
  panel??=await serverPanel(page);
  await panel.getByRole('button',{name:'刷新列表',exact:true}).click();
  await panel.locator(`[data-server-id="${id}"]`).getByRole('button',{name:'打开',exact:true}).click();
  await expect(page.locator('.server-sync-status')).toContainText(expected);
}
const status=(page:Page)=>page.locator('.server-sync-status');
async function setHp(page:Page,value:string,pending?:number){
  const input=page.getByLabel('当前生命值',{exact:true});await input.click();await input.fill(value);await expect(input).toHaveValue(value);await input.press('Enter');
  if(pending)await expect(status(page)).toContainText(`待同步 ${pending}`);// persisted to the outbox before the next edit
}

test('login, open, refresh and a server-card migration copy never touch the legacy workspace',async({page})=>{
  const c=synthetic('服务器旧职业');const old:Entry={id:'legacy-mage',kind:'class',name:'旧职业法师',english:'旧职业法师',packId:'imported',source:'IMPORTED',edition:'both',revision:'0.3',entries:[],raw:{hd:{faces:6}}};
  c.selections=[{id:'legacy-class',entry:old,level:1,quantity:1,equipped:false}];
  const created=await owner().create(c);
  await boot(page);const panel=await login(page);await openServer(page,created.id,panel);await page.keyboard.press('Escape');
  // Select the server card explicitly: a legacy workspace write happens while it is active.
  await page.getByRole('tab',{name:/^服务器旧职业(旧卡资料需要核对)?$/}).click();await expect(page.locator('.save-status')).toContainText('已保存到本机');
  const before=await expectNoServerRows(page);
  await page.reload();await expect(status(page)).toContainText('已同步');await expect(page.getByRole('tab',{name:/^服务器旧职业(旧卡资料需要核对)?$/})).toHaveAttribute('aria-selected','true');
  await expectNoServerRows(page);
  // Migration copy of a server card: a new server card, original untouched, nothing local.
  await page.getByRole('button',{name:'核对并同步旧卡',exact:true}).click();const review=page.getByRole('dialog',{name:'旧卡资料同步',exact:true});
  const choices=review.getByRole('radiogroup',{name:'旧职业法师同步目标',exact:true});await choices.getByRole('radio',{name:'旧职业法师同步目标：自定义',exact:true}).click();
  await review.getByLabel('旧职业法师查找资料').fill('测试法师');await review.getByRole('radio',{name:'旧职业法师同步目标：测试法师（XPHB）',exact:true}).click();
  for(let step=0;step<5;step++)await review.getByRole('button',{name:'确认并继续',exact:true}).click();
  const createdIds=new Set((await owner().listAll()).map(m=>m.id));
  await review.getByRole('button',{name:'创建同步副本',exact:true}).click();await expect(review).toHaveCount(0);
  await expect(page.locator('.suite-toast')).toContainText('已在服务器上创建同步副本');
  const copy=(await owner().listAll()).find(m=>!createdIds.has(m.id))!;expect(copy).toBeDefined();
  const copyDoc=(await owner().get(copy.id)).document;expect(copyDoc.name).toBe('服务器旧职业（资料同步副本）');expect(copyDoc.selections.find(s=>s.id==='legacy-class')!.entry.source).toBe('XPHB');
  const original=await owner().get(created.id);expect(original.revision).toBe(1);expect(original.document.name).toBe('服务器旧职业');expect(original.document.selections[0].entry.source).toBe('IMPORTED');
  await expect(page.getByRole('tab',{name:/^服务器旧职业（资料同步副本）/})).toHaveAttribute('aria-selected','true');await expect(status(page)).toContainText('已同步');
  const after=await expectNoServerRows(page);
  expect(after.characters.map((x:Character)=>x.id)).toEqual(before.characters.map((x:Character)=>x.id));
  expect(JSON.stringify(after)).not.toContain('资料同步副本');
});

test('two tabs share one outbox: only the sender submits, the other reloads and takes over without a double increment',async({context})=>{
  const created=await owner().create(synthetic('双标签'));
  const a=await context.newPage();await boot(a);await openServer(a,created.id,await login(a));await a.keyboard.press('Escape');
  const b=await context.newPage();await boot(b);await expect(status(b)).toContainText('已同步');// restored session + last character
  const posts=new Map<Page,string[]>([[a,[]],[b,[]]]);
  for(const page of [a,b])page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/operations'))posts.get(page)!.push(request.postData()||'');});
  // clientId: one per tab, stable across that tab's reload.
  const ids=async(page:Page)=>page.evaluate(()=>sessionStorage.getItem('dnd-card:server-client-id'));
  const idB=await ids(b);expect(idB).toBeTruthy();expect(await ids(a)).not.toBe(idB);
  await setHp(a,'-3');
  await expect.poll(async()=>(await owner().get(created.id)).document.runtime.hp).toBe(27);
  await expect(b.getByLabel('当前生命值',{exact:true})).toHaveValue('27');
  expect(posts.get(b)).toEqual([]);expect(posts.get(a)).toHaveLength(1);
  // Sender A loses the network for its request; B sees the shared intent but does not send it.
  await a.route('**/api/v1/characters/*/operations',route=>route.request().method()==='POST'?route.abort('internetdisconnected'):route.continue());
  await setHp(a,'-2');
  await expect.poll(()=>posts.get(a)!.length).toBeGreaterThanOrEqual(2);
  await expect(b.getByLabel('当前生命值',{exact:true})).toHaveValue('25');await expect(status(b)).toContainText('待同步 1');
  expect(posts.get(b)).toEqual([]);
  const lost=JSON.parse(posts.get(a)!.at(-1)!);
  await a.close();// the sender tab exits; B acquires the lock, recovers the unknown request and resends it
  await expect(status(b)).toContainText('已同步',{timeout:30000});
  const server=await owner().get(created.id);expect(server.document.runtime.hp).toBe(25);expect(server.revision).toBe(3);
  expect(posts.get(b)!.length).toBeGreaterThanOrEqual(1);expect(posts.get(b)!.map(body=>JSON.parse(body))).toEqual(posts.get(b)!.map(()=>lost));// same operationId, same frozen body
  await b.reload();await expect(status(b)).toContainText('已同步');expect(await ids(b)).toBe(idB);
});

test('offline A→B→C edits survive a refresh and are sent in order without self-conflict',async({page})=>{
  const created=await owner().create(synthetic('离线连续'));
  await boot(page);await openServer(page,created.id,await login(page));await page.keyboard.press('Escape');
  await page.route('**/api/v1/**',route=>route.abort('internetdisconnected'));
  for(const [i,hp] of ['25','20','15'].entries())await setHp(page,hp,i+1);
  await page.reload();// offline: /me is uncertain, the cached account and outbox are restored
  await expect(status(page)).toContainText('待同步 3');await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('15');
  await page.unroute('**/api/v1/**');
  await expect(status(page)).toContainText('已同步',{timeout:60000});
  const delta=await owner().delta(created.id,1);
  expect(delta.operations.map(r=>r.operations[0])).toEqual([25,20,15].map(value=>({op:'set',path:'/runtime/hp',value})));
  await expect(page.locator('.server-sync-status.blocked')).toHaveCount(0);
});

test('history pruned while offline: only the unknown head needs review; later edits follow after an explicit decision',async({page})=>{
  const created=await owner().create(synthetic('保留窗口'));
  await page.routeWebSocket(/\/api\/v1\/ws/,ws=>{ws.close();});// no live updates: only HTTP can catch up
  await boot(page);await openServer(page,created.id,await login(page),'离线');await page.keyboard.press('Escape');
  await page.route('**/api/v1/characters/**',route=>route.abort('internetdisconnected'));
  for(const hp of ['25','20','15'])await setHp(page,hp);// rapid: an edit may start before the previous intent is persisted
  await expect(status(page)).toContainText('待同步 3');
  await remoteChurn(created.id);
  await page.unroute('**/api/v1/characters/**');
  await expect(status(page)).toContainText('需处理 1',{timeout:60000});
  await status(page).click();const dialog=page.getByRole('dialog',{name:'服务器同步',exact:true});
  await expect(dialog.locator('article')).toHaveCount(1);await expect(dialog.locator('article h3')).toHaveText('无法确认是否已提交，需要核对');
  await expect(dialog).toContainText('待同步 2');await expect(dialog).not.toContainText('前面的离线修改需要先处理');
  page.once('dialog',confirm=>void confirm.accept());
  await dialog.getByRole('button',{name:'明确提交我的决定',exact:true}).click();
  await expect.poll(async()=>{const s=await owner().get(created.id);return [s.revision,s.document.runtime.hp];},{timeout:30000}).toEqual([9,15]);
  await expect(dialog).toContainText('没有需要处理的冲突');
});

test('logout is fail-closed: an uncertain DELETE /session and a reload never restore the account',async({page})=>{
  await boot(page);let panel=await login(page);
  await page.route('**/api/v1/session',route=>route.request().method()==='DELETE'?route.abort('internetdisconnected'):route.continue());
  await panel.getByRole('button',{name:'退出',exact:true}).click();
  await expect(panel.getByRole('alert')).toContainText('服务器会话注销结果无法确认');await expect(panel.getByLabel('管理员提供的令牌')).toBeVisible();
  // The cookie session really is still valid on the server; only the local barrier keeps us out.
  expect((await page.request.get('/api/v1/me')).status()).toBe(200);
  const me:string[]=[];page.on('request',request=>{if(request.url().endsWith('/api/v1/me'))me.push(request.url());});
  await page.reload();await expect(page.locator('.paper')).toBeVisible();await page.waitForTimeout(1500);
  expect(me).toEqual([]);await expect(status(page)).toHaveCount(0);
  panel=await serverPanel(page);await expect(panel.getByLabel('管理员提供的令牌')).toBeVisible();
  // An explicit login lifts the barrier again.
  await panel.getByLabel('管理员提供的令牌').fill(creds().users.owner.token);await panel.getByRole('button',{name:'登录',exact:true}).click();await expect(panel).toContainText('已登录');
  await page.reload();await expect(page.locator('.paper')).toBeVisible();
  panel=await serverPanel(page);await expect(panel).toContainText('已登录');
});
