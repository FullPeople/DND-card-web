import {test,expect,type Page} from '@playwright/test';
import {newCharacter,type Character,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';
import {mockSource,suppressAnnouncement} from './fixtures';

const data={background:[{name:'气泡背景验收',source:'XPHB',ability:[{choose:{weighted:{from:['int','wis','cha'],weights:[2,1]}}}],startingEquipment:[{_:[{item:'固定旅行包|XPHB'},{value:500}],A:[{item:'可选旅行杖|XPHB'},{value:300}],B:[{value:1200}]}],entries:['原创来源选择验收。']}],item:[{name:'固定旅行包',source:'XPHB',weight:1},{name:'可选旅行杖',source:'XPHB',weight:2}]};
const entries:Entry[]=Object.entries(data).flatMap(([kind,rows])=>rows.map(raw=>({id:`fixture:${kind}:${raw.source}:${raw.name}`,kind:kind as Entry['kind'],name:raw.name,english:raw.name,source:raw.source,edition:'2024',packId:'test',revision:'1',entries:'entries' in raw?raw.entries:[],raw}))),background=entries.find(entry=>entry.kind==='background')!;
function dwarfEntry(name:string):Entry{return {id:`fixture:race:PHB:${name}`,kind:'race',name,english:name,source:'PHB',edition:'2014',packId:'test',revision:'1',entries:['原创矮人体质来源验收。'],raw:{ability:[{con:2}],speed:25}};}
const possessions=(c:Character)=>c.selections.filter(row=>row.entry.kind==='item').map(({id,quantity,equipped,attuned})=>({id,quantity,equipped,attuned}));
function character(){const c=newCharacter();c.name='背景气泡卡';c.automation=newAutomationState();c.selections=[{id:'bubble-background',entry:background,quantity:1,level:1,equipped:false}];return c;}
async function ready(page:Page,c=character()){
 await mockSource(page);await suppressAnnouncement(page);await page.route('**/data/backgrounds.json',route=>route.fulfill({json:{background:data.background}}));await page.route('**/data/items.json',route=>route.fulfill({json:{item:data.item}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 await page.getByTestId('character-file').setInputFiles({name:'source-choice.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 if(c.edition==='2014'){
  const review=page.getByRole('dialog',{name:'导入前核对',exact:true});await expect(review).toBeVisible();await expect(review).toContainText('导入角色使用 2014，当前规则使用 2024。导入后保留该角色自己的规则版本。');
  await expect(page.locator('.character-tabs [role="tab"]').filter({hasText:c.name})).toHaveCount(0);
  await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();await expect(review).toHaveCount(0);
 }
 const selected=page.locator('.character-tabs [role="tab"]').filter({hasText:c.name});await expect(selected).toHaveAttribute('title',c.name+'（导入）');await expect(selected).toHaveAttribute('aria-selected','true');await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await expect(page.locator('.save-status')).toContainText('已保存到本机');const persisted=await saved(page);expect(persisted.name).toBe(c.name+'（导入）');expect(persisted.edition).toBe(c.edition);expect(persisted.racialAbilityMode).toBe(c.racialAbilityMode);
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
}
/** This spec is served by playwright.wiki232 in standalone mode. Reject an
 * absent database/store explicitly: opening the integrated DB would create an
 * empty database and throw inside onsuccess, leaving the old poll unresolved. */
async function saved(page:Page):Promise<Character>{return page.evaluate(()=>new Promise<Character>((resolve,reject)=>{
 const request=indexedDB.open('dnd-card-standalone');request.onerror=()=>reject(request.error);request.onupgradeneeded=()=>{request.transaction?.abort();reject(Error('Standalone workspace database is not present.'));};
 request.onsuccess=()=>{const db=request.result;try{const tx=db.transaction('documents'),get=tx.objectStore('documents').get('workspace');tx.onerror=()=>{db.close();reject(tx.error);};get.onerror=()=>{db.close();reject(get.error);};get.onsuccess=()=>{const workspace=get.result,active=workspace?.characters?.find((card:Character)=>card.id===workspace.activeId);db.close();if(!active)reject(Error('Saved active character is absent.'));else resolve(active);};}catch(error){db.close();reject(error);}};
}));}


test('background without feature rows exposes its choices on the main sheet and removes the old top controls',async({page},info)=>{
 await ready(page);const heritage=page.locator('.heritage-features');await expect(heritage).toContainText('背景 气泡背景验收');await expect(heritage.getByRole('button',{name:'背景属性 0/1',exact:true})).toHaveClass(/is-pending/);
 await heritage.getByRole('button',{name:'背景属性 0/1',exact:true}).click();const allocation=page.getByRole('region',{name:'选择背景属性',exact:true});await expect(allocation).toContainText('不会再次叠加');await allocation.getByRole('button',{name:'智力 +2、感知 +1',exact:true}).click();await allocation.getByRole('button',{name:'完成并返回',exact:true}).click();
 await expect(page.locator('.background-grants,.background-ability-choices,.equipment-choices')).toHaveCount(0);await expect(page.getByRole('button',{name:'背景属性 1/1',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'起始装备 0/1',exact:true}).click();const equipment=page.getByRole('region',{name:'选择起始装备',exact:true});await equipment.getByRole('button',{name:'方案 A',exact:true}).click();await equipment.getByRole('button',{name:'取消并返回',exact:true}).click();
 await expect(page.getByRole('button',{name:'起始装备 0/1',exact:true})).toBeVisible();await page.getByRole('button',{name:'起始装备 0/1',exact:true}).click();await equipment.getByRole('button',{name:'方案 A',exact:true}).click();await equipment.getByRole('button',{name:'领取装备',exact:true}).click();
 await expect.poll(async()=>{const c=await saved(page);return c.inventory?.coins.gp;}).toBe(8);const first=await saved(page);expect(first.backgroundChoices?.['bubble-background'].abilities).toEqual({int:2,wis:1});expect(first.abilities.int).toBe(10);expect(first.selections.filter(row=>row.entry.kind==='item')).toHaveLength(2);expect(Object.values(first.inventory?.sourceEquipment||{})).toHaveLength(1);expect(Object.values(first.inventory!.sourceEquipment!)[0]).toMatchObject({completed:true,received:['0:_','0:A']});
 await page.getByRole('tab',{name:'背包',exact:true}).click();await expect(page.locator('.stock-item').filter({hasText:'固定旅行包'})).toHaveCount(1);await expect(page.locator('.stock-item').filter({hasText:'可选旅行杖'})).toHaveCount(1);
 await page.reload();await expect(page.locator('.save-status')).toContainText('已保存到本机');const restored=await saved(page);expect(restored.inventory?.coins.gp).toBe(8);expect(restored.inventory?.sourceEquipment).toEqual(first.inventory?.sourceEquipment);expect(possessions(restored)).toEqual(possessions(first));await page.getByRole('tab',{name:'特性',exact:true}).click();await expect(page.locator('.background-grants,.equipment-choices')).toHaveCount(0);await page.screenshot({path:info.outputPath('unified-background-choices.png')});
});

test('legacy chosen background preserves possessions and spent balance, while explicit reclaim adds the package',async({page})=>{
 const c=character();c.backgroundChoices={'bubble-background':{abilities:{int:2,wis:1},equipment:{'0':'A'}}};c.inventory={view:'grid',order:[],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:1,pp:0},grantedCoins:{'bubble-background|equipment:0':8}};c.featureLayout={order:[],expanded:[],optionsVisible:{'bubble-background':true}};
 c.selections.push({id:'kept-old-staff',entry:entries.find(entry=>entry.name==='可选旅行杖')!,quantity:4,level:1,equipped:true,parentId:'bubble-background',grantKey:'equipment:0:A:0'});await ready(page,c);
 await expect.poll(async()=>(await saved(page)).inventory?.coins.gp).toBe(1);expect((await saved(page)).selections.find(row=>row.id==='kept-old-staff')).toMatchObject({quantity:4,equipped:true});
 await page.locator('.heritage-features').getByRole('button',{name:'起始装备 1/1',exact:true}).click();const equipment=page.getByRole('region',{name:'选择起始装备',exact:true});await expect(equipment.getByRole('status')).toContainText('再次确认会追加装备');await equipment.getByRole('button',{name:'领取装备',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).inventory?.coins.gp).toBe(9);const claimed=await saved(page);expect(claimed.selections.find(row=>row.id==='kept-old-staff')?.quantity).toBe(4);expect(claimed.selections.filter(row=>row.entry.kind==='item')).toHaveLength(3);expect(Object.values(claimed.inventory?.sourceEquipment||{})).toHaveLength(1);await page.reload();await expect(page.locator('.save-status')).toContainText('已保存到本机');const restored=await saved(page);expect(restored.inventory?.coins.gp).toBe(9);expect(restored.inventory?.sourceEquipment).toEqual(claimed.inventory?.sourceEquipment);expect(possessions(restored)).toEqual(possessions(claimed));
});

test('new 2014 dwarf shows base 14 plus racial 2 and preserves the calculation after reload',async({page},info)=>{
 const c=character();c.edition='2014';c.abilities.con=14;c.selections=[{id:'racial-source',entry:dwarfEntry('验收矮人'),quantity:1,level:1,equipped:false}];
 await ready(page,c);await page.getByRole('spinbutton',{name:'体质基础值',exact:true}).click();const trace=page.getByRole('dialog',{name:'体质数据追溯',exact:true});await expect(trace).toContainText('基础 14');await expect(trace).toContainText('种族：验收矮人 · PHB +2');await expect(trace.locator('.trace-result strong')).toHaveText('16');await expect(page.locator('.ability-con .ability-modifier')).toHaveText('+3');await page.screenshot({path:info.outputPath('dwarf-constitution-14-plus-2.png')});await page.keyboard.press('Escape');
 await page.reload();await expect(page.getByRole('spinbutton',{name:'体质基础值',exact:true})).toHaveValue('14');await expect(page.locator('.ability-con .ability-modifier')).toHaveText('+3');expect((await saved(page)).racialAbilityMode).toBe('separate-v1');
});

test('legacy manually adjusted dwarf retains its total and displays the unconfirmed migration warning',async({page})=>{
 const c=character();c.edition='2014';delete c.racialAbilityMode;c.abilities.con=16;c.selections=[{id:'legacy-racial-source',entry:dwarfEntry('验收旧矮人'),quantity:1,level:1,equipped:false}];
 await ready(page,c);await page.getByRole('spinbutton',{name:'体质基础值',exact:true}).click();const trace=page.getByRole('dialog',{name:'体质数据追溯',exact:true});await expect(trace).toContainText('尚未确认');await expect(trace.locator('.trace-result strong')).toHaveText('16');await expect(page.locator('.ability-con .ability-modifier')).toHaveText('+3');expect((await saved(page)).racialAbilityMode).toBeUndefined();
});
