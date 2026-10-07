import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {newCharacter} from '../../src/core/model';
import {mockSource,suppressAnnouncement} from './fixtures';
const suite=process.env.LEGACY_SUITE_ROOT;
for(const edition of ['2014','2024'] as const){
 test(`${edition}: reader export keeps the original JSON and manual records; old/new captions agree`,async({page,context})=>{
  const c=newCharacter(edition);c.name='导出与显示验收';c.training={armor:'shield、Shields',tools:"Tinker's Tools、Thieves' Tools、{@item Tinker's Tools|PHB|我的手工工具}、Unknown homebrew tool"};c.notes='手工记录\n第二行';c.runtime.resources.manual={current:2,max:3};
  const payload={format:'dnd-card-web',version:1,character:c,unknownExchangeField:{keep:'完整保留'}},original=JSON.stringify(payload,null,2)+'\n';
  const dataUrl='http://127.0.0.1:5442/synthetic-character.json';let reads=0;const requests:string[]=[],writes:string[]=[];
  await context.route(dataUrl,route=>{reads++;return route.fulfill({body:original,contentType:'application/json',headers:{'access-control-allow-origin':'*'}});});
  page.on('request',r=>{requests.push(r.url());if(r.method()!=='GET')writes.push(r.method()+' '+r.url());});
  await page.addInitScript(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){throw new Error('Unexpected reader storage write');};void put;});
  await page.goto(suite?`http://127.0.0.1:5443/suite/cc-fullscreen.html?data_url=${encodeURIComponent(dataUrl)}`:`/?legacyViewer=1&data_url=${encodeURIComponent(dataUrl)}`);
  await expect(page.locator('.player-viewer')).toBeVisible();
  const captions=await page.locator('.training-chips .feature-caption').allTextContents();
  expect(captions).toEqual(['盾牌','盾牌','修补工具','盗贼工具','我的手工工具','Unknown homebrew tool']);
  for(let i=0;i<2;i++){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出 JSON',exact:true}).click();const download=await pending;expect(download.suggestedFilename()).toBe(c.name+'.json');expect(await readFile((await download.path())!,'utf8')).toBe(original);}
  expect(reads).toBe(1);expect(writes).toEqual([]);expect(requests.some(url=>/5e\.kiwee|homebrew\.kiwee|automation-progress|automation-rule-status/.test(url))).toBe(false);
  await page.getByRole('button',{name:'刷新资料',exact:true}).click();await expect(page.locator('.player-viewer')).toBeVisible();expect(reads).toBe(2);
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'导出 JSON',exact:true})).toBeInViewport();await page.screenshot({path:test.info().outputPath('mobile-json-export.png')});
  // Same native card, loaded by the real new-plugin App bridge. Reader writes stay guarded above.
  const modern=await context.newPage();await mockSource(modern);await suppressAnnouncement(modern);
  await modern.goto(suite?'http://127.0.0.1:5443/suite/card-viewer/index.html#suite=legacy-caption&bridge='+encodeURIComponent('http://127.0.0.1:5443'):'/');await expect(modern.locator('.app-shell')).toBeVisible();
  if(!suite){await expect(modern.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await modern.getByRole('button',{name:'导入 / 导出',exact:true}).click();await modern.getByTestId('character-file').setInputFiles({name:'synthetic-native.json',mimeType:'application/json',buffer:Buffer.from(original)});if(edition==='2014')await modern.getByRole('dialog',{name:'导入前核对',exact:true}).getByRole('button',{name:'保留全部记录并导入',exact:true}).click();await modern.getByRole('tab',{name:c.name+'（导入）',exact:true}).waitFor();await modern.getByRole('dialog',{name:'导入与导出',exact:true}).getByRole('button',{name:'关闭弹窗',exact:true}).click();}
  else
  await modern.evaluate(c=>{const send=(type:string,data:any={})=>window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{protocol:'full-suite-workbench/v1',session:'legacy-caption',hostStarted:100,type,...data}}));const state={key:'r:card:synthetic',itemId:'card:synthetic',cardId:'synthetic',name:c.name,kind:'character',role:'GM',write:false,documentRevision:1,stats:{},resources:[]};send('ready');send('catalog',{sequence:1,role:'GM',cards:[{...state,id:'synthetic',classSummary:[]}],monsters:[],enabled:{},visibility:{wiki:true,monsters:true},shared:{key:'room:fixture',scope:'room',revision:1,rules:{edition:c.edition,profile:c.profile,packs:[],customEntries:[]}}});send('selection',{sequence:2,state,document:{dnd_card_web:c,_suiteRevision:1}});},c);
  if(suite){await expect(modern.getByRole('navigation',{name:'枭熊工作台',exact:true})).toContainText(c.name);await modern.getByRole('tab',{name:c.name,exact:true}).click();}
  if(suite)await expect(modern.getByRole('region',{name:'角色名',exact:true}).getByRole('button',{name:c.name,exact:true})).toBeVisible();else await expect(modern.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue(c.name+'（导入）');await expect.poll(()=>modern.locator('.training-chips .feature-caption').allTextContents()).toEqual(captions);
 });
}
test('legacy schema 0.3 exports unknown exchange fields and survives a download/import/read roundtrip',async({page,context})=>{
 const abilities=Object.fromEntries(['str','dex','con','int','wis','cha'].map(a=>[a,{total:10}]));
 const input={schema_version:'0.3',identity:{character_name:'旧卡往返',player:'合成测试',tool_proficiencies:["Tinker's Tools"],armor_proficiencies:['shield','Shields']},abilities,meta:{ruleset:'2014'},proficiencies:{armor:['shield','Shields']},manual_extension:{notes:'原文\n不变',uses:3}};
 const original=JSON.stringify(input,null,2);const url='http://127.0.0.1:5442/legacy-synthetic.json';
 await context.route(url,r=>r.fulfill({body:original,contentType:'application/json',headers:{'access-control-allow-origin':'*'}}));
 await page.goto(suite?`http://127.0.0.1:5443/suite/cc-fullscreen.html?data_url=${encodeURIComponent(url)}`:`/?legacyViewer=1&data_url=${encodeURIComponent(url)}`);await expect(page.locator('.player-viewer')).toBeVisible();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出 JSON',exact:true}).click();const download=await pending;const saved=await readFile((await download.path())!,'utf8');expect(saved).toBe(original);
 if(suite){const result=await page.evaluate(async saved=>{const bridgePath='/suite/card-viewer/bridge.js';const {normalizeLegacyUpload}=await import(/* @vite-ignore */bridgePath);const normalized=normalizeLegacyUpload(saved);return{notes:normalized.dnd_card_web.externalSnapshot.manual_extension,training:normalized.dnd_card_web.training};},saved);expect(result.notes).toEqual(input.manual_extension);expect(result.training.tools).toBe("Tinker's Tools");}
});
test('a failed refresh clears the previous character and its export',async({page,context})=>{
 const c=newCharacter();c.name='仅合成的刷新检查';let fail=false;
 const url='http://127.0.0.1:5442/refresh-synthetic.json';
 await context.route(url,r=>r.fulfill(fail?{status:404,body:'missing'}:{json:{format:'dnd-card-web',character:c}}));
 await page.goto('/?legacyViewer=1&data_url='+encodeURIComponent(url));await expect(page.getByRole('button',{name:'导出 JSON',exact:true})).toBeVisible();fail=true;
 await page.getByRole('button',{name:'刷新资料',exact:true}).click();await expect(page.getByRole('alert')).toContainText('404');await expect(page.getByRole('button',{name:'导出 JSON',exact:true})).toHaveCount(0);await expect(page.locator('.paper')).toHaveCount(0);
});
