import {mkdirSync,writeFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Character,type Entry,type Kind} from '../../src/core/model';
import {exportCharacter} from '../../src/core/export';
mkdirSync('evidence/screen',{recursive:true});
function card(dense=false,visual=false):Character{
  const c=newCharacter();c.automation={protocol:2,enabled:false,defaultsVersion:1,rulesVersion:'equipment.1'};c.name=dense?'岚 · 长风之境的守望者 · 长名称布局验收':'岚 · 排版验收';c.player='示例';c.abilities={str:16,dex:20,con:17,int:12,wis:16,cha:11};c.baseHp=51;c.runtime.hp=51;c.size='M';
  c.proficiencies={athletics:true,acrobatics:true,stealth:true,investigation:true,insight:true,perception:true,survival:true,intimidation:true,'save:str':true,'save:con':true};
  c.training={armor:'轻甲、中甲、重甲、盾牌',weapons:'简易武器、军用武器',tools:'修补工具、龙棋',languages:'通用语、精灵语、地底通用语'};
  const add=(kind:Kind,name:string,raw:Record<string,unknown>={},parentId?:string)=>{const id=`screen:${c.selections.length}`;const entry:Entry={id,kind,name,english:name,source:'XPHB',edition:'2024',packId:'screen-fixture',revision:'1',entries:['自编排版验收内容。'+(dense?'用于长正文和换行检查。'.repeat(8):'')],raw};c.selections.push({id,entry,level:kind==='class'?5:1,quantity:1,equipped:false,parentId});if(kind==='class'){entry.raw._custom=true;c.selections.at(-1)!.catalogReview={edition:c.edition,entryId:id,source:entry.source,kind};}return id;};
  const cls=add('class',dense?'测试战士 · 长名称职业':'测试战士',{hd:{faces:10}}),race=add('race','测试旅人',{speed:30}),bg=add('background','测试巡守');add('subclass','测试大师',{className:'测试战士',classSource:'XPHB'},cls);
  for(const name of ['战斗技巧','恢复能力','战术头脑','额外攻击','团队协作'])add('feature',name,{},cls);
  for(const name of ['暗处观察','敏锐感官','血统特性','沉思'])add('feature',name,{},race);
  add('feature','巡守经验',{},bg);add('feat','技艺专家');add('feat','双武器技巧');
  const spells=['微光术','护盾之术','暗影之术',...(dense?['长名称来源赠送法术','旅途的地图投影','镜影之术','幻影之术']:[])].map((name,i)=>add('spell',name,{level:i?1:0}));
  c.spellSettings={mode:'prepared',modeOverride:true,ability:'int',capacity:6,attackBonus:0,dcBonus:0,prepared:spells,slots:{1:{max:4,used:1},2:{max:3,used:0}}};
  for(const name of ['旅行背包','短剑','长弓','绳索','水袋'])add('item',name,{weight:2});
  c.quickbarActions=[{id:'bow',name:'长弓',attack:'+8',damage:'1d8+5'},{id:'sword',name:'长剑',attack:'+6',damage:'1d8+3'},{id:'dagger',name:'匕首',attack:'+8',damage:'1d4+5'}];
  c.runtime.resources={second:{name:'恢复能力',current:1,max:1,type:'count'},action:{name:'动作如潮',current:1,max:1,type:'count'},dice:{name:'卓越骰',current:3,max:4,type:'count'},'hit-die:10':{name:'生命骰',current:5,max:5,type:'count'}};
  c.biography={story:'她从漫长的巡守中归来，随身的旧地图留下许多尚未探索的路线。'.repeat(dense?20:2),traits:'习惯先观察再行动。',ideals:'让同伴平安归来。',bonds:'珍藏一封未寄出的信。',flaws:'有时过于依赖自己的判断。'};
  if(visual)for(const name of ['invisible','poisoned'])add('condition',name,{visual:{condition:name}});
  return c;
}
writeFileSync('evidence/screen/demo-card.json',JSON.stringify(exportCharacter(card()),null,2));
async function ready(page:Page,dense=false,visual=false){
  await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('.save-status')).toContainText('已保存到本机');
  await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'screen-layout.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(card(dense,visual))))});await expect(page.locator('.character-tabs').getByRole('tab').filter({hasText:'岚 ·'}).last()).toBeVisible();await page.keyboard.press('Escape');
  await expect(page.locator('.screen-overview')).toBeVisible();await page.getByRole('button',{name:'关闭提示',exact:true}).click();
}
async function pane(page:Page,width:number,height:number){
  await page.locator('.sheet-pane').evaluate((node,[w,h])=>{Object.assign((node as HTMLElement).style,{position:'fixed',left:'0',top:'0',width:`${w}px`,height:`${h}px`,zIndex:'50',display:'flex'});},[width,height]);
  await page.waitForTimeout(180);
}
test('real five pages reflow without clipped frames at desktop, phone and breakpoint widths',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);const results=[];
  for(const width of [850,1320,520,390,320,280,375,386,398]){
    await pane(page,width,width>=850?720:844);
    for(const name of ['主要','特性','背景','法术','背包']){
      await page.getByRole('tab',{name,exact:true}).click();await page.locator('.sheet-viewport').evaluate(root=>root.scrollTop=0);await page.waitForTimeout(100);
      const result=await page.locator('.sheet-viewport').evaluate(root=>{
        const paper=root.querySelector<HTMLElement>('.paper')!;
        const clipped=[...paper.querySelectorAll<HTMLElement>('.cell-content,.identity-title,.ability-skill>span:last-child,.stock-name')].filter(node=>node.clientWidth>0&&node.scrollWidth>node.clientWidth+2).map(node=>({class:node.className,text:node.textContent?.slice(0,45),client:node.clientWidth,scroll:node.scrollWidth}));
        const frames=[...paper.querySelectorAll<HTMLElement>('.sheet-cell')],overlaps=[];
        for(let i=0;i<frames.length;i++)for(let j=i+1;j<frames.length;j++){if(frames[i].contains(frames[j])||frames[j].contains(frames[i]))continue;const a=frames[i].getBoundingClientRect(),b=frames[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([frames[i].getAttribute('aria-label'),frames[j].getAttribute('aria-label')]);}
        const bounds=root.getBoundingClientRect(),outside=[...root.querySelectorAll<HTMLElement>('*')].filter(node=>node instanceof HTMLElement&&node.getBoundingClientRect().right>bounds.right+2).map(node=>({class:node.className,right:Math.round(node.getBoundingClientRect().right-bounds.right),text:node.textContent?.slice(0,20)}));
        return {overflow:root.scrollWidth-root.clientWidth,clipped,overlaps,scroll:root.scrollHeight,height:root.clientHeight,outside,frames:frames.map(node=>({name:node.getAttribute("aria-label"),class:node.className,h:node.offsetHeight,y:Math.round(node.getBoundingClientRect().y),min:getComputedStyle(node).minHeight}))};
      });results.push({width,name,...result});
      if([850,390,320].includes(width))await page.locator('.sheet-pane').screenshot({path:`evidence/screen/${width}-${name}.png`});
      // Responsive content may grow with owner headings and feature bubbles. Its
      // end must remain reachable, rather than being clipped to a fixed height.
      const viewport=page.locator('.sheet-viewport');await viewport.evaluate(root=>root.scrollTop=root.scrollHeight);
      await expect.poll(()=>viewport.evaluate(root=>{
        const bounds=root.getBoundingClientRect(),footer=root.querySelector<HTMLElement>('.paper-footer')!,paper=root.querySelector<HTMLElement>('.paper')!;
        const end=footer.getBoundingClientRect(),last=[...paper.querySelectorAll<HTMLElement>('.sheet-cell')].reduce((bottom,node)=>Math.max(bottom,node.getBoundingClientRect().bottom),0);
        return {scrollable:['auto','scroll'].includes(getComputedStyle(root).overflowY),atEnd:Math.abs(root.scrollHeight-root.clientHeight-root.scrollTop)<=1,footerVisible:end.height>0&&end.top>=bounds.top&&end.bottom<=bounds.bottom+1,framesReachable:last<=bounds.bottom+1};
      }),{message:`${width}px ${name}: the responsive sheet's final content must be reachable`}).toEqual({scrollable:true,atEnd:true,footerVisible:true,framesReachable:true});
      if(width===850&&name==='主要')await test.info().attach('850-main-scrolled-end',{body:await page.locator('.sheet-pane').screenshot(),contentType:'image/png'});
    }
  }
  writeFileSync('evidence/screen/geometry.json',JSON.stringify({errors,results},null,2));expect(errors).toEqual([]);expect(results.filter(r=>r.overflow>2||r.clipped.length||r.overlaps.length)).toEqual([]);
  await test.info().attach('screen-geometry',{body:Buffer.from(JSON.stringify({errors,results},null,2)),contentType:'application/json'});
});
test('display preference survives page changes and reload; A4 stays A4 at narrow widths',async({page})=>{
  await ready(page);await page.getByRole('button',{name:'切换为 A4 显示',exact:true}).click();await expect(page.locator('.sheet-viewport')).toHaveAttribute('data-sheet-display','a4');await pane(page,320,740);await expect(page.locator('.paper')).toHaveCSS('width','680px');await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(page.locator('.sheet-viewport')).toHaveAttribute('data-sheet-display','a4');await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.sheet-viewport')).toHaveAttribute('data-sheet-display','a4');await page.getByRole('button',{name:'切换为非 A4 显示',exact:true}).click();await expect(page.locator('.sheet-viewport')).toHaveAttribute('data-sheet-display','screen');
});
test('editing and resizing preserve values, focused trace input and requested frame relationships',async({page})=>{
  await ready(page);await pane(page,390,844);await page.getByRole('switch',{name:'编辑模式',exact:true}).click();const input=page.getByRole('spinbutton',{name:'力量基础值',exact:true});await input.scrollIntoViewIfNeeded();const before=await input.boundingBox();await input.click();const trace=page.getByRole('spinbutton',{name:'力量追溯输入',exact:true});const after=await trace.boundingBox();for(const key of ['x','y','width','height'] as const)expect(Math.abs(before![key]-after![key])).toBeLessThan(1.1);await trace.fill('18');await pane(page,320,844);await expect(trace).toHaveValue('18');await trace.press('Enter');await expect(input).toHaveValue('18');
  const placement=await page.locator('.screen-abilities').evaluate(root=>{const rect=(id:string)=>root.querySelector(`[data-screen-ability="${id}"]`)!.getBoundingClientRect();const first=rect('initiative'),passive=rect('passive'),str=rect('str'),int=rect('int'),cha=rect('cha'),prof=rect('proficiency'),saves=rect('saves');return passive.top>=first.bottom&&str.top>=passive.bottom&&int.top>=str.bottom&&prof.top>=cha.bottom&&saves.top>=prof.bottom;});expect(placement).toBeTruthy();
  await page.locator('.sheet-pane').screenshot({path:'evidence/screen/320-edit.png'});
});
test('PNG captures A4 then restores screen mode and character values',async({page})=>{
  await ready(page);await pane(page,390,844);
  const capture=await page.evaluate(async()=>{const modulePath='/src/platform/sheetImage.ts';const {captureSheet}=await import(modulePath);const blob=await captureSheet();const bitmap=await createImageBitmap(blob);return {width:bitmap.width,height:bitmap.height,mode:document.querySelector('.sheet-viewport')?.getAttribute('data-sheet-display'),preference:localStorage.getItem('dnd-card-sheet-display'),hp:(document.querySelector('[aria-label="当前生命值"]') as HTMLInputElement).value};});expect(capture).toMatchObject({width:2480,height:3508,mode:'screen',hp:'51'});expect(capture.preference).not.toBe('a4');
  const failure=await page.evaluate(async()=>{const modulePath='/src/platform/sheetImage.ts';const {captureSheet}=await import(modulePath),original=HTMLCanvasElement.prototype.toBlob;try{HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};await captureSheet();return 'unexpected success';}catch(error){return String(error);}finally{HTMLCanvasElement.prototype.toBlob=original;}});expect(failure).toContain('PNG 生成失败');await expect(page.locator('.sheet-viewport')).toHaveAttribute('data-sheet-display','screen');await expect(page.locator('.paper')).not.toHaveClass(/sheet-export/);
});
test('editing keeps all main frames stable and long names and prose remain fully readable',async({page})=>{
  await ready(page,true);
  for(const width of [850,390,320,280]){
    await pane(page,width,width===850?720:844);await page.waitForTimeout(80);
    const heights=()=>page.locator('.screen-overview .sheet-cell').evaluateAll(nodes=>nodes.map(node=>({name:node.getAttribute('aria-label'),height:(node as HTMLElement).offsetHeight,width:(node as HTMLElement).offsetWidth})));
    const normal=await heights();await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await page.waitForTimeout(80);expect(await heights()).toEqual(normal);await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
  }
  await pane(page,280,844);
  const name=page.getByRole('textbox',{name:'角色姓名',exact:true});expect(await name.evaluate(node=>node.scrollHeight<=node.clientHeight+2)).toBeTruthy();
  for(const title of ['主要','特性','背景','法术','背包']){await page.getByRole('tab',{name:title,exact:true}).click();await page.waitForTimeout(80);expect(await page.locator('.sheet-viewport').evaluate(root=>root.scrollWidth-root.clientWidth)).toBe(0);expect(await page.locator('.cell-content,.stock-name').evaluateAll(nodes=>nodes.filter(node=>node.clientWidth>0&&node.scrollWidth>node.clientWidth+2).map(node=>node.textContent?.slice(0,40)))).toEqual([]);}
  await page.getByRole('tab',{name:'背景',exact:true}).click();await page.locator('.sheet-pane').screenshot({path:'evidence/screen/280-long-background.png'});
});
test('phone shell exposes display control and native touch scroll keeps page tabs available',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();await ready(page);await expect(page.getByRole('button',{name:'切换为 A4 显示',exact:true})).toBeVisible();
  const root=page.locator('.sheet-viewport'),before=await page.getByRole('tab',{name:'主要',exact:true}).boundingBox(),bounds=await root.boundingBox(),session=await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds!.x+20,y:bounds!.y+Math.min(400,bounds!.height-30)}]});for(let i=1;i<=5;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:bounds!.x+20,y:bounds!.y+Math.min(400,bounds!.height-30)-i*45}]});await page.waitForTimeout(30);}await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);expect(await root.evaluate(node=>node.scrollTop)).toBeGreaterThan(50);expect(Math.abs((await page.getByRole('tab',{name:'主要',exact:true}).boundingBox())!.y-before!.y)).toBeLessThan(1.1);
  await root.evaluate(node=>node.scrollTop=0);await page.waitForTimeout(250);await page.screenshot({path:'evidence/screen/phone-shell.png'});await context.close();
});
test('read-only viewer remains read-only across both display modes and all five pages',async({page})=>{
  await mockSource(page,{displayMode:'screen'});await page.route('**/layout-viewer.json',route=>new URL(route.request().url()).pathname==='/layout-viewer.json'?route.fulfill({json:exportCharacter(card())}):route.continue());await page.goto('/?legacyViewer=1&data_url=/layout-viewer.json',{waitUntil:'domcontentloaded'});await expect(page.locator('.screen-overview')).toBeVisible();
  for(const mode of ['screen','a4']){if(mode==='a4')await page.getByRole('button',{name:'切换为 A4 显示',exact:true}).click();for(const title of ['主要','特性','背景','法术','背包']){await page.getByRole('tab',{name:title,exact:true}).click();expect(await page.locator('.paper input,.paper textarea,.paper select').evaluateAll(nodes=>nodes.every(node=>(node as HTMLInputElement).disabled))).toBeTruthy();}}
  await page.getByRole('button',{name:'切换为非 A4 显示',exact:true}).click();await page.getByRole('tab',{name:'主要',exact:true}).click();await expect(page.getByRole('textbox',{name:'当前生命值',exact:true})).toBeDisabled();
});
test('screen effects coexist on all five pages and editing restores normal frames',async({page})=>{
  await ready(page,false,true);await pane(page,390,844);
  for(const name of ['主要','特性','背景','法术','背包']){await page.getByRole('tab',{name,exact:true}).click();await expect(page.locator('.paper')).toHaveClass(/adaptive-condition-invisible/);await expect(page.locator('.paper')).toHaveClass(/adaptive-condition-poisoned/);await expect(page.locator('.sheet-cell [data-adaptive-effect="invisible"]').first()).toBeAttached();await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await expect(page.locator('.paper')).toHaveClass(/adaptive-editing/);await expect(page.locator('.paper')).not.toHaveClass(/adaptive-condition-invisible/);await page.getByRole('switch',{name:'编辑模式',exact:true}).click();}
  await page.getByRole('tab',{name:'主要',exact:true}).click();await expect(page.getByRole('textbox',{name:'当前生命值',exact:true})).toHaveValue('51');await page.locator('.sheet-pane').screenshot({path:'evidence/screen/390-effects.png'});
});

