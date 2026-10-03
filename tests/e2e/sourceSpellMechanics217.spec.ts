import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {irFixture} from '../helpers/irFixture';
import {installCardAutomation} from './automationFixtures';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {planSourceSpells,setSourceSpellChoices,syncSourceSpells} from '../../src/core/automation/sourceSpells';
import {changeSpecialSpellUses} from '../../src/core/specialSpells';
const entry=(id:string,name:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id,name,english:id,kind,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:['原创验收条目'],raw});
test('actual App saves optional source choices and exposes no rest recovery control',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await expect(page.getByRole('button',{name:'自动化设置'})).toBeVisible();
 const c=newCharacter();c.name='原创来源次数验收';c.automation=newAutomationState();
 const a=entry('test dawn','晨光印记','spell',{level:1}),b=entry('test tide','潮汐印记','spell',{level:1});
 c.selections=[{id:'origin',entry:entry('origin','星辉传承','race',{additionalSpells:[{innate:{'_':{daily:{pbe:[{choose:{from:['test dawn|XPHB','test tide|XPHB'],count:2}}]}}}}]}),quantity:1,level:1,equipped:false},...[a,b].map(e=>({id:'learned-'+e.id,entry:e,quantity:1,level:1,equipped:false}))];
 c.selections=c.selections.map(row=>({...row,entry:irFixture(row.entry,undefined,c.selections.map(row=>row.entry))}));Object.assign(a,irFixture(a));Object.assign(b,irFixture(b));
 const choice=planSourceSpells(c,[a,b]).choices.find(x=>x.spells)!;setSourceSpellChoices(c,choice.key,['test dawn|XPHB'],[a,b]);syncSourceSpells(c,[a,b]);const grant=c.selections.find(s=>s.grantKey?.startsWith('source-spell:'))!;changeSpecialSpellUses(c,grant.id,0);c.runtime.resources.manual={name:'手工次数',max:5,current:1};
 await installCardAutomation(page,c);
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'source-original.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗'}).click();await page.getByRole('button',{name:'自动化设置'}).click();
 const chooser=page.locator('.source-spell-choice');await expect(chooser).toContainText('可以少选');await expect(chooser).toContainText('玩家手册');await expect(chooser.getByRole('checkbox',{name:/晨光印记/})).toBeChecked();await chooser.getByRole('checkbox',{name:/潮汐印记/}).check();await expect(chooser).toContainText('已选 2 项');await chooser.getByRole('checkbox',{name:/潮汐印记/}).uncheck();
 await expect(page.locator('.source-spell-rest')).toHaveCount(0);await expect(page.getByRole('button',{name:/短休|长休|恢复以上/})).toHaveCount(0);
 await page.screenshot({path:test.info().outputPath('source-spell-controls.png'),fullPage:true});await page.getByRole('button',{name:'关闭弹窗'}).click();await page.reload();await page.getByRole('button',{name:'自动化设置'}).click();await expect(chooser.getByRole('checkbox',{name:/晨光印记/})).toBeChecked();await expect(chooser.getByRole('checkbox',{name:/潮汐印记/})).not.toBeChecked();await expect(page.locator('.source-spell-rest')).toHaveCount(0);
 await page.getByRole('button',{name:'关闭弹窗'}).click();await expect(page.locator('[data-resource-name="手工次数"]')).toHaveAttribute('data-resource-current','1');expect(errors).toEqual([]);
});

test('blocked and read-only transactions cannot claim success; nine long resource names remain operable through continuous scroll',async({page})=>{
 await page.goto('/tests/fixtures/source-mechanics/index.html');const choice=page.locator('.source-spell-choice');const before=await page.locator('#data').textContent();
 await choice.getByRole('checkbox',{name:/潮汐/}).click();await expect(choice.getByRole('checkbox',{name:/潮汐/})).not.toBeChecked();await expect(choice.getByRole('status')).toContainText('选择未提交');expect(await page.locator('#data').textContent()).toBe(before);
 await expect(page.locator('.source-spell-rest')).toHaveCount(0);await page.getByRole('checkbox',{name:'阻止事务',exact:true}).uncheck();await page.getByRole('checkbox',{name:'允许写入',exact:true}).uncheck();await expect(choice.getByRole('checkbox',{name:/潮汐/})).toBeDisabled();await page.getByRole('checkbox',{name:'允许写入',exact:true}).check();
 await choice.getByRole('checkbox',{name:/潮汐/}).check();await expect(choice.getByRole('checkbox',{name:/潮汐/})).toBeChecked();const saved=JSON.parse((await page.locator('#data').textContent())!);expect(saved.runtime.automationActions).toEqual(JSON.parse(before!).runtime.automationActions);

 const viewport=page.locator('.resource-widget-scroll'),widgets=page.locator('.resource-widget');
 await expect(widgets).toHaveCount(9);await expect(page.getByRole('button',{name:/上一页资源|下一页资源/})).toHaveCount(0);
 expect(await viewport.evaluate(el=>getComputedStyle(el).overflowY)).toBe('auto');
 const visited=new Set<string>(),ids=await widgets.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-resource-id')!));
 for(const id of ids){
  expect(id).toMatch(/^long[0-8]$/);expect(visited.has(id)).toBe(false);visited.add(id);
  const i=Number(id.slice(4)),widget=page.locator(`[data-resource-id="${id}"]`),face=widget.locator('.resource-widget-face');await face.scrollIntoViewIfNeeded();
  expect(await face.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('.resource-widget-scroll')!.getBoundingClientRect();return a.width>0&&a.height>0&&a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;})).toBe(true);
  expect((await widget.locator('.rm-name').boundingBox())!.height).toBeGreaterThanOrEqual(9);
  await face.click();await expect(page.getByRole('dialog')).toContainText(`银色黎明传承的第${i+1}项长名称资源`);await page.getByRole('button',{name:'关闭资源操作'}).click();
 }
 expect([...visited].sort()).toEqual(Array.from({length:9},(_,i)=>`long${i}`));
 expect(await viewport.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 const geometry=await page.locator('.resource-workspace').evaluate(el=>({h:el.clientHeight,sh:el.scrollHeight,w:el.clientWidth,sw:el.scrollWidth}));expect(geometry.sh).toBeLessThanOrEqual(geometry.h+1);expect(geometry.sw).toBeLessThanOrEqual(geometry.w+1);
 // Scrolling and inspecting never replenish free casts or mutate spent balances.
 expect(JSON.parse((await page.locator('#data').textContent())!)).toEqual(saved);
 await page.locator('.resource-workspace').screenshot({path:test.info().outputPath('nine-long-resource-names-scrolled.png')});
});
