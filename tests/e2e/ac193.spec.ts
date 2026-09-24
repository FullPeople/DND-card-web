import {test,expect} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter} from '../../src/core/model';
import {evaluate} from '../../src/core/engine';
import {exportOwlbear} from '../../src/core/export';
import {expandChanges} from '../../src/platform/document-delta';

test('AC adjustment is editable only in edit mode, supports undo and persists',async({page})=>{
 await mockSource(page);await page.goto('./');const value=page.locator('.armor-cell [data-stat="ac"]');
 await expect(value).toHaveText('10');await expect(page.getByLabel('护甲等级调整值',{exact:true})).toHaveCount(0);
 await page.getByRole('switch',{name:'编辑模式'}).click();const input=page.getByLabel('护甲等级调整值',{exact:true});
 await input.fill('5');await input.press('Enter');await expect(value).toHaveText('15');
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(value).toHaveText('10');
 await page.getByRole('button',{name:'重做',exact:true}).click();await expect(value).toHaveText('15');
 await page.locator('.armor-cell').screenshot({path:test.info().outputPath('ac-edit.png')});
 expect(await page.locator('.armor-cell .cell-content').evaluate(e=>e.scrollWidth<=e.clientWidth&&e.scrollHeight<=e.clientHeight)).toBe(true);
 await page.getByRole('switch',{name:'编辑模式'}).click();await expect(input).toHaveCount(0);await page.reload();await expect(value).toHaveText('15');
 await page.getByRole('switch',{name:'编辑模式'}).click();await input.fill('-1');await input.press('Enter');await expect(value).toHaveText('9');
});

test('Owlbear saves AC adjustment and accepts a later authoritative total without doubling it',async({page,baseURL})=>{
 test.skip(process.env.AC_STANDALONE==='1','Standalone intentionally excludes the Owlbear bridge');
 const c=newCharacter();c.name='护甲测试';c.sheetBonuses={ac:2};const document={...exportOwlbear(c,evaluate(c)),dnd_card_web:c,_suiteRevision:1};
 await mockSource(page);const url=new URL(baseURL!);url.hash='suite=ac193&bridge='+encodeURIComponent(url.origin);await page.goto(url.href);await expect(page.locator('.app-shell')).toBeVisible();
 await page.evaluate(document=>{
  const w=window as any;let sequence=0;w.saves=[];let doc=document;
  const emit=(type:string,rest:any={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session:'ac193',hostStarted:193,type,...rest}}));
  const state=()=>({key:'room:card:ac193',itemId:'card:ac193',cardId:'ac193',kind:'character',name:'护甲测试',write:true,role:'PLAYER',locked:false,documentRevision:doc._suiteRevision,stats:{health:1,'max health':1,'armor class':doc.core_stats.ac},resources:[],conditions:[]});
  const snap=()=>({sequence:++sequence,state:state(),document:doc});
  w.sceneAc=()=>{doc=structuredClone(doc);doc._suiteRevision++;doc.core_stats.ac=18;doc.dnd_card_web.adjustments=[{id:'suite-ac',target:'ac',value:18-(doc.dnd_card_web.sheetBonuses?.ac||0),reason:'枭熊场景'}];emit('selection',snap());};
  w.finish=(native:any,data:any)=>{const m=w.saves.at(-1);doc={...data,dnd_card_web:native,_suiteRevision:doc._suiteRevision+1};emit('ack',{requestId:m.requestId,ok:true,result:{snapshot:snap()}});emit('selection',snap());};
  window.addEventListener('message',e=>{const m=e.data;if(m?.session!=='ac193')return;if(m.type==='ping')emit('pong');if(m.type==='select')emit('selection',snap());if(m.type==='save')w.saves.push(m);});
  emit('ready');emit('catalog',{sequence:++sequence,role:'PLAYER',enabled:{},cards:[{id:'ac193',inScene:false,...state()}],monsters:[]});emit('selection',snap());emit('navigate');
 },document);
 await page.getByRole('tab',{name:'护甲测试',exact:true}).click();
 const value=page.locator('.armor-cell [data-stat="ac"]');await expect(value).toHaveText('12');await page.getByRole('switch',{name:'编辑模式'}).click();
 await page.getByLabel('护甲等级调整值',{exact:true}).fill('5');await page.getByLabel('护甲等级调整值',{exact:true}).press('Enter');await expect(value).toHaveText('15');
 await expect.poll(()=>page.evaluate(()=>(window as any).saves.length)).toBe(1);
 const save=await page.evaluate(()=>(window as any).saves[0]);const native=expandChanges(document.dnd_card_web,save.delta.native,'after'),data=expandChanges(document,save.delta.legacy,'after');expect(native.sheetBonuses.ac).toBe(5);expect(save.statPatch['armor class']).toBe(15);expect(data.core_stats.ac).toBe(15);await page.evaluate(({native,data})=>(window as any).finish(native,data),{native,data});
 await expect(page.getByRole('alert')).toHaveCount(0);await page.evaluate(()=>(window as any).sceneAc());await expect(value).toHaveText('18');await expect(page.getByLabel('护甲等级调整值',{exact:true})).toHaveValue('5');
});