test('screen skill adjustments stay reachable and display switches preserve the resource dashboard',async({page})=>{
  await ready(page);await pane(page,390,844);
  const snapshot=()=>page.evaluate(async()=>{const path='/src/platform/storage.ts';const {loadWorkspace}=await import(path);const w=await loadWorkspace();const c=w.characters.find((c:any)=>c.id===w.activeId);return JSON.stringify({layout:c.quickbarLayout,resources:c.runtime.resources});});
  const before=await snapshot();await page.getByRole('button',{name:'切换为 A4 显示',exact:true}).click();await page.getByRole('button',{name:'切换为非 A4 显示',exact:true}).click();expect(await snapshot()).toBe(before);
  const resource=page.locator('.resource-widget[data-resource-name="恢复能力"] .resource-widget-face');await resource.scrollIntoViewIfNeeded();expect((await resource.boundingBox())!.height).toBeGreaterThanOrEqual(40);await resource.click();await expect(page.getByRole('dialog',{name:'恢复能力资源操作',exact:true})).toBeVisible();await page.getByRole('button',{name:'关闭资源操作',exact:true}).click();expect(await snapshot()).toBe(before);
  await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
  for(const width of [390,320]){await pane(page,width,844);const field=page.getByRole('spinbutton',{name:'运动额外调整值',exact:true});await field.scrollIntoViewIfNeeded();const row=field.locator('..');expect(await row.evaluate(el=>{const field=el.querySelector<HTMLInputElement>('.skill-extra-adjustment')!,label=el.querySelector('span')!,a=field.getBoundingClientRect(),b=label.getBoundingClientRect();return a.left>=b.right-1&&field.clientWidth>=18&&label.scrollWidth<=label.clientWidth+1;})).toBeTruthy();await field.fill(width===390?'2':'3');await field.press('Tab');await expect(field).toHaveValue(width===390?'2':'3');}
  await page.reload();await expect(page.getByRole('spinbutton',{name:'运动额外调整值',exact:true})).toHaveValue('3');
});
