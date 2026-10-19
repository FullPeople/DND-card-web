import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {normalizeData} from '../../src/data/catalog';
import {newCharacter,ABILITIES} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../../src/core/automation/choices';
import {exportCharacter} from '../../src/core/export';

test('confirms, saves, reopens, replaces and removes an ASI allocation using the real choice workspace',async({page},info)=>{
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 const source={class:[{name:'Allocation Class',source:'XPHB',classFeatures:['Allocation Grant|Allocation Class|XPHB|4']}],classFeature:[{name:'Allocation Grant',source:'XPHB',className:'Allocation Class',classSource:'XPHB',level:4,entries:['{@feat Ability Score Improvement|XPHB}']}],feat:[{name:'Ability Score Improvement',source:'XPHB',category:'G',repeatable:true,ability:[{choose:{from:[...ABILITIES],amount:2},hidden:true},{choose:{from:[...ABILITIES],count:2},hidden:true}],entries:[]}]};
 const entries=normalizeData(source,'browser-asi-source'),c=newCharacter('2024');c.name='ASI Browser';c.automation=newAutomationState();c.abilities.str=16;c.abilities.dex=13;c.notes='Retain manual values';
 c.selections=[{id:'owner',entry:entries.find(e=>e.kind==='class')!,level:4,quantity:1,equipped:false}];
 const grant=sheetChoices(c,entries).find(q=>q.sourceProgression==='feat')!;setSheetChoiceSlot(c,grant.id,0,entries.find(e=>e.kind==='feat')!.id,entries);syncChoiceContent(c,entries);
 await page.goto('/');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'asi-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 await expect(page.getByRole('tab',{name:/ASI Browser（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await restoreAuthoredChoices(page);
 await page.getByRole('tab',{name:'特性',exact:true}).click();
 const open=async()=>{await page.getByRole('button',{name:/属性提升（自动计算）/}).first().click();await expect(page.locator('[data-choice-workspace]')).toBeVisible();};
 await open();await expect(page.locator('.choice-option')).toHaveCount(21);await expect(page.locator('.choice-hint').filter({hasText:'旧卡基础属性'})).toBeVisible();
 await page.locator('.choice-option').filter({hasText:/^力量 \+2$/}).click();await page.getByRole('button',{name:'退出选择',exact:true}).click();await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.reload();await page.getByRole('tab',{name:'特性',exact:true}).click();await open();await expect(page.locator('.choice-option').filter({hasText:/^力量 \+2$/})).toHaveAttribute('aria-pressed','true');
 await page.locator('.choice-option').filter({hasText:/^力量 \+1、敏捷 \+1$/}).click();await expect(page.locator('.choice-option').filter({hasText:/^力量 \+2$/})).toHaveAttribute('aria-pressed','false');
 await page.screenshot({path:info.outputPath('asi-allocation.png')});await page.locator('.choice-option').filter({hasText:/^力量 \+1、敏捷 \+1$/}).click();await expect(page.locator('.choice-option[aria-pressed="true"]')).toHaveCount(0);
});
