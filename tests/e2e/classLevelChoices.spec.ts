import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';
import {restoreAuthoredChoices} from './authoredChoicesFixture';

// Authored fixtures carry the source schema, without publisher prose or players.
const cls={name:'原创成长职业',ENG_name:'Authored Progression',source:'XPHB',edition:'one',hd:{faces:8},
 classFeatures:[4,6].map(level=>`原创提升|原创成长职业|XPHB|${level}`),
 optionalfeatureProgression:[{name:'原创祈唤学习',featureType:['ei'],progression:Array.from({length:20},(_,i)=>i===0?1:i<4?3:5)}]};
const data={class:[cls],classFeature:[4,6].map(level=>({name:'原创提升',source:'XPHB',className:cls.name,classSource:'XPHB',level,entries:['{@feat 原创提升专长|XPHB}']}))};
const feats={feat:[{name:'原创提升专长',ENG_name:'Authored Improvement',source:'XPHB',category:'G',repeatable:true,ability:[{choose:{from:['str','dex'],amount:2}}],prerequisite:[{level:4}],entries:['属性分配手动记录。']}]};
const optional={optionalfeature:[{name:'原创祈唤记录',ENG_name:'Authored Invocation',source:'XPHB',featureType:['EI'],entries:['只保存学习记录。']}]};
async function ready(page:Page,withFeatPrerequisite=false){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.context().route('**/data/class/index.json',route=>route.fulfill({json:{authored:'class-authored.json'}}));
 await page.context().route('**/data/class/class-authored.json',route=>route.fulfill({json:data}));
 const prerequisiteFeats=[{name:'原创起源前置',source:'XPHB',category:'O',entries:[]},{name:'原创前置后续',source:'XPHB',category:'G',prerequisite:[{level:4,feat:['原创起源前置|XPHB']}],entries:[]}];
 await page.context().route('**/data/feats.json',route=>route.fulfill({json:withFeatPrerequisite?{feat:[...feats.feat,...prerequisiteFeats]}:feats}));
 await page.context().route('**/data/optionalfeatures.json',route=>route.fulfill({json:optional}));
 await page.goto('/');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const entry:Entry={id:'authored-class-entry',kind:'class',name:cls.name,english:cls.ENG_name,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:[],raw:{...cls,_category:'class'}};
 const c=newCharacter();c.name='原创职业选择验收';c.automation=newAutomationState();
 c.selections=[{id:'class-owner',entry,level:6,quantity:1,equipped:false}];c.notes='手工记录保留';c.runtime.hp=3;
 if(withFeatPrerequisite){
  c.selections[0].level=4;
  c.selections.push({id:'origin-background',entry:{id:'origin-background-entry',kind:'background',name:'原创起源背景',english:'Authored Origin Background',source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:[],raw:{feats:[{'原创起源前置|XPHB':true}]}},level:1,quantity:1,equipped:false});
 }
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 await page.getByTestId('character-file').setInputFiles({name:'authored-choices.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 await expect(page.getByRole('tab',{name:/原创职业选择验收（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 await restoreAuthoredChoices(page,'dnd-card-standalone');
}
async function openFeatures(page:Page){
 const tab=page.getByRole('tab',{name:'特性',exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');
 const body=page.locator('.paper.page-1 .features-page-grid');await expect(body).toBeVisible();await expect(body.locator('.detail-class-features')).toBeVisible();await expect(page.locator('.overview-choice-overlay')).toHaveCount(0);
 return body;
}
test('class grants appear in the feat region; optional learning drag saves without activation',async({page},info)=>{
 await ready(page);
 await expect(page.locator('.heritage-features [data-class-choice]')).toHaveCount(2);
 const features=await openFeatures(page),learning=features.locator('[data-class-choice]').filter({hasText:'原创祈唤学习'});
 await learning.getByRole('button').click();
 const choice=features.getByRole('region',{name:'选择原创祈唤学习',exact:true});await expect(choice).toBeVisible();await expect(choice.locator('.choice-slot')).toHaveCount(5);
 if((page.viewportSize()?.width||0)<=760)await choice.getByRole('button',{name:'打开候选资料',exact:true}).click();
 const row=page.locator('.catalog-row').filter({hasText:'原创祈唤记录'}).first();await expect(row).toBeVisible();
 await row.scrollIntoViewIfNeeded();const from=await row.boundingBox();await page.mouse.move(from!.x+20,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(from!.x+30,from!.y+from!.height/2,{steps:3});
 const slot=choice.locator('.choice-slot').first();await slot.scrollIntoViewIfNeeded();const to=await slot.boundingBox();await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:15});await page.mouse.up();await expect(slot).toContainText('原创祈唤记录');
 await choice.getByRole('button',{name:'收起选择',exact:true}).click();await expect(learning).toContainText('原创祈唤记录');
 await page.screenshot({path:info.outputPath('class-learning.png')});await page.reload();const restored=await openFeatures(page);
 await expect(restored.locator('[data-class-choice]').filter({hasText:'原创祈唤学习'})).toContainText('原创祈唤记录');
});

test('a background origin feat unlocks the level-four source feat and persists through reload',async({page})=>{
 await ready(page,true);const features=await openFeatures(page);
 const grant=features.getByRole('region',{name:'职业特性',exact:true}).getByRole('button',{name:/^原创提升（职业 4 级）/});
 await grant.click();const choice=features.locator('.choice-workspace');await expect(choice).toBeVisible();
 if((page.viewportSize()?.width||0)<=760)await choice.getByRole('button',{name:'打开候选资料',exact:true}).click();
 const row=page.locator('.catalog-row').filter({hasText:'原创前置后续'}).first();await expect(row).toBeVisible();await row.scrollIntoViewIfNeeded();
 const from=await row.boundingBox();await page.mouse.move(from!.x+20,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(from!.x+30,from!.y+from!.height/2,{steps:3});
 const slot=choice.locator('.choice-slot').first();await slot.scrollIntoViewIfNeeded();const to=await slot.boundingBox();await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:15});await page.mouse.up();
 await expect(slot).toContainText('原创前置后续');await choice.getByRole('button',{name:'收起选择',exact:true}).click();
 if((page.viewportSize()?.width||0)<=760)await page.getByRole('button',{name:'功能页',exact:true}).click();
 await expect(grant).toContainText('1/1').catch(async error=>{console.log('choice-return-state',JSON.stringify(await page.evaluate(()=>({tabs:[...document.querySelectorAll('[role="tab"]')].map(el=>({label:el.textContent,selected:el.getAttribute('aria-selected')})),regions:[...document.querySelectorAll('[role="region"]')].map(el=>({label:el.getAttribute('aria-label'),hidden:!!el.closest('[aria-hidden="true"], [inert]')})),sheet:document.querySelector('.sheet-pane')?.textContent?.slice(0,6000)}))));throw error;});await expect(page.getByRole('region',{name:'专长',exact:true})).toContainText('原创前置后续');
 await page.reload();await openFeatures(page);await expect(grant).toContainText('1/1');await expect(features.getByRole('region',{name:'专长',exact:true})).toContainText('原创前置后续');
});
