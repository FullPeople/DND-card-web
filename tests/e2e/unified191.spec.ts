import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter} from '../../src/core/model';
const card=newCharacter(),profile=card.profile;
async function openRoom(page:Page,url:string,role:string,auto:boolean){
 await mockSource(page);await page.route('**/data/items.json',r=>r.fulfill({json:{item:[{name:'共享扩展物品',source:'XGE',type:'G',entries:['原创测试条目。']}]}}));
 const entry=new URL(url);entry.hash='suite=unified191&bridge='+encodeURIComponent(entry.origin);await page.goto(entry.href);
 await expect(page.locator('.app-shell')).toBeVisible();
 const send=async(type:string,data:any={})=>page.evaluate(({type,data})=>window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{protocol:'full-suite-workbench/v1',session:'unified191',hostStarted:191,type,...data}})),{type,data});
 const target={key:'r:card:one',itemId:'card:one',cardId:'one',name:'测试卡',kind:'character',role,write:true,documentRevision:1,stats:{},resources:[]};
 const shared={key:'room:191',scope:'room',revision:1,rules:{edition:card.edition,sourceMode:'both',profile:{...profile,...(auto?{autoSourceDefaults:['PHB','XPHB']}:{} )},packs:[],customEntries:[]}};
 await send('ready');await send('catalog',{sequence:1,role,cards:[{...target,id:'one',inScene:true}],monsters:[],enabled:{},visibility:{wiki:true,monsters:true},shared});await send('selection',{sequence:2,state:target,document:{dnd_card_web:card,_suiteRevision:1}});await send('navigate');
 await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 return {send,shared,target};
}
test('Suite compact chrome and Wiki columns keep room source authority',async({page,baseURL},info)=>{
 test.skip(info.project.name!=='integrated');const {send,shared,target}=await openRoom(page,baseURL!,'PLAYER',true);
 await expect(page.locator('.app-header')).toHaveCSS('height','36px');await expect(page.locator('.workbench-cards')).toHaveCSS('height','24px');await expect(page.locator('.save-status')).toBeHidden();await expect(page.locator('.wiki-layout')).toHaveClass(/wiki-columns/);
 await page.getByRole('button',{name:'装备',exact:true}).click();await expect(page.locator('.catalog-row').filter({hasText:'共享扩展物品'})).toHaveCount(1);
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expect(page.locator('.source-summary')).toContainText('珊娜萨');await expect(page.getByRole('button',{name:'全部禁用',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await send('catalog',{sequence:3,role:'PLAYER',cards:[{...target,id:'one',inScene:true}],monsters:[],enabled:{},visibility:{wiki:true,monsters:true},shared:{...shared,revision:2,rules:{...shared.rules,profile:{...profile,autoSourceDefaults:['PHB','XPHB','XGE']}}}});
 await expect(page.locator('.catalog-row').filter({hasText:'共享扩展物品'})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('suite-player.png')});
});
test('existing room source choices stay disabled and DM source controls remain enabled',async({page,baseURL},info)=>{
 test.skip(info.project.name!=='integrated');await openRoom(page,baseURL!,'GM',false);
 await page.getByRole('button',{name:'装备',exact:true}).click();await expect(page.locator('.catalog-row').filter({hasText:'共享扩展物品'})).toHaveCount(0);
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();const book=page.locator('.source-book').filter({has:page.getByRole('button',{name:'设置来源 XGE',exact:true})});await expect(book.getByRole('checkbox')).not.toBeChecked();await expect(book.getByRole('checkbox')).toBeEnabled();
 await page.screenshot({path:info.outputPath('suite-dm.png')});
});
