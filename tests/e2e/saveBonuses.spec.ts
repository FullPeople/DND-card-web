import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {ABILITIES,ABILITY_LABELS,newCharacter,type Character,type Entry} from '../../src/core/model';
import {evaluate} from '../../src/core/engine';
import {initializeAutomation} from '../../src/core/automation/state';
import {syncAutoResources} from '../../src/core/resources';
import {exportCharacter,exportLinkedOwlbear} from '../../src/core/export';
import {expandChanges} from '../../src/platform/document-delta';

function fixture(){
 const c=newCharacter();c.name='原创豁免调整验收';c.abilities={str:16,dex:14,con:12,int:10,wis:8,cha:18};
 const entry:Entry={id:'save-bonus-class',name:'原创豁免职业',english:'Authored Save Class',kind:'class',source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:[],raw:{hd:{faces:8},proficiency:['str','wis']}};
 c.selections=[{id:'class',entry,level:5,quantity:1,equipped:false}];c.proficiencies={'save:con':true};c.skillBonuses={athletics:2};c.saveBonuses={str:2,dex:-1};c.runtime.tempHp=4;c.runtime.resources={spent:{name:'原创已用资源',current:1,max:4}};initializeAutomation(c);syncAutoResources(c);c.runtime.resources['hit-die:8'].current=2;return c;
}
async function saved(page:Page):Promise<Character>{return page.evaluate(async()=>{
 const names=await indexedDB.databases(),name=names.some(x=>x.name==='dnd-card-standalone')?'dnd-card-standalone':'dnd-card-workspace';const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{return await new Promise<Character>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result.characters.find((c:Character)=>c.id===r.result.activeId));r.onerror=()=>reject(r.error);});}finally{db.close();}
});}
async function load(page:Page,mode:'a4'|'screen'='a4'){
 await mockSource(page,{displayMode:mode});await suppressAnnouncement(page);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'save-bonuses.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(fixture())))});await expect(page.getByRole('tab',{name:/^原创豁免调整验收（导入）/})).toHaveAttribute('aria-selected','true');await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect.poll(async()=>(await saved(page)).saveBonuses?.str).toBe(2);
}
async function editMode(page:Page,enabled=true){const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});if(await toggle.getAttribute('aria-checked')!==String(enabled))await toggle.click();}
const input=(page:Page,ability:typeof ABILITIES[number])=>page.getByRole('spinbutton',{name:`${ABILITY_LABELS[ability]}豁免额外调整值`,exact:true});

test('six saving throws accept signed offsets, cancel blank/invalid drafts, undo and persist without changing skills or resources',async({page})=>{
 await load(page);await expect(page.locator('.save-extra-adjustment')).toHaveCount(0);await editMode(page);const before=await saved(page);await expect(page.locator('.save-extra-adjustment')).toHaveCount(6);await expect(page.locator('.ability-save input[type=checkbox]:enabled')).toHaveCount(0);
 for(const [i,ability] of ABILITIES.entries()){
  const value=i%2?-(i+1):i+1,field=input(page,ability);await field.fill(String(value));await field.press(i%2?'Tab':'Enter');await expect.poll(async()=>(await saved(page)).saveBonuses?.[ability]).toBe(value);await expect(page.locator(`.ability-${ability} .ability-save b`)).toHaveText((evaluate({...before,saveBonuses:{[ability]:value}}).saves[ability].value>=0?'+':'')+evaluate({...before,saveBonuses:{[ability]:value}}).saves[ability].value);
 }
 const field=input(page,'str');await field.fill('-4');await field.press('Escape');await expect(field).toHaveValue('1');await field.fill('');await field.press('Tab');await expect(field).toHaveValue('1');await field.focus();await field.press('ControlOrMeta+A');await field.press('e');await field.press('Tab');await expect(field).toHaveValue('1');
 await field.fill('10000');await field.press('Enter');await expect(field).toHaveValue('9999');await field.fill('-10000');await field.press('Enter');await expect(field).toHaveValue('-9999');await field.fill('1.9');await field.press('Tab');await expect(field).toHaveValue('1');
 await field.fill('-2');await field.press('Enter');await expect.poll(async()=>(await saved(page)).saveBonuses?.str).toBe(-2);await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(field).toHaveValue('1');await page.getByRole('button',{name:'重做',exact:true}).click();await expect(field).toHaveValue('-2');
 await field.fill('0');await field.press('Enter');await expect.poll(async()=>(await saved(page)).saveBonuses?.str).toBeUndefined();await expect(page.locator('.ability-str .ability-save b')).toHaveText('+6');await field.fill('3');await field.press('Tab');await expect.poll(async()=>(await saved(page)).saveBonuses?.str).toBe(3);
 const after=await saved(page);expect(after.runtime).toEqual(before.runtime);expect(after.skillBonuses).toEqual(before.skillBonuses);expect(after.proficiencies).toEqual(before.proficiencies);expect(after.abilities).toEqual(before.abilities);await page.reload();await expect(input(page,'str')).toHaveValue('3');await expect(page.locator('.ability-str .ability-save b')).toHaveText('+9');await editMode(page,false);await expect(page.locator('.save-extra-adjustment')).toHaveCount(0);await expect(page.locator('.ability-str .ability-save b')).toHaveText('+9');
});

