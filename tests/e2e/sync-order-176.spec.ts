import {test,expect,type Page} from '@playwright/test';
import {newCharacter} from '../../src/core/model';
import {exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
import {mockSource} from './fixtures';
const session='revision-regression',key='test-room:card:hero';
function snapshot(revision:number,hp:number,status=false){
 const c=newCharacter();c.name='同步验收角色';c.runtime.hp=hp;c.baseHp=20;c.runtime.resources={counter:{name:'补给',current:hp===5?0:2,max:2,type:'count'}};
 if(status)c.selections.push({id:'old-condition',entry:{id:'old-condition',kind:'condition',name:'束缚',english:'Restrained',source:'XPHB',edition:'2024',packId:'test',revision:'1',entries:['自制同步验收状态。'],raw:{}},quantity:1,level:1,equipped:false});
 return {sequence:revision,state:{key,itemId:'card:hero',cardId:'hero',slug:'',name:c.name,kind:'character',role:'GM',write:true,pinned:false,documentRevision:revision,stats:{health:hp,'max health':20,'temporary health':0,'armor class':10},resources:Object.entries(c.runtime.resources).map(([id,r])=>({...r,id})),conditions:status?[{id:'old-condition',name:'束缚'}]:[]},document:{...exportOwlbear(c,evaluate(c)),dnd_card_web:c,_suiteRevision:revision}};
}
async function host(page:Page,type:string,fields:Record<string,unknown>={},started=100){await page.evaluate(({type,fields,session,started})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session,hostStarted:started,type,...fields}})),{type,fields,session,started});}
test('a reconnected host cannot revive old status/resource/health snapshots in the actual client',async({page})=>{
 await mockSource(page);await page.goto(`/#suite=${session}&bridge=${encodeURIComponent(String(test.info().project.use.baseURL||'http://127.0.0.1:5178'))}`);
 await expect(page.locator('.app-shell')).toBeVisible();await host(page,'ready');
 const latest=snapshot(9,5),catalog=(s:ReturnType<typeof snapshot>,sequence:number)=>({sequence,role:'GM',enabled:{},cards:[{id:'hero',locked:false,inScene:true,...s.state}],monsters:[]});
 await host(page,'catalog',catalog(latest,1));await host(page,'selection',latest);await host(page,'navigate');
 const hp=page.getByLabel('当前生命值',{exact:true});await expect(hp).toHaveValue('5');
 await host(page,'selection',{...snapshot(8,12,true),sequence:50});await expect(hp).toHaveValue('5');await expect(page.locator('.paper')).not.toHaveClass(/condition-restrained/);
 await host(page,'catalog',catalog(snapshot(8,12,true),1),200);await host(page,'selection',{...snapshot(8,12,true),sequence:2},200);
 await expect(hp).toHaveValue('5');await expect(page.locator('.paper')).not.toHaveClass(/condition-restrained/);
 await page.getByRole('button',{name:'总览',exact:true}).click();await expect(page.getByRole('button',{name:'同步验收角色补给 1',exact:true})).toHaveAttribute('aria-pressed','false');await host(page,'navigate',{},200);
 await host(page,'selection',{...snapshot(10,4),sequence:3},200);await expect(hp).toHaveValue('4');
 const downgraded=snapshot(9,12,true);downgraded.state.write=false;await host(page,'selection',{...downgraded,sequence:4},200);
 await expect(hp).toHaveValue('4');await expect(page.getByRole('switch',{name:'编辑模式'})).toBeDisabled();
});
