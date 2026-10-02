import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {newCharacter,type Character} from '../../src/core/model';
import {exportLinkedOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
import {mockSource,suppressAnnouncement} from './fixtures';
const toggle=(page:Page)=>page.getByRole('button',{name:'隐藏头像框',exact:true});
const cell=(page:Page)=>page.locator('.portrait-cell:not(.illustration-cell)');
const database=()=>test.info().project.name==='standalone'?'dnd-card-standalone':'dnd-card-workspace';
async function readCurrent(page:Page):Promise<Character>{return page.evaluate(async name=>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{return await new Promise<Character>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result.characters.find((c:Character)=>c.id===r.result.activeId));r.onerror=()=>reject(r.error);});}finally{db.close();}
},database());}
async function importCard(page:Page,c:Character){
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 await page.getByTestId('character-file').setInputFiles({name:'authored-avatar.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});
 await expect(page.locator('.character-tabs [aria-selected=true]')).toContainText(c.name);
 await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await expect.poll(async()=>(await readCurrent(page)).name).toContain(c.name);
}
async function authoredImage(page:Page,width=240,height=80){return page.evaluate(({width,height})=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f20a2c';ctx.fillRect(0,0,width,height);return canvas.toDataURL('image/png');},{width,height});}
async function ready(page:Page,mode:'a4'|'screen'='a4'){
 await mockSource(page,{displayMode:mode});await suppressAnnouncement(page);await page.goto('/');
 await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 const c=newCharacter();c.name='原创头像边框测试';const data=await authoredImage(page);
 c.portrait={data,x:-4,y:3,zoom:1.4,frameWidth:104,frameHeight:110};c.illustration={data,x:0,y:0,zoom:1};
 await importCard(page,c);await expect(page.getByAltText('角色头像')).toBeVisible();
 await expect.poll(()=>page.getByAltText('角色头像').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(240);return c;
}
async function assertUnclipped(page:Page){
 const styles=await cell(page).evaluate(el=>[el,...el.querySelectorAll('.cell-face,.cell-surface,.cell-content,.portrait-view')].map(node=>({overflow:getComputedStyle(node).overflow,clip:getComputedStyle(node).clipPath})));
 for(const style of styles){expect(style.overflow).toBe('visible');expect(style.clip).toBe('none');}
 await expect(page.getByAltText('角色头像')).toHaveCSS('object-fit','contain');
}
for(const mode of ['a4','screen'] as const)test(`${mode}: title, eye and keyboard toggle only this character, with stable geometry and persistence`,async({page})=>{
 const original=await ready(page,mode),view=page.locator('.portrait-view');
 await expect(toggle(page)).toHaveCount(0);await expect(cell(page).locator('.cell-heading')).toBeVisible();
 await expect(page.getByAltText('角色头像')).toHaveCSS('object-fit','cover');
 await page.screenshot({path:test.info().outputPath(`${mode}-frame-visible.png`)});
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 await expect(toggle(page)).toHaveAttribute('aria-pressed','false');await expect(cell(page).locator('.portrait-frame-eye')).toBeVisible();
 const before=await view.boundingBox();await toggle(page).click();await expect(toggle(page)).toHaveAttribute('aria-pressed','true');
 await assertUnclipped(page);expect(await view.boundingBox()).toEqual(before);
 await expect(toggle(page)).toHaveCSS('opacity','0.4');expect(await cell(page).locator('.cell-face').evaluate(el=>getComputedStyle(el,'::before').opacity)).toBe('0.4');
 await expect(page.getByAltText('角色头像')).toHaveCSS('opacity','1');
 // Sample actual pixels just outside the old avatar frame, not only computed CSS.
 const point=await view.evaluate(el=>{const b=el.getBoundingClientRect();return {x:Math.floor(b.left-5),y:Math.floor(b.top+b.height/2)};});
 expect(await page.evaluate(point=>!!document.elementFromPoint(point.x,point.y)?.closest('.portrait-cell'),point)).toBe(false);
 const screenshot=await page.screenshot({path:test.info().outputPath(`${mode}-frame-hidden-edit.png`)});const pixel=await page.evaluate(async({data,point})=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);return [...ctx.getImageData(point.x,point.y,1,1).data];},{data:screenshot.toString('base64'),point});expect(pixel).toEqual([242,10,44,255]);
 await expect.poll(async()=>(await readCurrent(page)).portraitFrameHidden).toBe(true);
 expect((await readCurrent(page)).portrait).toEqual(original.portrait);
 await toggle(page).focus();await page.keyboard.press('Space');await expect(toggle(page)).toHaveAttribute('aria-pressed','false');
 await page.keyboard.press('Enter');await expect(toggle(page)).toHaveAttribute('aria-pressed','true');
 await cell(page).locator('.portrait-frame-eye').click();await expect(toggle(page)).toHaveAttribute('aria-pressed','false');
 await cell(page).locator('.portrait-frame-eye').click();await expect(toggle(page)).toHaveAttribute('aria-pressed','true');
 // All avatar instances share the preference; the independent illustration does not.
 for(const name of ['特性','法术','背包']){await page.getByRole('tab',{name,exact:true}).click();await expect(toggle(page)).toHaveAttribute('aria-pressed','true');await assertUnclipped(page);}
 await page.getByRole('tab',{name:'背景',exact:true}).click();await expect(toggle(page)).toHaveCount(0);await expect(page.locator('.illustration-cell .cell-heading')).toBeVisible();await expect(page.getByAltText('角色立绘')).toBeVisible();
 await page.getByRole('tab',{name:'主要',exact:true}).click();await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 await expect(cell(page).locator('.cell-heading')).toHaveCSS('visibility','hidden');await expect(toggle(page)).toHaveCount(0);
 expect(await cell(page).locator('.cell-face').evaluate(el=>getComputedStyle(el,'::before').opacity)).toBe('0');await assertUnclipped(page);
 await page.reload();await expect(cell(page)).toHaveClass(/portrait-frame-hidden/);await assertUnclipped(page);
 expect((await readCurrent(page)).portrait).toEqual(original.portrait);
 const other=newCharacter();other.name='另一位原创角色';await importCard(page,other);await expect(cell(page)).not.toHaveClass(/portrait-frame-hidden/);await expect(cell(page).locator('.cell-heading')).toBeVisible();
 await page.locator('.character-tabs [role=tab]').filter({hasText:original.name}).click();await expect(cell(page)).toHaveClass(/portrait-frame-hidden/);
 await page.screenshot({path:test.info().outputPath(`${mode}-frame-hidden-view.png`)});
});

test('replacement, move/zoom and deletion preserve the frame preference and independent illustration',async({page})=>{
 const original=await ready(page);await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await toggle(page).click();
 await page.locator('.portrait-view').hover();const replacement=await authoredImage(page,80,240),chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'设置头像',exact:true}).click();await (await chooser).setFiles({name:'tall-avatar.png',mimeType:'image/png',buffer:Buffer.from(replacement.split(',')[1],'base64')});
 await expect.poll(async()=>(await readCurrent(page)).portrait?.data).not.toBe(original.portrait!.data);await expect(toggle(page)).toHaveAttribute('aria-pressed','true');
 const move=page.getByRole('button',{name:'移动头像，滚轮缩放',exact:true});await move.hover();await page.mouse.wheel(0,-180);await expect.poll(async()=>(await readCurrent(page)).portrait?.zoom||1).toBeGreaterThan(1);
 const b=(await move.boundingBox())!;await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+10,b.y+b.height/2+8,{steps:4});await page.mouse.up();await expect.poll(async()=>(await readCurrent(page)).portrait?.x||0).toBeGreaterThan(0);
 await page.locator('.portrait-view').hover();await page.getByRole('button',{name:'删除头像',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'取消',exact:true}).click();await expect(page.getByAltText('角色头像')).toBeVisible();
 await page.locator('.portrait-view').hover();await page.getByRole('button',{name:'删除头像',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'删除',exact:true}).click();
 await expect.poll(async()=>(await readCurrent(page)).portrait).toBeUndefined();expect((await readCurrent(page)).portraitFrameHidden).toBe(true);expect((await readCurrent(page)).illustration).toEqual(original.illustration);
 await page.reload();await expect(page.getByAltText('角色头像')).toHaveCount(0);await expect(cell(page)).toHaveClass(/portrait-frame-hidden/);
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await toggle(page).click();await expect.poll(async()=>(await readCurrent(page)).portraitFrameHidden).toBe(false);
});

