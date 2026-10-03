import {test,expect,type Page,type Locator} from '@playwright/test';
import {newCharacter} from '../../src/core/model';
import {exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
import {mockSource} from './fixtures';

// Real App, production transport/condition/drag/rendering code. Only the remote
// host and original fixture data are synthetic; no room or player data is used.
async function open(page:Page,options:{offRoster?:boolean;malformed?:boolean}={}){
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await mockSource(page);
 await page.route('**/data/conditionsdiseases.json',r=>r.fulfill({json:{condition:[{name:'隐形',ENG_name:'Invisible',source:'XPHB',entries:['原创隐形测试状态。']},{name:'束缚',ENG_name:'Restrained',source:'XPHB',entries:['原创束缚测试状态。']}]}}));
 const c=newCharacter();c.name='双绑定旅人';c.baseHp=40;c.runtime.hp=20;const document={...exportOwlbear(c,evaluate(c)),dnd_card_web:c,_suiteRevision:1};
 await page.addInitScript(({document,options})=>{
  const protocol='full-suite-workbench/v1',session='monster234';let sequence=0;
  const native={id:'c',cardId:'c',itemId:'m',name:'双绑定旅人',kind:'character',write:true,locked:false,inScene:true,role:'GM',pinned:false,stats:{health:20,'max health':40,'armor class':10,'temporary health':0},resources:[],conditions:[],documentRevision:1,key:'room:card:c'};
  const base={id:'m',cardId:'',itemId:'m',targetId:'monster:m',name:'桥卫',kind:'monster',write:true,locked:false,inScene:true,role:'GM',pinned:false,stats:{health:15,'max health':30,'armor class':12,'temporary health':0},resources:[{id:'breath',name:'吐息',current:1,max:3,type:'count'}],conditions:[],key:'room:token:m:guard',slug:'guard'};
  const state:any=JSON.parse(sessionStorage.getItem('monster234-state')||'null')||base;
  let raw:any={name:'桥卫',source:'CUSTOM',size:['M'],type:'construct',ac:[12],hp:{average:30},speed:{walk:30},str:12,dex:10,con:12,int:8,wis:10,cha:8,action:[{name:'敲击',entries:['原创动作说明。']}]};
  let overrideAccess:any;
  const access=()=>overrideAccess||({room:'room',scope:'scene',epoch:1,role:'GM',enabled:{characterCards:true,bestiary:true,hpBar:true,resourceTracker:true},cards:[{...native,itemIds:['m']}],monsters:[{id:'m',itemId:'m',targetId:'monster:m',key:base.key,kind:'monster',write:true,locked:false}]});
  const send=(type:string,payload:any={})=>window.postMessage({protocol,session,hostStarted:234,type,...payload},location.origin);
  const snapshot=(partial=false)=>({sequence:++sequence,access:access(),state:{...state,...(partial?{resources:undefined}:{})},document:raw});
  const catalog=()=>{const row=options.malformed?{...state,resources:{breath:state.resources[0],bad:null},conditions:[null,{id:'prone',name:'倒地',entry:{id:'legacy-prone',name:'倒地',raw:null,entries:null}}]}:state;send('catalog',{sequence:++sequence,access:access(),cards:[native],monsters:options.offRoster?[]:[row],role:'GM',enabled:access().enabled,visibility:{wiki:true,monsters:true}});};
  const requests:any[]=[],pending:any[]=[];
  const fixture:any={state,native,document,requests,pending,hold:false,snapshot,send,catalog,access,setAccess:(value:any)=>{overrideAccess=value;send('access',{access:value});},boot:()=>{send('ready');catalog();send('selection',snapshot());send('navigate');},settle:(message?:any)=>{
   const m=message||pending.shift();if(!m)return;
   if(m.type==='condition'){
    if(m.action==='add')state.conditions=[...state.conditions.filter((c:any)=>c.id!==m.condition.id),m.condition];
    if(m.action==='remove')state.conditions=state.conditions.filter((c:any)=>c.id!==m.condition.id);
    sessionStorage.setItem('monster234-state',JSON.stringify(state));send('ack',{requestId:m.requestId,ok:true,result:{snapshots:[snapshot(true)]}});
   }
  }};
  (window as any).monster234=fixture;
  window.addEventListener('message',event=>{const m=event.data;if(m?.protocol!==protocol||m.session!==session||!m.clientInstance)return;
   if(m.type==='ping'){send('pong');return;}
   if(m.type==='select'){
    requests.push(m);send('selection',{...(m.itemId==='card:c'||m.itemId==='m'?{sequence:++sequence,access:access(),state:native,document}:snapshot()),clientSelection:m.clientSelection,clientInstance:m.clientInstance});return;
   }
   if(!m.requestId||['requestStatus','cancel'].includes(m.type))return;requests.push(m);
   if(m.type==='condition'){if(fixture.hold)pending.push(m);else fixture.settle(m);return;}
   if(m.type==='stats'){for(const [key,value] of Object.entries(m.patch))state.stats[key]=typeof value==='string'&&/^[+-]/.test(value)?state.stats[key]+Number(value):Number(value);send('ack',{requestId:m.requestId,ok:true,result:{snapshot:snapshot(true)}});return;}
   if(m.type==='monsterSave'){raw=m.data;send('ack',{requestId:m.requestId,ok:true,result:{snapshot:snapshot(true)}});return;}
   send('ack',{requestId:m.requestId,ok:true,result:{}});
  });
 },{document,options});
 await page.goto('/#suite=monster234&bridge='+encodeURIComponent(String(test.info().project.use.baseURL)));
 await expect(page.locator('.app-shell')).toBeVisible();await page.evaluate(()=>(window as any).monster234.boot());await expect(page.getByRole('tab',{name:'双绑定旅人',exact:true})).toBeVisible();await page.evaluate(()=>(window as any).monster234.send('navigate'));await expect(page.locator('.paper .workbench-monster')).toBeVisible();return errors;
}
async function drag(page:Page,source:Locator,target:Locator){await source.scrollIntoViewIfNeeded();await target.scrollIntoViewIfNeeded();const a=(await source.boundingBox())!,b=(await target.boundingBox())!;await page.mouse.move(a.x+Math.min(15,a.width/2),a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+Math.min(35,b.width/2),b.y+Math.min(20,b.height/2),{steps:15});await page.mouse.up();}
async function wikiCondition(page:Page,name='隐形'){await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'状态',exact:true}).click();const row=page.locator('.catalog-row').filter({hasText:name});await expect(row).toBeVisible();return row;}
async function overview(page:Page){await page.getByRole('button',{name:'总览',exact:true}).click();await page.getByRole('button',{name:'怪物',exact:true}).click();return page.locator('[data-resource-target="m"]');}

