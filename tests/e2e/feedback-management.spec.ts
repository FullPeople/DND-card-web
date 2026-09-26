import {readFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter} from '../../src/core/model';
import {exportCharacters} from '../../src/core/export';
import {APP_VERSION} from '../../src/platform/announcement';

test.beforeEach(async({page},info)=>{await mockSource(page,{suiteAnnouncement:info.title.startsWith('Suite announcement')});await page.goto('/');await expect(page.locator('.paper')).toBeVisible();});
test('global edit switch, batch cards, unselected export, JSON import and DM review',async({page},info)=>{
 const toggle=page.getByRole('switch',{name:'编辑模式'});await toggle.click();await expect(page.locator('.toolbar-actions').getByRole('switch')).toHaveAttribute('aria-checked','true');
 expect(await toggle.evaluate(node=>node.getBoundingClientRect().right<=node.closest('.sheet-pane')!.getBoundingClientRect().right)).toBe(true);
 await page.getByRole('button',{name:/^角色簿/}).click();await page.getByText('批量创建角色',{exact:true}).click();await page.getByRole('textbox',{name:'批量角色名'}).fill('星港测试者\n北岸测试者');await page.getByRole('button',{name:'创建这些角色'}).click();
 await expect(page.locator('.manager-table tbody tr')).toHaveCount(3);await page.getByRole('button',{name:/星港测试者/}).click();await expect(toggle).toHaveAttribute('aria-checked','true');await page.reload();await expect(toggle).toHaveAttribute('aria-checked','true');
 await page.getByRole('button',{name:/^角色簿/}).click();const target=page.locator('.manager-table tbody tr').filter({hasText:'北岸测试者'});const downloaded=page.waitForEvent('download');await target.getByRole('button',{name:'JSON',exact:true}).click();const download=await downloaded;expect(download.suggestedFilename()).toContain('北岸');const backup=JSON.parse(readFileSync((await download.path())!,'utf8'));expect(backup.format).toBe('dnd-card-web');expect(backup.character.name).toBe('北岸测试者');
 await target.getByRole('button',{name:'审卡',exact:true}).click();await expect(page.getByRole('heading',{name:'DM 审卡',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('dm-review.png')});await page.getByRole('button',{name:'关闭弹窗'}).click();
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();const a=newCharacter('2014');a.name='旧版测试客';const b=newCharacter('2024');b.name='新版测试客';await page.getByRole('textbox',{name:'角色 JSON 文本'}).fill(JSON.stringify(exportCharacters([a,b])));await page.getByRole('button',{name:'校验并导入 JSON 文本'}).click();await expect(page.getByText(/版本不同：当前 2024，导入 2014/)).toBeVisible();await page.getByRole('button',{name:'确认导入这批角色'}).click();await expect(page.locator('.manager-table tbody tr')).toHaveCount(5);await page.screenshot({path:info.outputPath('character-manager.png')});
 await page.getByRole('checkbox',{name:'选择旧版测试客',exact:true}).check();await page.getByRole('checkbox',{name:'选择新版测试客',exact:true}).check();await page.getByRole('button',{name:'删除所选',exact:true}).click();await page.getByRole('button',{name:'确认批量删除'}).click();await expect(page.locator('.manager-table tbody tr')).toHaveCount(3);
});
test('exports five PNGs and PDF then restores editing and current page',async({page},info)=>{
 await page.getByRole('switch',{name:'编辑模式'}).click();await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.screenshot({path:info.outputPath('export-panel.png')});
 const zip=page.waitForEvent('download');await page.getByRole('button',{name:'导出 PNG',exact:true}).click();const archive=await zip;await archive.saveAs(info.outputPath('five-pages.zip'));await expect(page.getByRole('switch',{name:'编辑模式'})).toHaveAttribute('aria-checked','true');
 const pdf=page.waitForEvent('download');await page.getByRole('button',{name:'下载 PDF',exact:true}).click();const document=await pdf;await document.saveAs(info.outputPath('five-pages.pdf'));await expect(page.getByRole('switch',{name:'编辑模式'})).toHaveAttribute('aria-checked','true');await expect(page.locator('.transfer-panel [role=status]')).toContainText('5 页 A4 PDF');
});
test('Suite announcement requires acknowledgment, remembers only its version and preserves read-only exports',async({page,baseURL},info)=>{
 const origin=new URL(baseURL!).origin;await page.goto(`/?suiteFeedback=1#suite=feedback&bridge=${encodeURIComponent(origin)}`);
 const announcement=page.getByRole('dialog',{name:'欢迎使用 Full Suite 枭熊工作台！'});await expect(announcement).toBeVisible();await page.keyboard.press('Escape');await expect(announcement).toBeVisible();await expect(announcement.locator('.announcement-owner>summary')).toHaveText('关于设置玩家单独权限的重要说明');expect(await announcement.locator('.announcement-owner').evaluate(e=>(e as HTMLDetailsElement).open)).toBe(false);await page.screenshot({path:info.outputPath('suite-announcement.png')});await announcement.getByRole('checkbox').check();await announcement.getByRole('button',{name:'我知道了',exact:true}).click();await page.reload();await expect(announcement).toHaveCount(0);
 const card=newCharacter();card.name='只读远端角色';
 await page.evaluate(card=>{
  const emit=(type:string,payload:any)=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session:'feedback',hostStarted:197,type,...payload}}));
  (window as any).readRequests=[];(window as any).selectRequests=[];
  window.addEventListener('message',event=>{if(event.data.type==='readCard'){(window as any).readRequests.push(event.data);emit('ack',{requestId:event.data.requestId,ok:true,result:{document:{dnd_card_web:card}}});}if(event.data.type==='select')(window as any).selectRequests.push(event.data);});
  emit('ready',{});emit('catalog',{sequence:1,role:'PLAYER',cards:[{id:'readonly',itemId:'card:readonly',name:card.name,write:false,inScene:false,locked:false,stats:{health:4,'max health':10},resources:[]}],monsters:[],enabled:{dice:true},visibility:{wiki:true,monsters:true}});
 },card);
 await expect(page.getByRole('button',{name:'投骰',exact:true})).toBeVisible();await page.setViewportSize({width:390,height:760});expect(await page.getByRole('button',{name:'投骰',exact:true}).evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})).toBe(true);await page.setViewportSize({width:1512,height:982});await page.getByRole('button',{name:/^角色簿/}).click();const downloaded=page.waitForEvent('download');await page.locator('.manager-table').getByRole('button',{name:'JSON',exact:true}).click();await downloaded;expect(await page.evaluate(()=>(window as any).readRequests.length)).toBe(1);expect(await page.evaluate(()=>(window as any).selectRequests.length)).toBe(0);
 await page.getByRole('button',{name:'关闭弹窗'}).click();await page.evaluate(()=>localStorage.setItem('dnd-card:announcement-ack:suite','older'));await page.reload();await expect(announcement).toBeVisible();
});
test('editing and exporting a 2014 card in a 2024 room preserves native edition and source profile',async({page,baseURL})=>{
 await page.evaluate(version=>localStorage.setItem('dnd-card:announcement-ack:suite',version),APP_VERSION);
 await page.goto(`/?nativeIdentity=1#suite=identity&bridge=${encodeURIComponent(new URL(baseURL!).origin)}`);
 const card=newCharacter('2014');card.name='保留旧版身份';card.profile.enabledSources=['PHB'];card.runtime.hp=10;card.baseHp=20;
 const room=newCharacter('2024');room.profile.enabledSources=['XPHB'];
 await page.evaluate(({card,room})=>{
  const emit=(type:string,payload:any)=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session:'identity',hostStarted:197,type,...payload}}));
  (window as any).nativeSaves=[];window.addEventListener('message',event=>{if(event.data.type==='save'){(window as any).nativeSaves.push(event.data);emit('ack',{requestId:event.data.requestId,ok:true,result:{}});}});
  const state={key:'room:card:old',itemId:'card:old',cardId:'old',kind:'character',name:card.name,role:'PLAYER',write:true,documentRevision:1,stats:{health:10,'max health':20,'armor class':10},resources:[],conditions:[]};
  emit('ready',{});emit('catalog',{sequence:1,role:'PLAYER',cards:[{...state,id:'old',inScene:true,locked:false}],monsters:[],enabled:{},visibility:{wiki:true,monsters:true},shared:{key:'room-rules',scope:'room',revision:1,rules:{edition:'2024',profile:room.profile,packs:[],customEntries:[],sourceMode:'full'}}});emit('selection',{sequence:2,state,document:{schema_version:'0.3',dnd_card_web:card,_suiteRevision:1}});emit('navigate',{});
 },{card,room});
 await page.getByRole('tab',{name:card.name,exact:true}).click();await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('10');await page.getByLabel('当前生命值',{exact:true}).fill('-3');await page.getByLabel('当前生命值',{exact:true}).press('Enter');await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('7');
 await expect.poll(()=>page.evaluate(()=>(window as any).nativeSaves.length)).toBe(1);const changes=await page.evaluate(()=>(window as any).nativeSaves[0].delta.native);expect(changes.some((change:any)=>['edition','profile','rulePacks'].includes(change.path[0]))).toBe(false);
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByRole('button',{name:'生成并复制 JSON'}).click();const exported=JSON.parse(await page.getByRole('textbox',{name:'角色 JSON 文本'}).inputValue());expect(exported.character.edition).toBe('2014');expect(exported.character.profile.enabledSources).toEqual(['PHB']);expect(exported.character.runtime.hp).toBe(7);
 await page.getByRole('button',{name:'关闭弹窗'}).click();await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session:'identity',hostStarted:197,type:'selection',sequence:3,state:{key:'room:monster:one',itemId:'monster-one',cardId:'',kind:'monster',name:'测试卫士',role:'GM',write:true,stats:{health:10,'max health':20},resources:[],conditions:[]},document:{name:'测试卫士',source:'CUSTOM',ac:[12],hp:{average:20},speed:{walk:30},str:12,dex:10,con:10,int:10,wis:10,cha:10}}})));
 await expect(page.locator('.toolbar-actions').getByRole('switch',{name:'怪物编辑模式'})).toHaveAttribute('aria-checked','true');await expect(page.locator('.monster-editor')).toBeVisible();
});
