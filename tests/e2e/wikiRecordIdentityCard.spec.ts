import {readFile} from 'node:fs/promises';
import {test,expect,type Page} from '@playwright/test';
import fixture from '../fixtures/preDedupClassChoice.json' with {type:'json'};
import {mockSource,suppressAnnouncement} from './fixtures';
import {exportCharacter} from '../../src/core/export';
import {validateCharacter} from '../../src/core/validation';

const original=fixture.entries.find(entry=>entry.id===fixture.character.selections.find(row=>row.id===fixture.ids.feat)!.entry.id)!;
const body:Record<string,unknown[]>={};
for(const entry of fixture.entries){const kind=entry.raw._category;if(kind)(body[kind]??=[]).push(entry.raw);}
(body.feat??=[]).unshift({...original.raw,name:'另一份原创风格定义',ENG_name:original.english});
async function save(page:Page){
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'下载 JSON',exact:true}).click();
 const file=await waiting,value=JSON.parse(await readFile((await file.path())!,'utf8'));
 await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();return value.character;
}
const retained=(card:typeof fixture.character)=>({
 selections:card.selections.map(row=>({id:row.id,parentId:row.parentId,grantKey:row.grantKey,entryId:row.entry.id,name:row.entry.name})),
 answers:card.answers,resources:card.runtime.resources,quickbar:card.quickbar,layout:card.featureLayout,quickbarLayout:card.quickbarLayout
});
async function showWiki(page:Page){
 const tabs=page.locator('.mobile-tabs');if(await tabs.isVisible())await tabs.getByRole('button',{name:'Wiki',exact:true}).click();
 await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
}
async function showSheet(page:Page){const tabs=page.locator('.mobile-tabs');if(await tabs.isVisible())await tabs.getByRole('button',{name:'功能页',exact:true}).click();}
for(const width of [1440,390])test(`catalog refresh and saved reopen retain the selected legacy definition and consumed resource at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await mockSource(page);await suppressAnnouncement(page);
 await page.route('**/data/class/class-test.json',route=>route.fulfill({json:body,headers:{'access-control-allow-origin':'*'}}));
 await page.route('**/data/feats.json',route=>route.fulfill({json:{},headers:{'access-control-allow-origin':'*'}}));
 await page.goto('/');await page.locator('.app-shell').waitFor();await showWiki(page);await showSheet(page);
 const character=validateCharacter(structuredClone(fixture.character));
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 await page.getByTestId('character-file').setInputFiles({name:'authored-legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(character)))});
 await expect(page.getByRole('tab',{name:/原创旧结构验收（导入）/})).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 const before=await save(page);expect(before.runtime.resources[fixture.ids.resource].current).toBe(1);
 expect(before.selections.find((row:{id:string})=>row.id===fixture.ids.feat)?.entry.name).toBe(original.name);
 await showWiki(page);await page.getByRole('button',{name:'更新资料',exact:true}).click();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await showSheet(page);
 expect(retained(await save(page))).toEqual(retained(before));
 await page.reload();await expect(page.getByRole('tab',{name:/原创旧结构验收（导入）/})).toHaveAttribute('aria-selected','true');
 const reopened=await save(page);expect(retained(reopened)).toEqual(retained(before));
 expect(reopened.runtime.resources[fixture.ids.resource].current).toBe(1);
 await page.screenshot({path:test.info().outputPath(`legacy-card-preserved-${width}.png`)});
});