test('drag invisible into the monster overview survives omitted-resource ACK, removal and refresh',async({page},info)=>{
 const errors=await open(page),source=await wikiCondition(page),card=await overview(page);
 await drag(page,source,card.locator('.resource179-name'));await expect(card.locator('[data-overview-condition]')).toHaveText('隐形');await expect(card.locator('[data-resource-id="breath"]')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).monster234.requests.find((m:any)=>m.type==='condition').itemId)).toBe('monster:m');
 await page.screenshot({path:info.outputPath('invisible-overview-after-partial-ack.png')});
 // The add gesture hides the real chip during its landing animation. A raw
 // mouseDown before that ends hits the page underneath, selecting text instead.
 const chip=card.locator('[data-overview-condition]');await expect(page.locator('.pointer-ghost')).toHaveCount(0);await expect(chip).toBeVisible();
 const box=(await chip.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(5,5,{steps:12});await expect(page.locator('.pointer-ghost.removal-preview')).toHaveCount(1);await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>(window as any).monster234.requests.filter((m:any)=>m.type==='condition').at(-1))).toMatchObject({action:'remove',itemId:'monster:m'});await expect(chip).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>(window as any).monster234.state.conditions.length)).toBe(0);await expect(page.locator('.pointer-ghost')).toHaveCount(0);
 await drag(page,source,card.locator('.resource179-name'));await expect(chip).toHaveText('隐形');
 await page.reload();await expect(page.locator('.app-shell')).toBeVisible();await page.evaluate(()=>(window as any).monster234.boot());await expect(page.getByRole('tab',{name:'双绑定旅人',exact:true})).toBeVisible();await page.evaluate(()=>(window as any).monster234.send('navigate'));await expect(page.locator('.workbench-monster [data-overview-condition]')).toHaveText('隐形');expect(errors).toEqual([]);
});

test('monster sheet stays usable while a condition receipt arrives after switching to the character',async({page},info)=>{
 const errors=await open(page);await page.evaluate(()=>(window as any).monster234.hold=true);await drag(page,await wikiCondition(page),page.locator('.workbench-monster > header'));
 await expect(page.locator('.workbench-monster [data-overview-condition]')).toHaveText('隐形');await page.getByRole('tab',{name:'双绑定旅人',exact:true}).click();await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('20');
 await page.evaluate(()=>(window as any).monster234.settle());await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('20');await page.getByRole('tab',{name:'怪物：桥卫',exact:true}).click();await expect(page.getByLabel('怪物生命',{exact:true})).toHaveValue('15');await expect(page.locator('.workbench-monster [data-overview-condition]')).toHaveText('隐形');
 await page.getByLabel('怪物生命',{exact:true}).fill('-1');await page.getByLabel('怪物生命',{exact:true}).press('Enter');await expect(page.getByLabel('怪物生命',{exact:true})).toHaveValue('14');
 await page.getByRole('switch',{name:'怪物编辑模式'}).click();await page.getByLabel('怪物名称',{exact:true}).fill('修改后的桥卫');await page.getByRole('button',{name:'保存资料',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).monster234.requests.filter((m:any)=>m.type==='monsterSave').length)).toBe(1);
 expect(await page.evaluate(()=>(window as any).monster234.requests.filter((m:any)=>['stats','monsterSave'].includes(m.type)).map((m:any)=>m.itemId))).toEqual(['monster:m','monster:m']);await page.screenshot({path:info.outputPath('monster-usable-after-dual-switch.png')});expect(errors).toEqual([]);
});

