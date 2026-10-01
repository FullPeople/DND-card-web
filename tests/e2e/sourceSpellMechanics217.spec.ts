import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {planSourceSpells,setSourceSpellChoices,syncSourceSpells} from '../../src/core/automation/sourceSpells';
import {changeSpecialSpellUses} from '../../src/core/specialSpells';
const entry=(id:string,name:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id,name,english:id,kind,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:['原创验收条目'],raw});
test('actual App saves translated optional source choices and explicitly restores declared pools only',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await expect(page.getByRole('button',{name:'自动化设置'})).toBeVisible();
 const c=newCharacter();c.name='原创来源次数验收';c.automation=newAutomationState();
 const a=entry('test dawn','晨光印记','spell',{level:1}),b=entry('test tide','潮汐印记','spell',{level:1});
 c.selections=[{id:'origin',entry:entry('origin','星辉传承','race',{additionalSpells:[{innate:{'_':{daily:{pbe:[{choose:{from:['test dawn|XPHB','test tide|XPHB'],count:2}}]}}}}]}),quantity:1,level:1,equipped:false},...[a,b].map(e=>({id:'learned-'+e.id,entry:e,quantity:1,level:1,equipped:false}))];
 const choice=planSourceSpells(c,[a,b]).choices.find(x=>x.spells)!;setSourceSpellChoices(c,choice.key,['test dawn|XPHB'],[a,b]);syncSourceSpells(c,[a,b]);const grant=c.selections.find(s=>s.grantKey?.startsWith('source-spell:'))!;changeSpecialSpellUses(c,grant.id,0);c.runtime.resources.manual={name:'手工次数',max:5,current:1};
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'source-original.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗'}).click();await page.getByRole('button',{name:'自动化设置'}).click();
 const chooser=page.locator('.source-spell-choice');await expect(chooser).toContainText('可以少选');await expect(chooser).toContainText('玩家手册');await expect(chooser.getByRole('checkbox',{name:/晨光印记/})).toBeChecked();await chooser.getByRole('checkbox',{name:/潮汐印记/}).check();await expect(chooser).toContainText('已选 2 项');await chooser.getByRole('checkbox',{name:/潮汐印记/}).uncheck();
 const rest=page.locator('.source-spell-rest');await expect(rest).toContainText('不代表完成整次休息');await expect(rest.getByRole('button')).toBeDisabled();await rest.getByRole('combobox').selectOption('long');await expect(rest).toContainText('0 → 2');await rest.getByRole('button',{name:'恢复以上 1 项来源次数'}).click();await expect(rest.getByRole('status')).toContainText('已按长休恢复 1 项来源次数');await expect(rest.getByRole('button')).toBeDisabled();
 await page.screenshot({path:test.info().outputPath('source-spell-controls.png'),fullPage:true});await page.getByRole('button',{name:'关闭弹窗'}).click();await page.reload();await page.getByRole('button',{name:'自动化设置'}).click();await expect(chooser.getByRole('checkbox',{name:/晨光印记/})).toBeChecked();await expect(chooser.getByRole('checkbox',{name:/潮汐印记/})).not.toBeChecked();await rest.getByRole('combobox').selectOption('long');await expect(rest.getByRole('button')).toBeDisabled();
 await page.getByRole('button',{name:'关闭弹窗'}).click();await expect(page.locator('[data-resource-name="手工次数"]')).toHaveAttribute('data-resource-current','1');expect(errors).toEqual([]);
});

test('blocked and read-only transactions cannot claim success; nine long resource names remain operable without scroll',async({page})=>{
 await page.goto('/tests/fixtures/source-mechanics/index.html');const choice=page.locator('.source-spell-choice'),rest=page.locator('.source-spell-rest');const before=await page.locator('#data').textContent();
 await choice.getByRole('checkbox',{name:/潮汐/}).click();await expect(choice.getByRole('checkbox',{name:/潮汐/})).not.toBeChecked();await expect(choice.getByRole('status')).toContainText('选择未提交');expect(await page.locator('#data').textContent()).toBe(before);
 await rest.getByRole('combobox').selectOption('long');await rest.getByRole('button').click();await expect(rest.getByRole('status')).toContainText('恢复未提交');expect(await page.locator('#data').textContent()).toBe(before);
 await page.getByRole('checkbox',{name:'阻止事务',exact:true}).uncheck();await page.getByRole('checkbox',{name:'允许写入',exact:true}).uncheck();await expect(rest.getByRole('button')).toBeDisabled();await expect(choice.getByRole('checkbox',{name:/潮汐/})).toBeDisabled();await page.getByRole('checkbox',{name:'允许写入',exact:true}).check();
 await rest.getByRole('button').evaluate((el:HTMLButtonElement)=>{el.click();el.click();});await expect(rest.getByRole('button')).toBeDisabled();const saved=JSON.parse((await page.locator('#data').textContent())!);expect(saved.runtime.automationActions.sequence).toBe(1);
 const visited=new Set<string>();for(let pageIndex=0;pageIndex<9;pageIndex++){
  const ids=await page.locator('.resource-widget').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-resource-id')!));expect(ids.length).toBeGreaterThan(0);
  for(const id of ids){expect(id).toMatch(/^long[0-8]$/);expect(visited.has(id)).toBe(false);visited.add(id);const i=Number(id.slice(4)),widget=page.locator(`[data-resource-id="${id}"]`);expect((await widget.locator('.resource-widget-name').boundingBox())!.height).toBeGreaterThanOrEqual(9);await widget.locator('.resource-widget-face').click();await expect(page.getByRole('dialog')).toContainText(`银色黎明传承的第${i+1}项长名称资源`);await page.getByRole('button',{name:'关闭资源操作'}).click();}
  const box=await page.locator('.resource-workspace').evaluate(el=>({h:el.clientHeight,sh:el.scrollHeight,w:el.clientWidth,sw:el.scrollWidth}));expect(box.sh).toBeLessThanOrEqual(box.h+1);expect(box.sw).toBeLessThanOrEqual(box.w+1);
  const next=page.getByRole('button',{name:'下一页资源'});if(await next.isDisabled())break;await next.click();
 }
 expect([...visited].sort()).toEqual(Array.from({length:9},(_,i)=>`long${i}`));
 const geometry=await page.locator('.resource-workspace').evaluate(el=>({h:el.clientHeight,sh:el.scrollHeight,w:el.clientWidth,sw:el.scrollWidth}));expect(geometry.sh).toBeLessThanOrEqual(geometry.h+1);expect(geometry.sw).toBeLessThanOrEqual(geometry.w+1);await page.locator('.resource-workspace').screenshot({path:test.info().outputPath('nine-long-resource-names.png')});
});
