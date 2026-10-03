import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Character,type Entry} from '../../src/core/model';
import {exportCharacter} from '../../src/core/export';

function fixture(){
 const c=newCharacter();c.name='熟练与攻击原创验收';c.abilities={str:8,dex:18,con:10,int:10,wis:14,cha:8};
 const entry:Entry={id:'controls232-class',name:'原创守望者',english:'Authored Watcher',kind:'class',source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:['原创软件验收条目。'],raw:{hd:{faces:8},proficiency:['str','wis'],startingProficiencies:{skills:[{perception:true,history:true}]}}};
 c.selections=[{id:'controls232-selection',entry,level:1,quantity:1,equipped:false}];c.expertise={stealth:true};c.proficiencies={arcana:true,'save:con':true};c.skillBonuses={perception:9,athletics:-11};c.runtime.hp=5;c.runtime.resources={focus:{name:'原创专注',current:1,max:4}};
 c.quickbarActions=[{id:'original',name:'原创月刃',attack:'+12',damage:'1d8+4'}];return c;
}
async function saved(page:Page):Promise<Character>{return page.evaluate(async()=>{
 const databases=await indexedDB.databases(),name=databases.some(x=>x.name==='dnd-card-standalone')?'dnd-card-standalone':'dnd-card-workspace';const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{return await new Promise<Character>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result.characters.find((c:Character)=>c.id===r.result.activeId));r.onerror=()=>reject(r.error);});}finally{db.close();}
});}
async function load(page:Page,mode:'a4'|'screen'='a4',c=fixture()){
 await mockSource(page,{displayMode:mode});await suppressAnnouncement(page);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'controls232.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});await expect(page.getByRole('tab',{name:/^熟练与攻击原创验收（导入）(?:\s*旧卡资料需要核对)?$/})).toHaveAttribute('aria-selected','true');await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect.poll(async()=>(await saved(page)).name).toBe(c.name+'（导入）');
}
async function editMode(page:Page,enabled=true){const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});if(await toggle.getAttribute('aria-checked')!==String(enabled))await toggle.click();}

test('manual skills supplement source grants, recalculate, undo and survive automation toggles and reload',async({page})=>{
 await load(page);await editMode(page);const paper=page.locator('.paper'),before=await saved(page);await expect(paper.locator('.ability-skill input[type=checkbox]')).toHaveCount(36);await expect(paper.locator('.ability-save input[type=checkbox]')).toHaveCount(6);await expect(paper.locator('.ability-save input[type=checkbox]:enabled')).toHaveCount(0);
 const perception=page.getByRole('checkbox',{name:'察觉手动熟练',exact:true}),expert=page.getByRole('checkbox',{name:'隐匿专精',exact:true}),strengthSave=page.getByRole('checkbox',{name:'力量豁免熟练状态：熟练',exact:true});await expect(perception).toBeEnabled();await expect(perception).not.toBeChecked();await expect(perception).toHaveAccessibleDescription(/当前生效：熟练.*取消只移除手动记录.*来源授予仍生效/);await expect(expert).toBeChecked();await expect(strengthSave).toBeDisabled();await expect(strengthSave).toBeChecked();
 await perception.check();await perception.uncheck();await expect(perception).toHaveAccessibleDescription(/当前生效：熟练/);
 const athletics=page.getByRole('checkbox',{name:'运动手动熟练',exact:true}),athleticsExpert=page.getByRole('checkbox',{name:'运动专精',exact:true});await athletics.check();await athleticsExpert.check();await expect(athletics).toBeChecked();await expect(page.locator('.ability-str .ability-skill b')).toHaveText('-8');
 await athleticsExpert.uncheck();await expect(athletics).toBeChecked();await expect(page.locator('.ability-str .ability-skill b')).toHaveText('-10');await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(athleticsExpert).toBeChecked();
 const bonus=page.getByRole('spinbutton',{name:'察觉额外调整值',exact:true});await bonus.fill('-3');await bonus.press('Tab');await expect(paper.locator('.ability-skill').filter({has:bonus}).locator('b')).toHaveText('+1');await expect.poll(async()=>(await saved(page)).skillBonuses?.perception).toBe(-3);
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();const automatic=page.getByRole('checkbox',{name:'启用自动计算',exact:true});await automatic.uncheck();await automatic.check();await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect(athleticsExpert).toBeChecked();
 await page.locator('.identity-class .identity-title').press('Delete');await expect(perception).toHaveAccessibleDescription(/当前生效：无熟练/);await expect(page.getByRole('checkbox',{name:'力量豁免熟练状态：无熟练',exact:true})).not.toBeChecked();await expect(expert).toBeChecked();await expect(athleticsExpert).toBeChecked();await expect(paper.locator('.ability-skill').filter({has:bonus}).locator('b')).toHaveText('-1');await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(perception).toHaveAccessibleDescription(/当前生效：熟练/);await expect(strengthSave).toBeChecked();await expect.poll(async()=>(await saved(page)).selections.length).toBe(before.selections.length);
 await expect.poll(async()=>(await saved(page)).expertise?.athletics).toBe(true);await page.reload();await expect(bonus).toHaveValue('-3');await expect(perception).toBeEnabled();await expect(perception).not.toBeChecked();await expect(athleticsExpert).toBeChecked();const after=await saved(page);expect(after.proficiencies).toEqual({...before.proficiencies,perception:false,athletics:true});expect(after.expertise).toEqual({...before.expertise,perception:false,athletics:true});expect(after.runtime).toEqual(before.runtime);await page.screenshot({path:test.info().outputPath('manual-skills-saved.png')});
 await editMode(page,false);await expect(paper.locator('.ability-skill input[type=checkbox]')).toHaveCount(0);await expect(page.locator('[aria-label="运动专精"]')).toBeVisible();
});

