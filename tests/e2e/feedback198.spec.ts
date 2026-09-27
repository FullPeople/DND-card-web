import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {RELEASE_NOTES,SUITE_RELEASE_NOTES} from '../../src/platform/releaseNotes';

async function ready(page:Page){await mockSource(page);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();}
test('spell authoring offers field examples, saves without guessing JSON, and selected entries open as reading',async({page})=>{
 await ready(page);await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'自定义',exact:true}).click();
 await page.getByLabel('自定义条目类型',{exact:true}).selectOption('spell');
 await page.getByRole('button',{name:'施法时间填写帮助',exact:true}).hover();const help=page.getByRole('tooltip');await expect(help).toContainText('1 附赠动作');await expect(help).toContainText('"unit":"reaction"');await expect(help.locator('p')).toHaveCount(4);
 await page.getByRole('button',{name:'查看参考格式',exact:true}).click();const reference=page.getByRole('dialog',{name:'自定义条目参考格式'});await expect(reference).toContainText('JSON');await expect(reference).toContainText('"concentration":true');await page.screenshot({path:test.info().outputPath('reference-format.png')});await reference.getByRole('button',{name:'关闭参考格式'}).click();
 await page.getByRole('button',{name:'创作建议填写帮助'}).hover();await expect(page.getByRole('tooltip')).toContainText('强烈建议复制创作提示词让AI');
 await page.getByLabel('自定义条目名称',{exact:true}).fill('格式帮助验收法术');await page.getByLabel('法术环阶',{exact:true}).fill('1');await page.getByLabel('法术学派',{exact:true}).selectOption('V');
 await page.getByLabel('法术time结构').fill('action');await page.getByLabel('法术range结构').fill('{"type":"point","distance":{"type":"feet","amount":60}}');await page.getByLabel('法术components结构').fill('{"v":true,"s":true}');await page.getByLabel('法术duration结构').fill('[{"type":"instant"}]');await page.getByLabel('自定义条目正文',{exact:true}).fill('自制的完整规则说明。');
 await page.getByRole('button',{name:'保存条目',exact:true}).click();await expect(page.getByRole('alert')).toContainText('施法时间需要 JSON 数组');
 await page.getByLabel('法术time结构').fill('[{"number":1,"unit":"action"}]');await page.getByRole('button',{name:'保存条目',exact:true}).click();await expect(page.locator('.entry-detail')).toContainText('自制的完整规则说明');await expect(page.getByLabel('自定义条目名称',{exact:true})).toHaveCount(0);await page.screenshot({path:test.info().outputPath('custom-reading.png')});
 await page.reload();await expect(page.locator('.entry-detail')).toContainText('格式帮助验收法术');await expect(page.getByLabel('自定义条目名称',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'编辑此条目'}).click();await expect(page.getByLabel('法术time结构')).toHaveValue('[{"number":1,"unit":"action"}]');await page.getByRole('button',{name:'＋ 新建条目',exact:true}).click();await expect(page.getByLabel('自定义条目名称',{exact:true})).toHaveValue('');await expect(page.locator('.catalog-row.active')).toHaveCount(0);
});
test('edit rejection appears at top and explicitly enables edit mode with a layout-stable outline',async({page})=>{
 await ready(page);const pane=page.locator('.sheet-pane'),before=await pane.boundingBox();await page.locator('.catalog-row').filter({hasText:'测试法师'}).first().dragTo(page.locator('.identity-class'));
 const toast=page.locator('.suite-toast');await expect(toast).toContainText('开启编辑模式');await expect(toast.getByRole('button',{name:'开启编辑模式',exact:true})).toBeVisible();expect((await toast.boundingBox())!.y).toBeLessThan(80);
 await page.screenshot({path:test.info().outputPath('top-edit-toast.png')});await toast.getByRole('button',{name:'开启编辑模式',exact:true}).click();await expect(page.getByRole('switch',{name:'编辑模式'})).toHaveAttribute('aria-checked','true');await expect(pane).toHaveClass(/sheet-editing/);expect(await pane.boundingBox()).toEqual(before);await page.screenshot({path:test.info().outputPath('editing-outline.png')});
 await page.getByRole('switch',{name:'编辑模式'}).click();await expect(pane).not.toHaveClass(/sheet-editing/);
});
test('release notes contain only the selected channel and preserve relevant shared changes',async({page,baseURL})=>{
 expect(RELEASE_NOTES.join('')).not.toMatch(/枭熊|Owner|光源|三龙|旧插件|地图血条/);expect(SUITE_RELEASE_NOTES.join('')).not.toContain('旧插件改用');
 await mockSource(page,{suiteAnnouncement:true});const url=new URL(baseURL!);url.hash='suite=198-notice&bridge='+encodeURIComponent(url.origin);await page.goto(url.href);await expect(page.locator('.announcement')).toBeVisible();await expect(page.locator('.announcement-issues li')).toHaveCount(SUITE_RELEASE_NOTES.length);await expect(page.locator('.announcement-issues')).toContainText('修复了怪物图鉴加载出错的问题');await expect(page.locator('.announcement-issues')).not.toContainText('旧插件公告');
});

test('monster permissions and HP visibility locks explain and send separate actions',async({page,baseURL})=>{
 await mockSource(page);
 await page.route('**/locks198',route=>route.fulfill({contentType:'text/html',body:`<div id="test-root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/tests/e2e/dragLanding180.harness.jsx"></script>`}));
 await page.goto('/locks198#suite=drag180&bridge='+encodeURIComponent(baseURL!));await page.waitForFunction(()=>(window as any).renderMode);
 await page.evaluate(()=>(window as any).renderMode('monster'));
 const info=page.getByRole('button',{name:'上锁怪物卡',exact:true}),hp=page.getByRole('button',{name:'解锁怪物生命条',exact:true});
 await expect(info).toContainText('资料');await expect(info).toHaveAttribute('title',/资料查阅权限.*DM 和创建者/);
 await expect(hp).toContainText('血条');await expect(hp).toHaveAttribute('title',/地图血条显示.*不能看具体数值/);
 await info.click();await expect.poll(()=>page.evaluate(()=>(window as any).requests.filter((r:any)=>r.type==='lock').length)).toBe(1);
 await hp.click();await expect.poll(()=>page.evaluate(()=>(window as any).requests.filter((r:any)=>r.type==='statsLock').length)).toBe(1);
 expect(await page.evaluate(()=>(window as any).requests.filter((r:any)=>['lock','statsLock'].includes(r.type)).map((r:any)=>({type:r.type,locked:r.locked})))).toEqual([{type:'lock',locked:true},{type:'statsLock',locked:false}]);
});
