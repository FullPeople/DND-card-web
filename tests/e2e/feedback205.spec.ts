import {customField,finishCustomField} from './customCanvasHelpers';
import {test,expect,type Page} from '@playwright/test';
import {newCharacter} from '../../src/core/model';
import {mockSource} from './fixtures';
import {exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';

async function feedbackStorage(page:Page){
 return page.evaluate(()=>new Promise<{workspace:any;backup:any}>((resolve,reject)=>{
  // This release configuration runs the integrated app, whose storage.ts uses this database.
  const open=indexedDB.open('dnd-card-workspace',1);
  open.onupgradeneeded=()=>{open.transaction?.abort();reject(new Error('Expected existing integrated workspace database'));};
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{const db=open.result;try{
   const tx=db.transaction('documents','readonly'),store=tx.objectStore('documents'),values:any={};
   for(const key of ['workspace','backup']){const request=store.get(key);request.onsuccess=()=>{values[key]=request.result;};}
   tx.oncomplete=()=>{db.close();resolve(values);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error);};
  }catch(error){db.close();reject(error);}};
 }));
}

test('native-owner grants keep remote reads in memory and explicit edits in recoverable storage',async({page,baseURL})=>{
 await mockSource(page);await page.goto('/#suite=feedback205&bridge='+encodeURIComponent(new URL(baseURL!).origin));await expect(page.locator('.app-shell')).toBeVisible();
 const c=newCharacter();c.name='分配测试卡';c.runtime.hp=12;c.baseHp=20;c.locked=true;
 await page.evaluate(document=>{
  const w=window as any;w.sent=[];w.workspaceWrites=0;w.workspaceWriteKeys=[];const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value:any,key?:IDBValidKey){if(this.name==='documents'&&['workspace','backup'].includes(String(key))){w.workspaceWrites++;w.workspaceWriteKeys.push(String(key));}return put.call(this,value,key!);};
  let sequence=0;w.emit=(type:string,payload:any={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session:'feedback205',hostStarted:205,type,...payload}}));
  w.state={key:'room:card:one',itemId:'card:one',cardId:'one',kind:'character',name:'分配测试卡',role:'GM',write:true,documentRevision:1,stats:{},resources:[],conditions:[]};
  // Synthetic host boundary: native Set Owner changes the token creator/owner.
  // Suite separately tests the production SDK owner resolution and write guards.
  w.token={id:'native-one',createdUserId:'other'};
  w.catalog=(role:string,owner:string,locked:boolean)=>{w.token.createdUserId=owner;const write=role==='GM'||w.token.createdUserId==='player';w.state={...w.state,role,write,locked};w.emit('catalog',{sequence:++sequence,role,cards:[{...w.state,id:'one',inScene:true,owner_ids:[w.token.createdUserId]}],monsters:[],enabled:{},console:{players:[{id:'player',name:'测试玩家'}],timeStop:false,portalEffects:false}});};
  window.addEventListener('message',event=>{if(['assignOwners','save','createCard'].includes(event.data?.type)){w.sent.push(event.data);w.emit('ack',{requestId:event.data.requestId,ok:true});}});
  w.emit('ready');w.catalog('GM','other',true);w.emit('selection',{sequence:++sequence,state:w.state,document});w.emit('navigate');
 },{...exportOwlbear(c,evaluate(c)),dnd_card_web:c,_suiteRevision:1});
 await page.getByRole('tab',{name:'分配测试卡',exact:true}).click();await expect(page.getByRole('switch',{name:'编辑模式'})).toBeEnabled();
 await expect(page.getByRole('button',{name:'分配玩家',exact:true})).toHaveCount(0);await expect(page.getByRole('dialog',{name:'分配角色卡玩家'})).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).sent.filter((m:any)=>m.type==='assignOwners'))).toEqual([]);
 await page.evaluate(()=>(window as any).catalog('PLAYER','other',false));await expect(page.getByRole('switch',{name:'编辑模式'})).toBeDisabled();
 await page.evaluate(()=>(window as any).catalog('PLAYER','player',true));await expect(page.getByRole('tab',{name:'分配测试卡',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'解锁角色卡',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('switch',{name:'编辑模式'}).click();await expect(page.getByRole('switch',{name:'编辑模式'})).toHaveAttribute('aria-checked','true');await expect(page.getByRole('button',{name:'分配玩家',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).workspaceWrites)).toBe(0);
 const remoteId='suite:room:card:one',beforeEdit=await feedbackStorage(page);
 expect(beforeEdit.workspace.characters.length).toBeGreaterThan(0);
 expect(beforeEdit.workspace.characters.some((row:any)=>row.id===remoteId)).toBe(false);
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();const automation=page.getByRole('dialog',{name:'基础自动化'});await expect(automation.getByRole('checkbox',{name:'启用自动计算'})).toBeChecked();expect(await page.evaluate(()=>(window as any).sent.filter((m:any)=>m.type==='save').length)).toBe(0);await automation.getByRole('checkbox',{name:'启用自动计算'}).uncheck();
 await expect.poll(()=>page.evaluate(()=>(window as any).sent.filter((m:any)=>m.type==='save').length)).toBe(1);
 const saves=await page.evaluate(()=>(window as any).sent);expect(saves.some((m:any)=>m.type==='createCard')).toBe(false);expect(saves.find((m:any)=>m.type==='save').delta.native).toContainEqual(expect.objectContaining({path:['automation'],after:expect.objectContaining({enabled:false,defaultsVersion:1})}));
 // User edits retain the established local recovery transaction: old workspace backup,
 // then the edited workspace. Passive remote reads and later permission changes do not.
 await expect.poll(()=>page.evaluate(()=>(window as any).workspaceWriteKeys)).toEqual(['backup','workspace']);
 const afterEdit=await feedbackStorage(page),remoteCopy=afterEdit.workspace.characters.filter((row:any)=>row.id===remoteId);
 expect(afterEdit.backup).toEqual(beforeEdit.workspace);
 expect(afterEdit.workspace.activeId).toBe(remoteId);expect(remoteCopy).toHaveLength(1);
 expect(remoteCopy[0]).toMatchObject({id:remoteId,name:'分配测试卡',automation:{enabled:false,defaultsVersion:1},runtime:{hp:12}});
 expect(afterEdit.workspace.characters.filter((row:any)=>row.id!==remoteId)).toEqual(beforeEdit.workspace.characters);
 await page.evaluate(()=>(window as any).catalog('PLAYER','other',false));await expect(automation.getByRole('checkbox',{name:'启用自动计算'})).toBeDisabled();await automation.getByRole('button',{name:'关闭弹窗'}).click();await expect(page.getByRole('tab',{name:'分配测试卡',exact:true})).toHaveAttribute('aria-selected','true');
 expect(await page.evaluate(()=>(window as any).workspaceWrites)).toBe(2);expect(await page.evaluate(()=>(window as any).workspaceWriteKeys)).toEqual(['backup','workspace']);
 expect(await feedbackStorage(page)).toEqual(afterEdit);expect(await page.evaluate(()=>(window as any).sent.some((m:any)=>m.type==='assignOwners'))).toBe(false);
});

test('custom entry Chinese and English names survive save and reload independently',async({page})=>{
 await mockSource(page);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'自定义',exact:true}).click();await (await customField(page,'自定义条目类型')).selectOption('feature');await (await customField(page,'自定义条目名称')).fill('星海庇护');await (await customField(page,'自定义条目英文名')).fill('Starlit Shelter');await (await customField(page,'自定义条目正文')).fill('自制测试条目。');await finishCustomField(page);await page.getByRole('button',{name:'保存条目',exact:true}).click();await page.reload();await page.getByRole('button',{name:'编辑此条目'}).click();await expect((await customField(page,'自定义条目名称'))).toHaveValue('星海庇护');await expect((await customField(page,'自定义条目英文名'))).toHaveValue('Starlit Shelter');
});
const classes={class:['甲职业','乙职业'].map((name,i)=>({name,ENG_name:'Class '+i,source:'XPHB',hd:{faces:6},proficiency:['int','wis'],casterProgression:'full',spellcastingAbility:i?'wis':'int',preparedSpellsProgression:Array(20).fill(6),preparedSpellsChange:'restLong',entries:['自制职业。']})),subclass:['甲职业','乙职业'].flatMap(name=>['PHB','XPHB'].map(source=>({name:name+'分支',ENG_name:name+' Branch',source,className:name,classSource:source,entries:['自制子职业。']})))};
const spells={spell:Array.from({length:30},(_,i)=>({name:'实验法术'+String(i).padStart(2,'0'),source:'XPHB',level:1,school:'A',time:[{number:1,unit:'action'}],duration:[{type:'instant'}],entries:['自制测试法术。'],classes:{fromClassList:[{name:'甲职业',source:'XPHB'}]}}))};
async function setup(page:Page,withClasses=true){await mockSource(page);await page.route('**/data/class/class-test.json',r=>r.fulfill({json:classes}));await page.route('**/data/spells/spells-test.json',r=>r.fulfill({json:spells}));await page.route('**/data/items.json',r=>r.fulfill({json:{item:[{name:'测试宝石',ENG_name:'Test Gem',source:'XDMG',type:'$G|XDMG',value:500000,entries:['测试内容。']}]}}));await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();const c=newCharacter();c.name='205测试';c.abilities.int=16;c.abilities.wis=12;c.profile.enabledSources.push('XDMG');c.profile.optional.multiclass=true;if(withClasses)c.selections=classes.class.map(raw=>({id:'test:'+raw.name,kind:'class' as const,name:raw.name,english:raw.ENG_name,source:raw.source,edition:'2024' as const,packId:'fixture',revision:'1',raw,entries:raw.entries})).map((entry,i)=>({id:'class'+i,entry,level:i?3:5,quantity:1,equipped:false}));await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'205.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗'}).click();await page.getByRole('switch',{name:'编辑模式'}).click();return c;}
async function drag(page:Page,source:any,target:()=>any,autoPage?:string){const box=await source.boundingBox();if(!box)throw Error('source hidden');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-12,box.y+box.height/2,{steps:3});if(autoPage)await expect(page.getByRole('tab',{name:autoPage,exact:true})).toHaveAttribute('aria-selected','true');const dest=target();await dest.scrollIntoViewIfNeeded();const b=await dest.boundingBox();if(!b)throw Error('target hidden');await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:14});await page.mouse.up();}
test('two main classes can each choose and receive a subclass; nested results obey version filter',async({page})=>{await setup(page);for(const name of ['甲职业','乙职业']){await page.getByRole('button',{name:`为${name}选择子职`}).click();await expect(page.locator('.entry-detail')).toContainText(name+'分支');const choices=page.locator('.entry-detail .section-heading button[data-drag-enabled=true]').filter({hasText:name+'分支'});const fallback=page.locator('.entry-detail button[data-drag-enabled=true]').filter({hasText:name+'分支'});const source=await choices.count()?choices.first():fallback.first();await expect(fallback).toHaveCount(1);await drag(page,source,()=>page.locator('.identity-class'));await expect(page.locator('.identity-class')).toContainText(name+'分支');}await expect(page.locator('.total-level strong')).toHaveText('8');await page.screenshot({path:'test-results/feedback205-multiclass.png',fullPage:true});});
test('Wiki spells and equipment turn the sheet, and direct prepared drop works beyond eight',async({page})=>{await setup(page);await page.getByRole('tab',{name:'法术',exact:true}).click();await page.getByRole('spinbutton',{name:'预备上限调整'}).fill('14');await page.getByRole('spinbutton',{name:'预备上限调整'}).press('Tab');await expect(page.locator('.ordinary-prepared-group h4 small')).toContainText('/ 26');await expect(page.locator('.ordinary-prepared-group .spell-grid-slot')).toHaveCount(26);await expect(page.locator('.multiclass-spells')).toContainText('+6');await expect(page.locator('.multiclass-spells')).toContainText('+4');for(let i=0;i<9;i++){await page.locator('.category-tabs').getByRole('button',{name:'法术',exact:true}).click();const name='实验法术'+String(i).padStart(2,'0');const source=page.locator('.catalog-row').filter({hasText:name});await page.getByRole('tab',{name:'主要',exact:true}).click();await drag(page,source,()=>page.getByRole('button',{name:`预备空位${i+1}`,exact:true}),'法术');await expect(page.locator('.ordinary-prepared-group h4 small')).toContainText(`${i+1} / 26`);}await page.locator('.category-tabs').getByRole('button',{name:'装备',exact:true}).click();const gem=page.locator('.catalog-row').filter({hasText:'测试宝石'});await expect(gem).toContainText('5000');await expect(gem).toContainText('宝石');await drag(page,gem,()=>page.locator('.stock-drop-zone').first(),'背包');await expect(page.locator('.paper')).toContainText('测试宝石');await page.screenshot({path:'test-results/feedback205-inventory.png',fullPage:true});});
