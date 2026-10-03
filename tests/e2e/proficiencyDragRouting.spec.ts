import {test,expect,type Page,type Locator} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Character} from '../../src/core/model';
import {exportCharacter} from '../../src/core/export';

const name='原创校准器';
async function ready(page:Page,editing=true){
 await mockSource(page);await suppressAnnouncement(page);
 await page.route('**/data/items-base.json',route=>route.fulfill({json:{baseitem:[{name,ENG_name:'Original Calibrator',source:'XPHB',type:'AT',weight:1,value:100,entries:['原创工具熟练拖拽验收。']}]}}));
 await page.route('**/data/class/class-test.json',route=>route.fulfill({json:{class:[{name:'原创技师',source:'XPHB',hd:{faces:8},startingProficiencies:{tools:[`{@item ${name}|XPHB}`]},startingEquipment:{entries:[`{@item ${name}|XPHB}`]},entries:['用于区分熟练与真实装备来源。']}]}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 const c=newCharacter();c.name='熟练拖拽验收';c.training={tools:'',armor:'',weapons:'',languages:''};
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'proficiency-drag.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 await expect(page.locator('.character-tabs').getByRole('tab',{name:c.name+'（导入）',exact:true})).toHaveAttribute('aria-selected','true');await page.getByRole('dialog',{name:'导入与导出',exact:true}).getByRole('button',{name:'关闭弹窗',exact:true}).click();
 if(editing)await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
}
async function source(page:Page,tab='装备词条'){
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:tab,exact:true}).click();await page.getByLabel(`${tab}分类搜索`,{exact:true}).fill(name);const row=page.locator('.catalog-row').filter({hasText:name});await expect(row).toHaveCount(1);return row;
}
async function lift(page:Page,row:Locator){
 await row.scrollIntoViewIfNeeded();const b=(await row.boundingBox())!;await page.mouse.move(b.x+Math.min(20,b.width/2),b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+Math.min(20,b.width/2)-30,b.y+b.height/2,{steps:4});await expect(page.locator('.pointer-ghost')).toHaveCount(1);
}
async function land(page:Page,target:Locator){const b=(await target.boundingBox())!;await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();await expect(page.locator('.pointer-ghost')).toHaveCount(0);}
async function exported(page:Page):Promise<Character>{
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByRole('button',{name:'生成并复制 JSON',exact:true}).click();const c=JSON.parse(await page.getByLabel('角色 JSON 文本').inputValue()).character;await page.getByRole('dialog',{name:'导入与导出',exact:true}).getByRole('button',{name:'关闭弹窗',exact:true}).click();return c;
}
for(const origin of ['list','detail'] as const)test(`equipment training ${origin} drag stays on main, deduplicates and survives reload without inventory`,async({page})=>{
 await ready(page);let row=await source(page);if(origin==='detail'){await row.click();await expect(page.getByLabel('装备词条分类搜索',{exact:true})).toBeVisible();row=page.locator('.detail-title');}
 const training=page.locator('.training-row').filter({hasText:'工具'});
 await lift(page,row);await expect(page.getByRole('tab',{name:'主要',exact:true})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await page.mouse.up();await expect(training.locator('.feature-bubble')).toHaveCount(0);
 for(let i=0;i<2;i++){await lift(page,row);await expect(page.getByRole('tab',{name:'主要',exact:true})).toHaveAttribute('aria-selected','true');await land(page,training);await expect(training.locator('.feature-bubble')).toHaveCount(1);}
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();await expect(training).toContainText(name);const c=await exported(page);expect(c.training?.tools).toBe(`{@item ${name}|XPHB}`);expect(c.selections.filter(s=>s.entry.kind==='item')).toHaveLength(0);
 await page.screenshot({path:test.info().outputPath(`proficiency-${origin}.png`)});
});
test('training intent cannot enter backpack after deliberate tab hover, but the same equipment item can',async({page})=>{
 await ready(page);const row=await source(page);await lift(page,row);const tab=page.getByRole('tab',{name:'背包',exact:true}),b=(await tab.boundingBox())!;await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await expect(tab).toHaveAttribute('aria-selected','true');await expect(page.locator('.paper .stock-drop-zone')).not.toHaveClass(/drop-ready/);await land(page,page.locator('.paper .stock-empty').first());expect((await exported(page)).selections.filter(s=>s.entry.kind==='item')).toHaveLength(0);
 await page.getByRole('tab',{name:'主要',exact:true}).click();const equipment=await source(page,'装备');await lift(page,equipment);await expect(tab).toHaveAttribute('aria-selected','true');await land(page,page.locator('.paper .stock-empty').first());await expect(page.locator('.paper .stock-item').filter({hasText:name})).toHaveCount(1);const c=await exported(page);expect(c.selections.filter(s=>s.entry.kind==='item')).toHaveLength(1);expect(c.training?.tools).toBe('');
});
test('starting proficiency prose has training semantics',async({page})=>{
 await ready(page);await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'职业',exact:true}).click();await page.locator('.catalog-row').filter({hasText:'原创技师'}).click();
 const proficiency=page.locator('.document-section[data-entry-drag-intent="training"]');const toggle=proficiency.getByRole('button',{name:/展开段落/});if(await toggle.count())await toggle.click();
 const ref=proficiency.locator('.inline-reference').filter({hasText:name});await expect(ref).toHaveCount(1);await lift(page,ref);await expect(page.getByRole('tab',{name:'主要',exact:true})).toHaveAttribute('aria-selected','true');await land(page,page.locator('.training-row').filter({hasText:'工具'}));
 const c=await exported(page);expect(c.training?.tools).toBe(`{@item ${name}|XPHB}`);expect(c.selections.filter(s=>s.entry.kind==='item')).toHaveLength(0);
});
test('proficiency drops require editing even though the underlying tool is an item',async({page})=>{
 await ready(page,false);await lift(page,await source(page));await land(page,page.locator('.training-row').filter({hasText:'工具'}));await expect(page.locator('.suite-toast')).toContainText('开启编辑模式');const c=await exported(page);expect(c.training?.tools).toBe('');expect(c.selections.filter(s=>s.entry.kind==='item')).toHaveLength(0);
});