test('another tab retains read-only skill controls and saved manual values',async({page,context})=>{
 await load(page);await editMode(page);await page.getByRole('checkbox',{name:'运动专精',exact:true}).check();await expect.poll(async()=>(await saved(page)).expertise?.athletics).toBe(true);
 const viewer=await context.newPage();await mockSource(viewer);await suppressAnnouncement(viewer);await viewer.goto('/');await expect(viewer.locator('.read-only-banner')).toBeVisible();await expect(viewer.locator('.ability-skill input[type=checkbox]')).toHaveCount(0);await expect(viewer.locator('[aria-label="运动专精"]')).toBeVisible();expect((await saved(viewer)).expertise?.athletics).toBe(true);await viewer.close();
});

for(const mode of ['a4','screen'] as const)test(`${mode} save and skill columns align in both modes at desktop and narrow zoom`,async({page})=>{
 await load(page,mode);
 for(const width of [1512,390]){await page.setViewportSize({width,height:982});for(const editing of [false,true]){await editMode(page,editing);const measurements=await page.locator('.ability-box').evaluateAll(boxes=>boxes.map(box=>{const rows=[...box.querySelectorAll<HTMLElement>('.ability-proficiency-row')];return rows.map(row=>{const cells=[...row.children].slice(0,3).map(el=>{const rect=el.getBoundingClientRect();return {x:rect.x,w:rect.width};});const value=row.children[1],label=row.children[2];const textBottom=(el:Element)=>{const range=document.createRange();range.selectNodeContents(el);return range.getBoundingClientRect().bottom;};return {cells,baseline:Math.abs(textBottom(value)-textBottom(label)),overflow:row.scrollWidth-row.clientWidth};});}));
  for(const rows of measurements){for(const row of rows){for(let i=0;i<3;i++)expect(Math.abs(row.cells[i].x-rows[0].cells[i].x)).toBeLessThan(1.1);expect(row.baseline).toBeLessThan(1.6);expect(row.overflow).toBeLessThanOrEqual(1);}}await expect(page.locator('.ability-str .ability-skill b')).toHaveText('-12');await expect(page.locator('.ability-wis .ability-skill').filter({hasText:'察觉'}).locator('b')).toHaveText('+13');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  // Alignment alone does not prove readable names: real two-character labels
  // must fit before the deliberately long-label truncation check below.
  const labels=await page.locator('.ability-skill > span:nth-child(3)').evaluateAll(elements=>elements.map(el=>({text:el.textContent||'',overflow:el.scrollWidth-el.clientWidth})));
  expect(labels).toHaveLength(18);for(const label of labels){expect(label.text).toHaveLength(2);expect(label.overflow,`${mode}/${width}/${editing?'edit':'read'} ${label.text}`).toBeLessThanOrEqual(0);}
  if(editing){const checks=page.locator('.ability-skill .proficiency-manual input');const sizes=await checks.evaluateAll(elements=>elements.map(el=>({width:(el as HTMLElement).offsetWidth,height:(el as HTMLElement).offsetHeight})));for(const size of sizes){expect(size.width).toBeGreaterThanOrEqual(10);expect(size.height).toBeGreaterThanOrEqual(10);}await checks.first().focus();await expect(checks.first()).toBeFocused();}
  const longLabel=page.locator('.ability-int .ability-skill').first().locator(':scope > span:nth-child(3)');await longLabel.evaluate(el=>el.textContent='长技能名称与两位加值验收');expect(await longLabel.evaluate(el=>getComputedStyle(el).textOverflow)).toBe('ellipsis');expect(await page.locator('.ability-int').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);await longLabel.evaluate(el=>el.textContent=el.getAttribute('title'));await page.screenshot({path:test.info().outputPath(`aligned-${mode}-${width}-${editing?'edit':'read'}.png`)});
 }}
});
