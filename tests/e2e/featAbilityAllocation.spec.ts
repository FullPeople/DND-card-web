import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {newCharacter,ABILITIES,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../../src/core/automation/choices';
import {exportCharacter} from '../../src/core/export';

test('confirms, saves, reopens, replaces and removes an ASI allocation using the real choice workspace',async({page},info)=>{
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 const source={class:[{name:'Allocation Class',source:'XPHB',classFeatures:['Allocation Grant|Allocation Class|XPHB|4']}],classFeature:[{name:'Allocation Grant',source:'XPHB',className:'Allocation Class',classSource:'XPHB',level:4,entries:['{@feat Ability Score Improvement|XPHB}']}],feat:[{name:'Ability Score Improvement',source:'XPHB',category:'G',repeatable:true,ability:[{choose:{from:[...ABILITIES],amount:2},hidden:true},{choose:{from:[...ABILITIES],count:2},hidden:true}],entries:[]}]};
 const entries:Entry[]=Object.entries(source).flatMap(([kind,rows])=>rows.map(raw=>({id:`browser-asi:${kind}:${'level' in raw?raw.level:0}`,kind:kind==='classFeature'?'feature':kind as Entry['kind'],name:raw.name,english:raw.name,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:'entries' in raw?raw.entries:[],raw:{...raw,_category:kind}}))),c=newCharacter('2024');c.name='ASI Browser';c.automation=newAutomationState();c.abilities.str=16;c.abilities.dex=13;c.notes='Retain manual values';
 c.selections=[{id:'owner',entry:entries.find(e=>e.kind==='class')!,level:4,quantity:1,equipped:false}];
 const grant=sheetChoices(c,entries).find(q=>q.sourceProgression==='feat')!;setSheetChoiceSlot(c,grant.id,0,entries.find(e=>e.kind==='feat')!.id,entries);syncChoiceContent(c,entries);
 await page.goto('/');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'asi-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 await expect(page.getByRole('tab',{name:/ASI Browser（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await restoreAuthoredChoices(page);
 await page.getByRole('tab',{name:'特性',exact:true}).click();
 const open=async()=>{
  const direct=page.getByRole('button',{name:/属性提升（自动计算）/}).first();
  if(await direct.isVisible())await direct.click();
  else {await page.locator('.heritage-features [data-feature-id]').filter({hasText:'Ability Score Improvement'}).first().locator('.feature-caption').click();if(!await page.locator('[data-choice-workspace]').isVisible())await direct.click();}
  await expect(page.locator('[data-choice-workspace]')).toBeVisible();
 };
 const scores=async(str:number,dex:number)=>{
  await page.getByRole('tab',{name:'总览',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:'力量属性值',exact:true})).toHaveValue(String(str));await expect(page.getByRole('spinbutton',{name:'敏捷属性值',exact:true})).toHaveValue(String(dex));
  await expect(page.locator('.ability-str .ability-modifier')).toHaveText(`+${Math.floor((str-10)/2)}`);await expect(page.locator('.ability-dex .ability-modifier')).toHaveText(`+${Math.floor((dex-10)/2)}`);
 };
 await open();await expect(page.locator('.choice-option')).toHaveCount(21);await expect(page.locator('.choice-hint').filter({hasText:'旧卡基础属性'})).toBeVisible();
 await page.locator('.choice-option').filter({hasText:/^力量 \+2$/}).click();await page.getByRole('button',{name:'退出选择',exact:true}).click();await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await scores(18,13);await page.reload();await scores(18,13);await page.getByRole('tab',{name:'特性',exact:true}).click();await open();await expect(page.locator('.choice-option').filter({hasText:/^力量 \+2$/})).toHaveAttribute('aria-pressed','true');
 await page.locator('.choice-option').filter({hasText:/^力量 \+1、敏捷 \+1$/}).click();await expect(page.locator('.choice-option').filter({hasText:/^力量 \+2$/})).toHaveAttribute('aria-pressed','false');
 await page.getByRole('button',{name:'退出选择',exact:true}).click();await scores(17,14);await page.getByRole('tab',{name:'特性',exact:true}).click();await open();
 await page.screenshot({path:info.outputPath('asi-allocation.png')});await page.locator('.choice-option').filter({hasText:/^力量 \+1、敏捷 \+1$/}).click();await expect(page.locator('.choice-option[aria-pressed="true"]')).toHaveCount(0);
 await page.getByRole('button',{name:'退出选择',exact:true}).click();await scores(16,13);
});
