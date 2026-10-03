import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {armorFeatureFixture} from '../fixtures/featureArmor';
import type {Entry} from '../../src/core/model';
import {exportCharacter} from '../../src/core/export';

async function ready(page:Page,edition:'2014'|'2024'){
 const {c,data}=armorFeatureFixture(edition,(data,revision)=>Object.entries(data).flatMap(([category,rows])=>rows.map((raw:any):Entry=>({id:`fixture:${category}:${raw.source}:${raw.ENG_name||raw.name}`,kind:['classFeature','optionalfeature'].includes(category)?'feature':category as Entry['kind'],name:raw.name,english:raw.ENG_name||raw.name,source:raw.source,edition,packId:'fixture',revision,entries:raw.entries||[],raw:{...raw,_category:category}}))));c.name=`护甲来源${edition}`;c.runtime.resources={spent:{current:0,max:2}};
 await mockSource(page);await suppressAnnouncement(page);
 await page.route('**/data/class/index.json',r=>r.fulfill({json:{fixture:'class-armor.json'},headers:{'access-control-allow-origin':'*'}}));
 await page.route('**/data/class/class-armor.json',r=>r.fulfill({json:data,headers:{'access-control-allow-origin':'*'}}));
 await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'armor.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 await expect(page.getByRole('tab',{name:new RegExp(`^护甲来源${edition}（导入）`)})).toHaveAttribute('aria-selected','true');
 await page.getByRole('dialog',{name:'导入与导出',exact:true}).getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
}
async function choose(page:Page,name:string){
 await page.getByRole('tab',{name:'特性',exact:true}).click();
 const caption=page.locator('[data-feature-id]').filter({hasText:'测试风格'}).first().locator('.feature-caption');
 if(await caption.getAttribute('aria-label').then(label=>label?.startsWith('选择')))await caption.click();else{if(await caption.getAttribute('aria-expanded')!=='true')await caption.click();await page.locator('[data-feature-id]').filter({hasText:'测试风格'}).first().getByRole('button',{name:/^调整测试风格/}).click();}
 const choices=page.getByRole('region',{name:'选择测试风格',exact:true});await expect(choices).toBeVisible();
 await choices.getByRole('button',{name,exact:true}).click();await page.getByRole('button',{name:'返回特性',exact:true}).click();
 await page.getByRole('tab',{name:'主要',exact:true}).click();
}
for(const edition of ['2014','2024'] as const)test(`${edition} dashed source choice applies armor AC, replacement/undo/reload and shield-only conditions`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page,edition);const ac=page.locator('.armor-cell [data-stat="ac"]');await expect(ac).toHaveText('16');
 await page.getByRole('tab',{name:'特性',exact:true}).click();const pending=page.locator('[data-feature-id]').filter({hasText:'测试风格'}).first();await expect(pending).toHaveClass(/is-pending|choice-pending/);
 await choose(page,'测试护甲加值');await expect(ac).toHaveText('17');await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(ac).toHaveText('16');await page.getByRole('button',{name:'重做',exact:true}).click();await expect(ac).toHaveText('17');
 const offset=page.getByLabel('护甲等级调整值',{exact:true});await offset.fill('2');await offset.press('Enter');await expect(ac).toHaveText('19');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.reload({waitUntil:'domcontentloaded'});await expect(ac).toHaveText('19');await page.getByRole('button',{name:'自动化设置',exact:true}).click();
 await page.getByRole('checkbox',{name:'装备 测试盾',exact:true}).check();await expect(page.getByTestId('automation-ac')).toHaveText('21');
 await page.getByRole('checkbox',{name:'装备 测试身甲',exact:true}).uncheck();await expect(page.getByTestId('automation-ac')).toHaveText('14');
 await page.getByRole('checkbox',{name:'装备 测试身甲',exact:true}).check();await expect(page.getByTestId('automation-ac')).toHaveText('21');await page.keyboard.press('Escape');
 await choose(page,'测试替代');await expect(ac).toHaveText('20');await choose(page,'测试护甲加值');await expect(ac).toHaveText('21');
 await page.locator('.armor-cell').screenshot({path:test.info().outputPath(`armor-source-${edition}.png`)});expect(errors).toEqual([]);
});
