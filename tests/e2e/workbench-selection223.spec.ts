import {test,expect,type Page} from '@playwright/test';
import {newCharacter,type Entry} from '../../src/core/model';
import {exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
import {mockSource} from './fixtures';
const protocol='full-suite-workbench/v1',session='instant217';
const auth=(epoch=1,ids=['a','b','c','d','e'])=>({room:'room',scope:'room:scene',epoch,role:'GM',enabled:{characterCards:true},cards:ids.map(id=>({id,itemId:'token-'+id,write:true,locked:false})),monsters:[]});
function snapshot(id:string,revision=1,hp=id==='a'?11:22){
 const c=newCharacter();c.name='缓存验收 '+id;c.baseHp=40;c.runtime.hp=hp;
 for(let i=0;i<12;i++){const e:Entry={id:'fixture:'+id+':'+i,kind:'feature',name:`原创特性 ${i}`,english:`Fixture ${i}`,source:'IMPORTED',edition:'both',packId:'imported',revision:'1',raw:{},entries:['原创缓存验收正文。'.repeat(12)]};c.selections.push({id:e.id,entry:e,quantity:1,level:1,equipped:false});}
 return {state:{key:'room:card:'+id,cardId:id,itemId:'token-'+id,name:c.name,kind:'character',role:'GM',write:true,locked:false,pinned:false,documentRevision:revision,stats:{health:hp,'max health':40,'temporary health':0,'armor class':10},resources:[],conditions:[]},document:{...exportOwlbear(c,evaluate(c)),dnd_card_web:c,_suiteRevision:revision}};
}
async function send(host:Page,type:string,payload:any={}){await host.evaluate(({protocol,session,type,payload})=>(window as any).viewer.postMessage({protocol,session,type,hostStarted:217,...payload},location.origin),{protocol,session,type,payload});}
async function pair(host:Page){
 await mockSource(host);await host.route('**/instant-host217',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic delayed host</title>'}));await host.goto('/instant-host217');
 await host.evaluate(({protocol,session})=>{(window as any).requests=[];window.addEventListener('message',e=>{const m=e.data;if(m?.protocol!==protocol||m.session!==session)return;(window as any).requests.push({...m,at:performance.now()});if(m.type==='hello'||m.type==='ping')(e.source as Window).postMessage({protocol,session,type:m.type==='hello'?'ready':'pong',hostStarted:217},location.origin);});},{protocol,session});
 const waiting=host.context().waitForEvent('page');await host.evaluate(session=>{(window as any).viewer=window.open('/#suite='+session+'&bridge='+encodeURIComponent(location.origin)+'&measureSwitch=1','instant217');},session);const page=await waiting;await mockSource(page);await expect(page.locator('.app-shell')).toBeVisible();
 const a=snapshot('a'),b=snapshot('b');await send(host,'ready');await send(host,'catalog',{sequence:1,access:auth(),cards:['a','b','c','d','e'].map(id=>({...snapshot(id).state,id,inScene:true})),monsters:[],role:'GM',enabled:{characterCards:true},visibility:{wiki:true,monsters:true}});
 await send(host,'selection',{sequence:2,...a,access:auth()});await send(host,'cacheSnapshot',{sequence:3,...b,access:auth()});await send(host,'navigate');await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('11');return page;
}

test('map follow restores the preceding dice page and original card after clear',async({page:host},info)=>{
 const page=await pair(host);await page.getByRole('button',{name:'投骰',exact:true}).click();await expect(page.locator('.app-shell')).toHaveAttribute('data-workbench-page','dice');
 await send(host,'navigate',{itemId:'card:b',followSelection:true,followRevision:1});await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('22');await expect(page.locator('.app-shell')).toHaveAttribute('data-workbench-page','sheet');
 await send(host,'followEnd',{itemId:'card:a',followRevision:2});await send(host,'selection',{sequence:20,...snapshot('a'),access:auth(),followRevision:2});
 await expect(page.locator('.app-shell')).toHaveAttribute('data-workbench-page','dice');await page.screenshot({path:info.outputPath('restored-dice-page.png')});
});
test('cold multi selection displays pending overview and clears before any target read completes',async({page:host},info)=>{
 const page=await pair(host);await page.getByRole('tab',{name:'法术',exact:true}).click();
 await send(host,'followSelection',{followRevision:1});await send(host,'groupRollState',{group:{id:'cold-group',phase:'select',loading:true,selectedCount:20,targets:[],visible:true,kind:'save',ability:'dex',variant:'normal'},groupRevision:1});
 const area=page.getByRole('region',{name:'群体区域'});await expect(area).toBeVisible();await expect(area).toContainText('20 个单位');await expect(area).toContainText('正在读取所选单位资料');await expect(area.getByRole('button',{name:'同时投掷'})).toBeDisabled();await expect(area.getByRole('button',{name:'关闭',exact:true})).toBeEnabled();await expect(page.locator('.app-shell')).toHaveAttribute('data-workbench-page','console');
 await page.screenshot({path:info.outputPath('pending-group-overview.png')});
 await send(host,'groupRollState',{group:null,groupRevision:2});await send(host,'followEnd',{itemId:'card:a',followRevision:2});
 await expect(area).toHaveCount(0);await expect(page.locator('.app-shell')).toHaveAttribute('data-workbench-page','sheet');await expect(page.getByRole('tab',{name:'法术',exact:true})).toHaveAttribute('aria-selected','true');
 await send(host,'navigate',{itemId:'card:b',followSelection:true,followRevision:3});await page.getByRole('tab',{name:'主要',exact:true}).click();await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('22');
 await send(host,'navigate',{itemId:'card:a',followSelection:true,followRevision:1});await send(host,'selection',{sequence:30,...snapshot('a'),access:auth(),followRevision:1});await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('22');
});
