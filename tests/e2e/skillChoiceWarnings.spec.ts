import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {dragWiki,workspace} from './automationChoiceFixture';
import {newCharacter,type Character,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';

async function saved(page:Page):Promise<Character>{return page.evaluate(async()=>{const path='/src/platform/storage.ts';const {loadWorkspace}=await import(path);const w=await loadWorkspace(true);return w.characters.find((c:Character)=>c.id===w.activeId);});}
test('2014 class skills warn about an existing background grant, retain old answers and save an explicit replacement',async({page},info)=>{
 await mockSource(page);await suppressAnnouncement(page);
 await page.route('**/data/skills.json',r=>r.fulfill({json:{skill:[{name:'历史',ENG_name:'History',source:'PHB',entries:[]},{name:'运动',ENG_name:'Athletics',source:'PHB',entries:[]},{name:'察觉',ENG_name:'Perception',source:'PHB',entries:[]}]}}));
 const entry=(id:string,kind:Entry['kind'],name:string,raw:Entry['raw']):Entry=>({id,kind,name,english:id,source:'PHB',edition:'2014',packId:'authored',revision:'1',entries:[],raw});
 const c=newCharacter('2014');c.name='原创技能重复验收';c.automation=newAutomationState();
 c.selections=[{id:'class-owner',entry:entry('authored-class','class','原创职业',{startingProficiencies:{skills:[{choose:{from:['history','athletics','perception'],count:2}}]}}),level:1,quantity:1,equipped:false},{id:'background-owner',entry:entry('authored-background','background','原创背景',{skillProficiencies:[{history:true}]}),level:1,quantity:1,equipped:false}];
 c.answers['class-owner:skills:0']=['history','perception'];
 await page.goto('/');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'authored-skills.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 await page.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();
 await expect(page.getByRole('tab',{name:/^原创技能重复验收（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');
 await restoreAuthoredChoices(page,undefined,{'class-owner':true});const before=await saved(page);
 await page.locator('.class-features').getByRole('button',{name:'起始熟练项 2/2',exact:true}).click();
 const panel=workspace(page,'起始熟练项');await expect(panel.locator('[data-skill-proficiency-warning]')).toContainText('原创背景 · PHB');
 await expect(panel.locator('[data-skill-proficiency-warning]')).toContainText('不会叠加熟练加值');
 expect((await saved(page)).answers).toEqual(before.answers);
 await page.mouse.move(1,1);await page.screenshot({path:info.outputPath('2014-duplicate-skill-warning.png')});
 await panel.getByRole('button',{name:'移除历史',exact:true}).click();await panel.getByRole('button',{name:'打开候选资料',exact:true}).click();await dragWiki(page,'运动',0);
 if((page.viewportSize()?.width||0)<800)await page.getByRole('button',{name:'查看选择',exact:true}).click();
 await expect(panel.locator('[data-skill-proficiency-warning]')).toHaveCount(0);
 await panel.getByRole('button',{name:'完成并返回',exact:true}).click();await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();
 const after=await saved(page);expect(after.answers['class-owner:skills:0']).toEqual(['athletics','perception']);expect(after.selections).toEqual(before.selections);expect(after.abilities).toEqual(before.abilities);expect(after.runtime).toEqual(before.runtime);
 const skills=await page.evaluate(async()=>{const storage='/src/platform/storage.ts',engine='/src/core/engine.ts';const {loadWorkspace}=await import(storage),{evaluate}=await import(engine);const w=await loadWorkspace(true);return evaluate(w.characters.find((c:Character)=>c.id===w.activeId)).skills;});
 expect(skills.history.proficient).toBe(true);expect(skills.history.sources).toEqual(['原创背景 · PHB']);expect(skills.athletics.proficient).toBe(true);
});
