import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mockSource } from './fixtures';
import { EXAMPLE_PACK } from '../../src/core/validation';

test.beforeEach(async ({ page }) => { await mockSource(page); await page.goto('/'); await expect(page.getByRole('button', { name: '更新资料', exact: true })).toBeEnabled(); });
const closeDialog = async (page: any) => page.getByRole('button', { name: '关闭弹窗' }).click();

test('card-led creation, constrained drag, choice, undo and refresh persistence', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('textbox', { name: '角色姓名', exact: true }).fill('林间记录员');
  await page.getByRole('spinbutton', { name: '智力基础值' }).fill('15');
  await page.locator('[data-requirement="base:class"]').getByRole('button').click();
  await page.getByRole('button', { name: '测试法师 Test Mage XPHB 2024', exact: true }).click();
  await page.getByRole('button', { name: '填入当前要求', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: '测试法师等级' })).toHaveValue('1');
  await expect(page.locator('.skills-box')).toContainText('选择 2 项技能熟练');
  await page.locator('.skills-box').getByRole('checkbox', { name: '奥秘', exact: true }).check();
  await page.locator('.skills-box').getByRole('checkbox', { name: '洞悉', exact: true }).check();
  const featureRequirement = page.locator('[data-requirement]').filter({ hasText: '填写「初始特性」' });
  await featureRequirement.getByRole('button').click();
  await page.locator('.catalog-row').filter({ hasText: '初始特性' }).dragTo(featureRequirement);
  await expect(page.locator('.traits-box .selected-entry')).toContainText('初始特性');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.locator('.traits-box .selected-entry')).toHaveCount(0);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(page.locator('.traits-box .selected-entry')).toHaveCount(1);
  await expect(page.locator('.save-status')).toContainText('已保存到本机');
  await page.reload();
  await expect(page.getByRole('textbox', { name: '角色姓名', exact: true })).toHaveValue('林间记录员');
  await expect(page.locator('.traits-box .selected-entry')).toContainText('初始特性');
  await expect(page.getByRole('spinbutton', { name: '智力基础值' })).toHaveValue('15');
  expect(errors).toEqual([]);
});

test('edition isolation, character copies and source suspension', async ({ page }) => {
  await page.locator('.catalog-row').filter({ hasText: '测试法师' }).click();
  await page.getByRole('button', { name: '加入角色卡', exact: true }).click();
  await page.getByRole('button', { name: '规则与扩展', exact: true }).click();
  await page.getByRole('combobox', { name: '角色规则版本' }).selectOption('2014');
  await closeDialog(page);
  await expect(page.locator('.sheet-checks')).toContainText('保留内容但不计效果');
  await expect(page.locator('.catalog-row')).toContainText('PHB');
  await expect(page.locator('.catalog-row')).not.toContainText('XPHB');
  await page.getByRole('button', { name: /角色簿/ }).click(); await page.getByRole('button', { name: '复制当前角色' }).click();
  await page.getByRole('textbox', { name: '角色姓名', exact: true }).fill('副本独立修改');
  await page.getByRole('combobox', { name: '当前角色' }).selectOption({ label: '未命名的冒险者' });
  await expect(page.getByRole('textbox', { name: '角色姓名', exact: true })).toHaveValue('未命名的冒险者');
});

test('custom pack import is atomic, its nested choice works and disabling preserves the snapshot', async ({ page }) => {
  await page.getByRole('button', { name: '规则与扩展', exact: true }).click();
  const file = page.getByTestId('pack-file');
  await file.setInputFiles({ name: 'study.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(EXAMPLE_PACK)) });
  await expect(page.locator('.pack-row')).toContainText('我的扩展');
  const malicious = structuredClone(EXAMPLE_PACK) as any; malicious.id = 'homebrew.bad'; malicious.entries[0].effects[0].op = 'eval';
  await file.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(malicious)) });
  await expect(page.getByRole('alert')).toContainText('不支持的效果操作');
  await expect(page.locator('.pack-row')).toHaveCount(1); await closeDialog(page);
  await page.getByRole('navigation', { name: '资料分类' }).getByRole('button', { name: '专长', exact: true }).click();
  await page.locator('.catalog-row').filter({ hasText: '学者笔记' }).click(); await page.getByRole('button', { name: '加入角色卡', exact: true }).click();
  await page.locator('.skills-box').getByRole('radio', { name: '历史', exact: true }).check();
  await expect(page.locator('.ability-box').filter({ hasText: 'INT' })).toContainText('总值 11');
  await page.getByRole('button', { name: '规则与扩展', exact: true }).click();
  await page.locator('.source-grid').getByRole('checkbox', { name: /我的扩展/ }).uncheck(); await closeDialog(page);
  await expect(page.locator('.traits-box .selected-entry')).toContainText('学者笔记');
  await expect(page.locator('.traits-box .selected-entry')).toHaveClass(/restricted/);
  await expect(page.locator('.ability-box').filter({ hasText: 'INT' })).not.toContainText('总值 11');
});

