import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';

// Authored fixtures carry the source schema, without publisher prose or players.
const cls={name:'原创成长职业',ENG_name:'Authored Progression',source:'XPHB',edition:'one',hd:{faces:8},
 classFeatures:[4,6].map(level=>`原创提升|原创成长职业|XPHB|${level}`),
 optionalfeatureProgression:[{name:'原创祈唤学习',featureType:['ei'],progression:[1,3,3,3,5,5]}]};
const data={class:[cls],classFeature:[4,6].map(level=>({name:'原创提升',source:'XPHB',className:cls.name,classSource:'XPHB',level,entries:['{@feat 原创提升专长|XPHB}']}))};
const feats={feat:[{name:'原创提升专长',ENG_name:'Authored Improvement',source:'XPHB',category:'G',repeatable:true,ability:[{choose:{from:['str','dex'],amount:2}}],prerequisite:[{level:4}],entries:['属性分配手动记录。']}]};
const optional={optionalfeature:[{name:'原创祈唤记录',ENG_name:'Authored Invocation',source:'XPHB',featureType:['EI'],entries:['只保存学习记录。']}]};
async function ready(page:Page){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/data/class/index.json',route=>route.fulfill({json:{authored:'class-authored.json'}}));
 await page.route('**/data/class/class-authored.json',route=>route.fulfill({json:data}));
 await page.route('**/data/feats.json',route=>route.fulfill({json:feats}));
 await page.route('**/data/optionalfeatures.json',route=>route.fulfill({json:optional}));
 await page.goto('/');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const entry:Entry={id:'authored-class-entry',kind:'class',name:cls.name,english:cls.ENG_name,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:[],raw:{...cls,_category:'class'}};
 const c=newCharacter();c.name='原创职业选择验收';c.automation=newAutomationState();
 c.selections=[{id:'class-owner',entry,level:6,quantity:1,equipped:false}];c.notes='手工记录保留';c.runtime.hp=3;
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 await page.getByTestId('character-file').setInputFiles({name:'authored-choices.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 await expect(page.getByRole('tab',{name:/原创职业选择验收（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
}
test('class grants appear in the feat region; optional learning drag saves without activation',async({page},info)=>{
 await ready(page);
 await expect(page.locator('.heritage-features [data-class-choice]')).toHaveCount(2);
 await page.getByRole('tab',{name:'特性',exact:true}).click();
 await page.locator('[data-class-choice]').filter({hasText:'原创祈唤学习'}).getByRole('button').click();
 await expect(page.locator('.choice-slot')).toHaveCount(5);
 const row=page.locator('.catalog-row').filter({hasText:'原创祈唤记录'}).first();await expect(row).toBeVisible();
 await row.scrollIntoViewIfNeeded();const from=await row.boundingBox();await page.mouse.move(from!.x+20,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(from!.x+30,from!.y+from!.height/2,{steps:3});
 const slot=page.locator('.choice-slot').first();await slot.scrollIntoViewIfNeeded();const to=await slot.boundingBox();await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:15});await page.mouse.up();await expect(slot).toContainText('原创祈唤记录');
 await page.getByRole('button',{name:'返回特性',exact:true}).click();await expect(page.locator('[data-class-choice]').filter({hasText:'原创祈唤学习'})).toContainText('原创祈唤记录');
 await page.screenshot({path:info.outputPath('class-learning.png')});await page.reload();await page.getByRole('tab',{name:'特性',exact:true}).click();
 await expect(page.locator('[data-class-choice]').filter({hasText:'原创祈唤学习'})).toContainText('原创祈唤记录');
});