test('PNG capture and print hide editing chrome, keep the full avatar, and do not rewrite the character',async({page})=>{
 await ready(page);await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await toggle(page).click();await expect.poll(async()=>(await readCurrent(page)).portraitFrameHidden).toBe(true);const stored=await readCurrent(page);
 await page.emulateMedia({media:'print'});await expect(cell(page).locator('.cell-heading')).toHaveCSS('visibility','hidden');expect(await cell(page).locator('.cell-face').evaluate(el=>getComputedStyle(el,'::before').opacity)).toBe('0');await page.emulateMedia({media:'screen'});
 await page.evaluate(()=>{(window as any).frameCapture=[];new MutationObserver(()=>{const paper=document.querySelector('.paper.sheet-export');if(!paper)return;const c=paper.querySelector('.portrait-cell')!,heading=c.querySelector('.cell-heading')!,face=c.querySelector('.cell-face')!,image=c.querySelector('.portrait-image')!;(window as any).frameCapture.push({heading:getComputedStyle(heading).visibility,border:getComputedStyle(face,'::before').opacity,fit:getComputedStyle(image).objectFit,overflow:getComputedStyle(c.querySelector('.cell-content')!).overflow});}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});});
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByRole('button',{name:'仅当前页',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出 PNG',exact:true}).click();const file=await download;expect(file.suggestedFilename()).toMatch(/\.png$/);const bytes=await readFile((await file.path())!);expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
 const samples=await page.evaluate(()=>(window as any).frameCapture);expect(samples.length).toBeGreaterThan(0);for(const sample of samples)expect(sample).toEqual({heading:'hidden',border:'0',fit:'contain',overflow:'visible'});
 await expect(page.locator('.paper')).not.toHaveClass(/sheet-export/);expect(await readCurrent(page)).toEqual(stored);
});

// Production App + bridge messages. This tests the web boundary, not a real OBR room.
test('workbench writes one native preference delta, leaves token fallback untouched, and respects read-only access',async({page,baseURL})=>{
 test.skip(test.info().project.name==='standalone','Standalone intentionally has no workbench bridge.');
 await mockSource(page);await suppressAnnouncement(page);const session='portrait-frame',tokenUrl='https://assets.example.com/authored-token.png';
 await page.route(tokenUrl,route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jxSAAAAAASUVORK5CYII=','base64')}));
 await page.goto('/#suite='+session+'&bridge='+encodeURIComponent(new URL(baseURL!).origin));await expect(page.locator('.app-shell')).toBeVisible();
 const c=newCharacter();c.id='suite:room:card:avatar';c.name='绑定棋子头像';const document={...exportLinkedOwlbear(c,evaluate(c)),_suiteRevision:1};
 const state={key:'room:card:avatar',itemId:'card:avatar',cardId:'avatar',kind:'character',name:c.name,role:'PLAYER',write:true,pinned:true,locked:false,documentRevision:1,stats:{health:0,'max health':0,'temporary health':0,'armor class':10},resources:[],conditions:[],tokenPortrait:{url:tokenUrl,width:100,height:100}};
 await page.evaluate(({session,state,document})=>{
  let sequence=1,current=document;const emit=(type:string,payload:any)=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session,hostStarted:234,type,...payload}}));
  (window as any).portraitSaves=[];
  window.addEventListener('message',event=>{const m=event.data;if(m?.protocol!=='full-suite-workbench/v1'||m.session!==session||m.type!=='save')return;(window as any).portraitSaves.push(m);
   const next=structuredClone(current.dnd_card_web) as any;if(m.delta){for(const change of m.delta.native){let target=next;for(const key of change.path.slice(0,-1))target=target[key]??={};const key=change.path.at(-1);if(change.remove)delete target[key];else target[key]=change.after;}}else Object.assign(next,m.native);
   current={...current,dnd_card_web:next,_suiteRevision:current._suiteRevision+1};state.documentRevision=current._suiteRevision;
   emit('ack',{requestId:m.requestId,ok:true,result:{snapshot:{sequence:++sequence,state,document:current}}});
  });
  (window as any).portraitReadOnly=()=>{state.write=false;emit('selection',{sequence:++sequence,state,document:current});};
  emit('ready',{});emit('catalog',{sequence:sequence++,role:'PLAYER',cards:[{...state,id:'avatar',inScene:true}],monsters:[],enabled:{},visibility:{wiki:true,monsters:true}});emit('selection',{sequence:sequence++,state,document});emit('navigate',{});
 },{session,state,document});
 await page.getByRole('tab',{name:c.name,exact:true}).click();await expect(page.getByAltText('角色头像')).toHaveAttribute('src',tokenUrl);
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await expect(toggle(page)).toBeVisible();expect(await page.evaluate(()=>(window as any).portraitSaves.length)).toBe(0);
 await toggle(page).click();await expect.poll(()=>page.evaluate(()=>(window as any).portraitSaves.length)).toBe(1);await expect(page.locator('.save-status')).toContainText('与枭熊同步');
 const saves=await page.evaluate(()=>(window as any).portraitSaves);expect(saves[0].delta.native).toEqual(expect.arrayContaining([expect.objectContaining({path:['portraitFrameHidden'],after:true})]));expect(saves[0].delta.native.every((d:any)=>['portraitFrameHidden','revision','updatedAt'].includes(d.path[0]))).toBe(true);expect(JSON.stringify(saves)).not.toContain(tokenUrl);
 await expect(page.locator('.portrait-move')).toHaveCount(0);await page.evaluate(()=>(window as any).portraitReadOnly());await expect(toggle(page)).toHaveCount(0);await expect(cell(page).locator('.cell-heading')).toHaveCSS('visibility','hidden');expect(await page.evaluate(()=>(window as any).portraitSaves.length)).toBe(1);
});