test('malformed legacy runtime and stale snapshots cannot crash or resurrect removed conditions',async({page})=>{
 const errors=await open(page,{malformed:true});const card=await overview(page);await expect(card.locator('[data-resource-id="breath"]')).toBeVisible();
 await page.evaluate(()=>{const f=(window as any).monster234;f.send('ack',{requestId:'new',ok:true,result:{snapshots:[{...f.snapshot(),sequence:20,state:{...f.state,conditions:[],resources:[{...f.state.resources[0],current:0}]}}]}});f.send('ack',{requestId:'old',ok:true,result:{snapshots:[{...f.snapshot(),sequence:19,state:{...f.state,conditions:[{id:'invisible',name:'隐形'}],resources:undefined}}]}});});
 await expect(card.locator('[data-overview-condition]')).toHaveCount(0);await expect(card.locator('[data-resource-id="breath"]')).toBeVisible();await page.getByRole('tab',{name:'怪物：桥卫',exact:true}).click();await expect(page.locator('.workbench-monster [data-overview-condition]')).toHaveCount(0);expect(errors).toEqual([]);
});

test('GM-owned dual token outside the player overview can switch both authorized sheets',async({page},info)=>{
 const errors=await open(page,{offRoster:true});await page.getByRole('tab',{name:'双绑定旅人',exact:true}).click();await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('20');
 const switchMonster=page.getByRole('tab',{name:'切换怪物卡',exact:true});await expect(switchMonster).toBeVisible();await switchMonster.click();await expect(page.locator('.workbench-monster')).toBeVisible();await expect(page.getByLabel('怪物生命',{exact:true})).toHaveValue('15');
 await page.getByRole('tab',{name:'双绑定旅人',exact:true}).click();await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('20');expect(await page.evaluate(()=>(window as any).monster234.requests.filter((m:any)=>m.type==='select').map((m:any)=>m.itemId))).toEqual(['card:c','monster:m','card:c']);await page.screenshot({path:info.outputPath('gm-dual-authorized-switch.png')});expect(errors).toEqual([]);
});

test('revoking the monster grant clears the sheet and late receipts cannot restore it',async({page})=>{
 const errors=await open(page);await page.evaluate(()=>{const f=(window as any).monster234;f.late=f.snapshot();f.setAccess({...f.access(),epoch:2,monsters:[]});});
 await expect(page.locator('.paper .workbench-monster')).toHaveCount(0);await expect(page.getByRole('tab',{name:'怪物：桥卫',exact:true})).toHaveCount(0);
 await page.evaluate(()=>{const f=(window as any).monster234;f.send('ack',{requestId:'late',ok:true,result:{snapshots:[f.late]}});f.send('cacheSnapshot',{...f.late,access:undefined,sequence:100});});
 await page.getByRole('tab',{name:'双绑定旅人',exact:true}).click();await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('20');await expect(page.locator('.paper .workbench-monster')).toHaveCount(0);expect(errors).toEqual([]);
});

test('an owner can use their authorized monster card while global monster search is hidden',async({page})=>{
 const errors=await open(page);await page.evaluate(()=>{const f=(window as any).monster234;f.setAccess({...f.access(),epoch:2,role:'PLAYER'});f.send('catalog',{sequence:f.snapshot().sequence,access:f.access(),cards:[f.native],monsters:[f.state],role:'PLAYER',enabled:f.access().enabled,visibility:{wiki:true,monsters:false}});f.send('selection',f.snapshot());f.send('navigate');});
 await expect(page.locator('.paper .workbench-monster')).toBeVisible();await expect(page.getByRole('switch',{name:'怪物编辑模式'})).toBeEnabled();await expect(page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'怪物',exact:true})).toHaveCount(0);
 await drag(page,await wikiCondition(page,'束缚'),page.locator('.workbench-monster > header'));await expect(page.locator('.workbench-monster [data-overview-condition]')).toHaveText('束缚');expect(errors).toEqual([]);
});

for(const restoreId of ['m','monster:m'])test(`map follow restores the dice page for ${restoreId==='m'?'raw token alias':'explicit monster target'}`,async({page},info)=>{
 const errors=await open(page);await page.getByRole('button',{name:'投骰',exact:true}).click();await expect(page.locator('.app-shell')).toHaveAttribute('data-workbench-page','dice');
 await page.evaluate(()=>{const f=(window as any).monster234;f.send('navigate',{itemId:'card:c',followSelection:true,followRevision:1});f.send('selection',{sequence:f.snapshot().sequence,state:f.native,document:f.document,access:f.access(),followRevision:1});});
 await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('20');await expect(page.locator('.app-shell')).toHaveAttribute('data-workbench-page','sheet');
 await page.evaluate(itemId=>{const f=(window as any).monster234;f.send('followEnd',{itemId,followRevision:2});f.send('selection',{...f.snapshot(),followRevision:2});},restoreId);
 await expect(page.locator('.workbench-bar > strong')).toHaveText('桥卫');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await expect(page.locator('.app-shell')).toHaveAttribute('data-workbench-page','dice');await page.screenshot({path:info.outputPath('restored-dice-page.png')});expect(errors).toEqual([]);
});
