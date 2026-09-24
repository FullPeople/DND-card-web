import {test,expect,type Page} from '@playwright/test';
import {newCharacter,type Entry} from '../../src/core/model';
import {exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
import {mockSource} from './fixtures';

const protocol='full-suite-workbench/v1',session='live-update179';
const character=newCharacter();character.name='停留当前卡验收';character.player='远端玩家';character.baseHp=30;character.runtime.hp=9;
const condition:Entry={id:'test:condition:poisoned',kind:'condition',name:'中毒',english:'Poisoned',source:'IMPORTED',edition:'both',packId:'imported',revision:'1',entries:['原创测试状态。'],raw:{_suiteStatusId:'poisoned'}};
function snapshot(revision:number,poisoned=false,hp=9){
 const native=structuredClone(character);native.runtime.hp=hp;
 // The native revision deliberately stays at its original value: durable Suite
 // revisions and payload contents, not a local edit counter, govern remote data.
 if(poisoned)native.selections.push({id:'status:poisoned',entry:condition,quantity:1,level:1,equipped:false});
 const document={...exportOwlbear(native,evaluate(native)),dnd_card_web:native,_suiteRevision:revision};
 return {state:{key:'room:card:one',itemId:'token-one',cardId:'one',kind:'character',name:native.name,role:'GM',write:true,documentRevision:revision,stats:{health:hp,'max health':30,'temporary health':0,'armor class':10},conditions:poisoned?[{id:'poisoned',name:'中毒',entry:condition}]:[],resources:[]},document};
}
async function send(host:Page,type:string,payload:any={}){await host.evaluate(({protocol,session,type,payload})=>(window as any).viewer.postMessage({protocol,session,hostStarted:179,type,...payload},location.origin),{protocol,session,type,payload});}
async function openPair(host:Page){
 await host.route('**/live-update-host179',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Same-origin host endpoint</title>'}));await host.goto('/live-update-host179');
 await host.evaluate(({protocol,session})=>{window.addEventListener('message',event=>{const m=event.data;if(m?.protocol!==protocol||m.session!==session)return;if(m.type==='hello'||m.type==='ping')(event.source as Window).postMessage({protocol,session,hostStarted:179,type:m.type==='hello'?'ready':'pong'},location.origin);});},{protocol,session});
 const waiting=host.context().waitForEvent('page');await host.evaluate(({session})=>{(window as any).viewer=window.open('/#suite='+session+'&bridge='+encodeURIComponent(location.origin),'live-update-card179');},{session});const card=await waiting;await mockSource(card);await card.waitForLoadState();await expect(card.locator('.app-shell')).toBeVisible();
 await send(host,'ready');const initial=snapshot(1);await send(host,'catalog',{sequence:1,role:'GM',cards:[{...initial.state,id:'one',inScene:true,locked:false}],monsters:[],enabled:{},visibility:{wiki:true,monsters:true}});await send(host,'selection',{sequence:2,...initial});await send(host,'navigate');await expect(card.getByLabel('当前生命值',{exact:true})).toHaveValue('9');return card;
}

test('an idle current card applies remote add/remove and HP changes through real window postMessage without switching',async({page})=>{
 const card=await openPair(page);await expect(card.locator('.status-strip')).not.toContainText('中毒');
 await send(page,'selection',{sequence:3,...snapshot(2,true,17)});await expect(card.locator('.status-strip')).toContainText('中毒');await expect(card.getByLabel('当前生命值',{exact:true})).toHaveValue('17');
 await send(page,'selection',{sequence:4,...snapshot(3,false,19)});await expect(card.locator('.status-strip')).not.toContainText('中毒');await expect(card.getByLabel('当前生命值',{exact:true})).toHaveValue('19');
 await expect(card.locator('.paper-footer')).toContainText('修订 '+character.revision);
});

test('a catalog-only update is not an authoritative selected-card document; subsequent fresh selection applies immediately',async({page})=>{
 const card=await openPair(page),remote=snapshot(2,true,17);await send(page,'catalog',{sequence:3,role:'GM',cards:[{...remote.state,id:'one',name:'远端目录更新',inScene:true,locked:false}],monsters:[],enabled:{},visibility:{wiki:true,monsters:true}});
 await expect(card.getByRole('tab',{name:'远端目录更新',exact:true})).toBeVisible();
 await expect(card.locator('.status-strip')).not.toContainText('中毒');await expect(card.getByLabel('当前生命值',{exact:true})).toHaveValue('9');
 await send(page,'selection',{sequence:4,...remote});await expect(card.locator('.status-strip')).toContainText('中毒');await expect(card.getByLabel('当前生命值',{exact:true})).toHaveValue('17');
});

test('late stale selection cannot resurrect a removed condition while a newer durable document still applies',async({page})=>{
 const card=await openPair(page);await send(page,'selection',{sequence:12,...snapshot(3,false,19)});await expect(card.getByLabel('当前生命值',{exact:true})).toHaveValue('19');
 await send(page,'selection',{sequence:13,...snapshot(2,true,17)});await expect(card.locator('.status-strip')).not.toContainText('中毒');await expect(card.getByLabel('当前生命值',{exact:true})).toHaveValue('19');
 await send(page,'selection',{sequence:11,...snapshot(4,true,21)});await expect(card.locator('.status-strip')).toContainText('中毒');await expect(card.getByLabel('当前生命值',{exact:true})).toHaveValue('21');
});

test('the mounted card refreshes names, identities, feature bubbles, spells and values without switching characters',async({page})=>{
 const card=await openPair(page),remote=snapshot(2,true,23),native=remote.document.dnd_card_web;
 native.name='远端改名';native.player='远端玩家二';native.abilities.int=18;
 const add=(kind:Entry['kind'],name:string,raw:Entry['raw']={})=>{const entry:Entry={id:'remote:'+kind,kind,name,english:name,source:'IMPORTED',edition:'both',packId:'imported',revision:'1',entries:['原创同步测试正文。'],raw};native.selections.push({id:entry.id,entry,quantity:1,level:2,equipped:false});};
 add('class','同步法师',{hd:{number:1,faces:6},casterProgression:'full',spellcastingAbility:'int'});add('race','同步精灵',{size:['M'],speed:35});add('background','同步学者');add('feature','同步特性');add('spell','同步法术',{level:2});
 native.runtime.resources['sync-points']={name:'同步点数',type:'number',current:2,max:6};
 remote.document={...exportOwlbear(native,evaluate(native)),dnd_card_web:native,_suiteRevision:2};remote.state.name=native.name;
 await send(page,'selection',{sequence:8,...remote});
 await expect(card.locator('.identity-name .assign-token-name')).toHaveText('远端改名');await expect(card.getByLabel('玩家姓名',{exact:true})).toHaveValue('远端玩家二');
 await expect(card.locator('.identity-class')).toContainText('同步法师');await expect(card.locator('.identity-race')).toContainText('同步精灵');await expect(card.locator('.identity-background')).toContainText('同步学者');
 await expect(card.locator('.paper')).toContainText('同步特性');await expect(card.getByLabel('当前生命值',{exact:true})).toHaveValue('23');
 await card.getByRole('tab',{name:'法术',exact:true}).click();await expect(card.locator('.paper .spell-stock-tile .stock-name')).toContainText('同步法术');
 const removed=structuredClone(remote);removed.document._suiteRevision=3;removed.state.documentRevision=3;removed.document.dnd_card_web.selections=removed.document.dnd_card_web.selections.filter(s=>s.entry.kind!=='spell'&&s.entry.kind!=='feature');
 await send(page,'selection',{sequence:9,...removed});await expect(card.locator('.paper .spell-stock-tile .stock-name')).toHaveCount(0);
 await card.getByRole('tab',{name:'主要',exact:true}).click();await expect(card.locator('.paper')).not.toContainText('同步特性');await expect(card.locator('.identity-class')).toContainText('同步法师');
});