test('a read-only second tab retains totals without exposing saving-throw editors',async({page,context})=>{
 await load(page);await editMode(page);const viewer=await context.newPage();await mockSource(viewer);await suppressAnnouncement(viewer);await viewer.goto('/');await expect(viewer.locator('.read-only-banner')).toBeVisible();await expect(viewer.locator('.save-extra-adjustment')).toHaveCount(0);await expect(viewer.locator('.ability-str .ability-save b')).toHaveText('+8');expect((await saved(viewer)).saveBonuses).toEqual({str:2,dex:-1});await viewer.close();
});

for(const mode of ['a4','screen'] as const)test(`${mode} save adjustments align with skill adjustments at desktop and narrow widths`,async({page})=>{
 await load(page,mode);await editMode(page);
 for(const width of [1512,390]){await page.setViewportSize({width,height:982});await expect(page.locator('.save-extra-adjustment')).toHaveCount(6);
  const boxes=await page.locator('.ability-box').evaluateAll(elements=>elements.map(box=>{const save=box.querySelector<HTMLElement>('.ability-save')!,skill=box.querySelector<HTMLElement>('.ability-skill'),field=save.querySelector<HTMLElement>('.save-extra-adjustment')!,label=save.children[2] as HTMLElement;return {overflow:save.scrollWidth-save.clientWidth,labelOverflow:label.scrollWidth-label.clientWidth,visible:field.getBoundingClientRect().width>0,columns:[...save.children].map((el,i)=>skill?Math.abs(el.getBoundingClientRect().x-skill.children[i].getBoundingClientRect().x):0),height:field.offsetHeight};}));
  for(const box of boxes){expect(box.overflow).toBeLessThanOrEqual(1);expect(box.labelOverflow).toBe(0);expect(box.visible).toBe(true);expect(box.height).toBeGreaterThanOrEqual(17);for(const delta of box.columns)expect(delta).toBeLessThan(1.1);}expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await input(page,'str').focus();await expect(input(page,'str')).toBeFocused();await page.screenshot({path:test.info().outputPath(`save-adjustments-${mode}-${width}.png`)});if(mode==='screen')await page.locator('.screen-abilities').screenshot({path:test.info().outputPath(`save-adjustments-abilities-${width}.png`)});
 }
});

test('Owlbear sends independent native and projected legacy offsets, and permission revocation removes pending editors',async({page,baseURL},info)=>{
 test.skip(info.project.name==='standalone','Standalone intentionally excludes the Owlbear bridge');
 const c=fixture(),document={...exportLinkedOwlbear(c,evaluate(c)),_suiteRevision:1};await mockSource(page);const url=new URL(baseURL!);url.hash='suite=save-bonuses&bridge='+encodeURIComponent(url.origin);await page.goto(url.href);await expect(page.locator('.app-shell')).toBeVisible();
 await page.evaluate(document=>{
  const w=window as any;let sequence=0,epoch=1,doc=document,writable=true;w.saves=[];
  const emit=(type:string,rest:any={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session:'save-bonuses',hostStarted:244,type,...rest}}));
  const state=()=>({key:'room:card:save-bonuses',itemId:'card:save-bonuses',cardId:'save-bonuses',kind:'character',name:'原创豁免调整验收',write:writable,role:'PLAYER',locked:false,documentRevision:doc._suiteRevision,stats:{health:1,'max health':1,'armor class':10},resources:[],conditions:[]});const access=()=>({room:'room',scope:'room:scene',epoch,role:'PLAYER',cards:[{id:'save-bonuses',itemId:'card:save-bonuses',write:writable,locked:false}],monsters:[],enabled:{characterCards:true}});const snap=()=>({sequence:++sequence,state:state(),document:doc,access:access()});
  w.finish=(native:any,data:any)=>{const m=w.saves.at(-1);doc={...data,dnd_card_web:native,_suiteRevision:doc._suiteRevision+1};emit('ack',{requestId:m.requestId,ok:true,result:{snapshot:snap()}});emit('selection',snap());};w.revoke=()=>{writable=false;epoch++;emit('access',{access:access()});};
  window.addEventListener('message',e=>{const m=e.data;if(m?.session!=='save-bonuses')return;if(m.type==='ping')emit('pong');if(m.type==='select')emit('selection',snap());if(m.type==='save')w.saves.push(m);});emit('ready');emit('catalog',{sequence:++sequence,access:access(),role:'PLAYER',enabled:{characterCards:true},cards:[{id:'save-bonuses',inScene:false,...state()}],monsters:[]});emit('selection',snap());emit('navigate');
 },document);
 await page.getByRole('tab',{name:c.name,exact:true}).click();await editMode(page);await input(page,'str').fill('-2');await input(page,'str').press('Enter');await expect(page.locator('.ability-str .ability-save b')).toHaveText('+4');await expect.poll(()=>page.evaluate(()=>(window as any).saves.length)).toBe(1);
 const save=await page.evaluate(()=>(window as any).saves[0]),native=expandChanges(c,save.delta.native,'after'),legacy=expandChanges(document,save.delta.legacy,'after');expect(native.saveBonuses.str).toBe(-2);expect(native.saveBonuses.dex).toBe(-1);expect(native.runtime).toEqual(c.runtime);expect(legacy.abilities.str.save.bonus).toBe(4);expect(legacy.abilities.dex.save.bonus).toBe(1);await page.evaluate(({native,legacy})=>(window as any).finish(native,legacy),{native,legacy});await expect(page.getByRole('alert')).toHaveCount(0);
 await input(page,'str').fill('9');await page.evaluate(()=>(window as any).revoke());await expect(page.locator('.save-extra-adjustment')).toHaveCount(0);await expect(page.locator('.ability-str .ability-save b')).toHaveText('+4');expect(await page.evaluate(()=>(window as any).saves.length)).toBe(1);
});