test('exports the real Owlbear shape and an offline review, native backup reimports separately', async ({ page }) => {
  await page.getByRole('textbox', { name: '角色姓名', exact: true }).fill('导出验收');
  await page.getByRole('button', { name: '导入 / 导出', exact: true }).click();
  const [nativeDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /角色完整备份/ }).click()]);
  const native = await readFile((await nativeDownload.path())!, 'utf8');
  await page.getByTestId('character-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(native) });
  const [owlbearDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /枭熊角色卡/ }).click()]);
  const ob = JSON.parse(await readFile((await owlbearDownload.path())!, 'utf8'));
  expect(ob.schema_version).toBe('0.3'); expect(ob.core_stats.ac).toBe(10); expect(Array.isArray(ob.skills)).toBe(true); expect(ob.spellcasting.cantrips_known).toEqual([]);
  const [reviewDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /DM 审卡/ }).click()]);
  const review = await readFile((await reviewDownload.path())!, 'utf8'); expect(review).toContain('填写与核对'); expect(review).toContain('选择职业'); expect(review).not.toContain('<script');
  await closeDialog(page); await expect(page.getByRole('combobox', { name: '当前角色' }).locator('option')).toHaveCount(2);
});

test('resources and manual adjustments survive source refresh without being granted again', async ({ page }) => {
  await page.getByRole('button', { name: '法术位与资源记录' }).click();
  await page.getByRole('textbox', { name: '资源名称' }).fill('一环法术位'); await page.getByRole('spinbutton', { name: '资源上限' }).fill('2');
  await page.getByRole('button', { name: '添加记录' }).click(); await closeDialog(page);
  await page.getByRole('button', { name: '消耗一环法术位' }).click();
  await page.getByRole('button', { name: '数值依据与人工修正', exact: true }).click();
  await page.getByRole('spinbutton', { name: '人工修正数值' }).fill('17'); await page.getByRole('textbox', { name: '人工修正原因' }).fill('DM 测试裁定');
  await page.getByRole('button', { name: '记录修正' }).click(); await closeDialog(page);
  await page.getByRole('button', { name: '更新资料', exact: true }).click(); await expect(page.getByRole('button', { name: '更新资料', exact: true })).toBeEnabled();
  await expect(page.locator('.resource-line')).toContainText('1 / 2'); await expect(page.getByRole('region', { name: '护甲等级', exact: true })).toContainText('17');
  await page.reload(); await expect(page.locator('.resource-line')).toContainText('1 / 2'); await expect(page.getByRole('region', { name: '护甲等级', exact: true })).toContainText('17');
});

test('failed updates expose stale-cache use and corrupt storage does not overwrite the record', async ({ page }) => {
  await page.route('https://5e.kiwee.top/data/**', route => route.abort());
  await page.getByRole('button', { name: '更新资料', exact: true }).click();
  await expect(page.locator('.load-errors')).toContainText('旧缓存');
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('dnd-card-workspace', 1); request.onsuccess = () => resolve(request.result); request.onerror = reject; });
    await new Promise<void>((resolve, reject) => { const tx = database.transaction('documents', 'readwrite'); tx.objectStore('documents').put({ damaged: true }, 'workspace'); tx.oncomplete = () => resolve(); tx.onerror = reject; }); database.close();
  });
  await page.reload(); await expect(page.getByRole('alert')).toContainText('读取失败'); await expect(page.getByRole('button', { name: '读取备份', exact: true })).toBeVisible();
});

test('narrow layout retains accessible catalog and keyboard modal controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('region', { name: '角色卡工作区' })).toBeVisible();
  await page.getByRole('navigation', { name: '工作区' }).getByRole('button', { name: '规则资料', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '搜索规则资料' })).toBeVisible();
  await page.locator('.catalog-row').first().click(); await expect(page.getByRole('button', { name: '加入角色卡', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '规则与扩展', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('another tab cannot overwrite the active editor and can resume after it closes', async ({ page, context }) => {
  await page.getByRole('textbox', { name: '角色姓名', exact: true }).fill('受保护的记录');
  await expect(page.locator('.save-status')).toContainText('已保存到本机');
  const second = await context.newPage(); await mockSource(second); await second.goto('/');
  await expect(second.locator('.read-only-banner')).toBeVisible();
  await second.getByRole('textbox', { name: '角色姓名', exact: true }).fill('不应覆盖');
  await expect(second.getByRole('textbox', { name: '角色姓名', exact: true })).toHaveValue('受保护的记录');
  await page.close();
  await expect(second.locator('.read-only-banner')).toHaveCount(0);
  await second.getByRole('textbox', { name: '角色姓名', exact: true }).fill('继续编辑');
  await expect(second.locator('.save-status')).toContainText('已保存到本机');
  await second.reload(); await expect(second.getByRole('textbox', { name: '角色姓名', exact: true })).toHaveValue('继续编辑');
});
