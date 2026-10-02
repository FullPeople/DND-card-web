import {test,expect} from '@playwright/test';
import {ready,workspace} from './automationChoiceFixture';

test('detailed features start collapsed, expand only on request and preserve separate saved page preferences',async({page})=>{
  await ready(page);await page.getByRole('tab',{name:'特性',exact:true}).click();
  const features=page.locator('.features-page-grid .feature-bubble'),resource=page.locator('[data-feature-id="feature-1"]');
  await expect(features).toHaveCount(2);await expect(page.locator('.features-page-grid .feature-bubble.is-expanded')).toHaveCount(0);
  await expect(page.locator('.features-page-grid .feature-prose')).toHaveCount(0);
  await resource.locator('.feature-caption').click();await expect(resource).toHaveClass(/is-expanded/);await expect(resource.locator('.feature-prose')).toContainText('原创资源验收条目');
  await expect(page.locator('[data-feature-id="feature-0"]')).not.toHaveClass(/is-expanded/);
  await page.getByRole('tab',{name:'主要',exact:true}).click();await expect(page.locator('.class-features .feature-bubble.is-expanded')).toHaveCount(0);
  await page.getByRole('tab',{name:'特性',exact:true}).click();await expect(resource).toHaveClass(/is-expanded/);
  await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();await page.getByRole('tab',{name:'特性',exact:true}).click();
  await expect(resource).toHaveClass(/is-expanded/);await expect(page.locator('[data-feature-id="feature-0"]')).not.toHaveClass(/is-expanded/);
  await resource.locator('.feature-caption').click();await expect(resource).not.toHaveClass(/is-expanded/);
  await page.getByRole('button',{name:'展开全部职业特性',exact:true}).click();await expect(page.locator('.features-page-grid .feature-bubble.is-expanded')).toHaveCount(2);
  await page.getByRole('button',{name:'折叠全部职业特性',exact:true}).click();await expect(page.locator('.features-page-grid .feature-bubble.is-expanded')).toHaveCount(0);
});

test('pending choices stay discoverable without automatically expanding the feature prose',async({page})=>{
  await ready(page);await page.getByRole('tab',{name:'特性',exact:true}).click();
  const feature=page.locator('[data-feature-id="feature-0"]');await expect(feature).toHaveClass(/choice-pending/);await expect(feature).not.toHaveClass(/is-expanded/);
  await expect(feature.locator('.feature-caption')).toContainText('0/1');await feature.locator('.feature-caption').click();await expect(workspace(page,'测试圣职')).toBeVisible();
  await page.keyboard.press('Escape');await expect(feature).not.toHaveClass(/is-expanded/);await expect(feature.locator('.feature-prose')).toHaveCount(0);
  await feature.locator('.feature-caption').click();await workspace(page,'测试圣职').getByRole('button',{name:'保护者',exact:true}).click();await page.keyboard.press('Escape');
  await expect(feature).not.toHaveClass(/is-expanded/);await expect(feature).toContainText('测试圣职：保护者');
  await feature.locator('.feature-caption').click();await expect(feature).toHaveClass(/is-expanded/);await expect(feature.getByRole('button',{name:'调整测试圣职 1/1',exact:true})).toBeVisible();
});
