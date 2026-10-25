import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter} from '../../src/core/model';
import {exportCharacter} from '../../src/core/export';

async function traceReady(page:Page){
 await page.route('**/src/core/engine.ts',async route=>{
  const response=await route.fetch(),body=await response.text();
  const marker='export function evaluate(c, excluded = new Set(), inheritedIssues = []) {';
  expect(body).toContain(marker);
  await route.fulfill({response,body:body.replace(marker,`${marker}\nwindow.traceEvaluations = (window.traceEvaluations || 0) + 1;`)});
 });
 await page.goto('/tests/fixtures/value-trace/');
 await expect(page.getByLabel('力量基础值',{exact:true})).toHaveValue('12');
 await page.getByLabel('力量基础值',{exact:true}).click();
 await page.getByLabel('力量追溯输入',{exact:true}).fill('13');
 await expect(page.locator('.trace-result strong')).toHaveText('15');
}

test('scrolling an edited numeric preview reuses its calculation and still follows live source updates',async({page},info)=>{
 await traceReady(page);
 await page.evaluate(()=>{document.body.style.minHeight='2000px';});
 const before=await page.evaluate(()=>(window as any).traceEvaluations);
 await page.evaluate(async()=>{for(let y=10;y<=80;y+=10){window.scrollTo(0,y);await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));}});
 const after=await page.evaluate(()=>(window as any).traceEvaluations);
 await info.attach('preview-calculation-count',{body:JSON.stringify({before,after,scrollUpdates:8}),contentType:'application/json'});
 expect(after).toBe(before);
 const anchor=await page.getByLabel('力量基础值',{exact:true}).boundingBox(),editor=await page.getByLabel('力量追溯输入',{exact:true}).boundingBox();
 for(const key of ['x','y','width','height'] as const)expect(Math.abs(anchor![key]-editor![key])).toBeLessThan(1.1);
 await page.evaluate(()=>(window as any).valueTraceFixture.publishStrengthBonus(4));
 await expect(page.locator('.trace-result strong')).toHaveText('17');
 await expect(page.getByLabel('力量追溯输入',{exact:true})).toHaveValue('13');
 await page.screenshot({path:info.outputPath('number-preview-live-update.png')});
 await page.getByLabel('力量追溯输入',{exact:true}).press('Enter');
 await expect(page.getByLabel('力量基础值',{exact:true})).toHaveValue('17');
 expect(JSON.parse((await page.locator('#data').textContent())!).edits).toBe(1);
});

test('IME confirmation keys keep numeric drafts open until an ordinary Enter',async({page})=>{
 await page.goto('/tests/fixtures/number-input-switch/');
 const hp=page.getByLabel('当前生命值',{exact:true});await hp.fill('-5');
 await hp.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});
 await expect(hp).toBeFocused();await expect(hp).toHaveValue('-5');
 expect(await page.evaluate(()=>(window as any).numberInputSwitch.state().edits)).toBe(0);
 await hp.dispatchEvent('keydown',{key:'Escape',code:'Escape',isComposing:true});
 await expect(hp).toBeFocused();await expect(hp).toHaveValue('-5');
 await hp.press('Enter');expect(await page.evaluate(()=>(window as any).numberInputSwitch.state().edits)).toBe(1);
 await page.goto('/tests/fixtures/value-trace/');await page.getByLabel('力量基础值',{exact:true}).click();
 const trace=page.getByLabel('力量追溯输入',{exact:true});await trace.fill('13');
 await trace.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});await expect(trace).toBeFocused();
 await trace.dispatchEvent('keydown',{key:'Escape',code:'Escape',isComposing:true});await expect(trace).toBeFocused();
 expect(JSON.parse((await page.locator('#data').textContent())!).edits).toBe(0);
 await trace.press('Enter');await expect(page.getByLabel('力量基础值',{exact:true})).toHaveValue('15');
 expect(JSON.parse((await page.locator('#data').textContent())!).edits).toBe(1);
});

test('delayed drag tab navigation belongs only to the still-visible card',async({page})=>{
 await page.goto('/tests/fixtures/paper-hover/');
 await page.getByRole('button',{name:'拖到特性页签',exact:true}).click();
 await page.getByRole('button',{name:'切离角色卡',exact:true}).click();
 await expect(page.locator('#visible')).toHaveText('false');
 await page.waitForTimeout(550);
 await expect(page.locator('#current-page')).toHaveText('主要');
 await page.reload();await page.getByRole('button',{name:'拖到特性页签',exact:true}).click();
 await expect(page.locator('#current-page')).toHaveText('特性');
});

test('real narrow card keeps its numeric editor aligned and focused through resize',async({page},info)=>{
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);await page.goto('/');
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const c=newCharacter();c.name='原创窄屏数值验收';c.abilities.str=14;c.automation={protocol:2,enabled:false,defaultsVersion:1,rulesVersion:'equipment.1'};
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 await page.getByTestId('character-file').setInputFiles({name:'numeric-resize.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 await expect(page.locator('.character-tabs').getByRole('tab').filter({hasText:c.name})).toBeVisible();
 await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await expect(page.locator('.screen-overview')).toBeVisible();
 const pane=page.locator('.sheet-pane');
 await pane.evaluate(node=>Object.assign((node as HTMLElement).style,{position:'fixed',left:'0',top:'0',width:'390px',height:'844px',zIndex:'50',display:'flex'}));
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 const base=page.getByRole('spinbutton',{name:'力量基础值',exact:true});await base.scrollIntoViewIfNeeded();await base.click();
 const field=page.getByRole('spinbutton',{name:'力量追溯输入',exact:true});await field.fill('18');
 await pane.evaluate(node=>(node as HTMLElement).style.width='320px');
 await expect(field).toBeFocused();await expect(field).toHaveValue('18');
 await expect.poll(async()=>{const a=(await base.boundingBox())!,b=(await field.boundingBox())!;return Math.max(...(['x','y','width','height'] as const).map(key=>Math.abs(a[key]-b[key])));}).toBeLessThan(1.1);
 await page.screenshot({path:info.outputPath('card-narrow-numeric-editor.png')});
 await field.press('Enter');await expect(base).toHaveValue('18');await expect(field).toHaveCount(0);
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
});
