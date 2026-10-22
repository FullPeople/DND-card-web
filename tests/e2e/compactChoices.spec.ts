import {writeFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';
import {raw,ready,workspace} from './automationChoiceFixture';

test('unfinished choices stay compact beside their title and retain input and capture behavior',async({page},info)=>{
  const touch=info.project.name==='touch-390';
  await ready(page);
  if(touch){await page.getByRole('button',{name:'切换为非 A4 显示',exact:true}).click();}
  await page.getByRole('tab',{name:'特性',exact:true}).click();
  await expect(page.getByRole('tab',{name:'特性',exact:true})).toHaveAttribute('aria-selected','true');
  const feature=page.locator('[data-feature-id="feature-0"]'),normal=page.locator('[data-feature-id="feature-1"]');
  const chip=page.getByRole('button',{name:'起始熟练项 0/2',exact:true});
  await expect(chip).toBeVisible();await expect(feature).toContainText('测试圣职');await expect(feature).toContainText('0/1');
  const metrics=await page.evaluate(()=>{
    const rect=(el:Element|null)=>{if(!(el instanceof HTMLElement))return null;const b=el.getBoundingClientRect();return {width:el.offsetWidth,height:el.offsetHeight,x:b.x,y:b.y,right:b.right,bottom:b.bottom};};
    return {chip:rect(document.querySelector('.sheet-choice-chip.is-pending')),pending:rect(document.querySelector('.feature-bubble.choice-pending .choice-outline')?.parentElement||document.querySelector('.feature-bubble.choice-pending')),normal:rect(document.querySelector('[data-feature-id="feature-1"] .feature-caption')),heading:rect(document.querySelector('.feature-group>h4')),paper:rect(document.querySelector('.paper'))};
  });
  writeFileSync(info.outputPath('geometry.json'),JSON.stringify(metrics,null,2));
  await page.screenshot({path:info.outputPath('compact-choices.png'),fullPage:touch});
  if(process.env.COMPACT_CHOICES_BASELINE)return;
  expect(metrics.chip).not.toBeNull();expect(metrics.pending).not.toBeNull();
  // Logical CSS dimensions avoid confusing a scaled A4 sheet with screen mode.
  expect(metrics.chip!.width*metrics.chip!.height).toBeLessThanOrEqual(1200);
  expect(metrics.pending!.width*metrics.pending!.height).toBeLessThanOrEqual(500);
  expect(metrics.chip!.x).toBeGreaterThan(metrics.heading!.x+60);
  expect(metrics.chip!.right).toBeLessThanOrEqual(metrics.paper!.right);
  await expect(normal.locator('.feature-caption')).toContainText('测试回气');
  await chip.focus();await page.keyboard.press('Enter');await expect(workspace(page,'起始熟练项')).toBeVisible();await page.keyboard.press('Escape');
  const pending=feature.locator('.feature-caption');
  await expect(pending).toHaveAttribute('aria-label','选择测试圣职');
  if(touch)await pending.tap();else{await pending.focus();await page.keyboard.press('Space');}
  await expect(workspace(page,'测试圣职')).toBeVisible();
  await workspace(page,'测试圣职').getByRole('button',{name:'保护者',exact:true}).click();await page.keyboard.press('Escape');
  await expect(feature).not.toHaveClass(/choice-pending/);await expect(feature).toContainText('测试圣职：保护者');await expect(feature.locator('.feature-choice-count')).toHaveCount(0);
  await expect(page.locator('.save-status')).toContainText('已保存到本机');
  await page.reload();await page.getByRole('tab',{name:'特性',exact:true}).click();
  await expect(page.getByRole('tab',{name:'特性',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('.features-page-grid')).toBeVisible();await expect(feature).toContainText('测试圣职：保护者');
  const before=await page.locator('.paper').evaluate(el=>({width:el.clientWidth,height:el.clientHeight}));
  const capture=await page.evaluate(async()=>{const module='/src/platform/sheetImage.ts';const {captureSheet}=await import(module),blob=await captureSheet(),image=await createImageBitmap(blob);const result={width:image.width,height:image.height,size:blob.size};image.close();return result;});
  expect(capture.width).toBe(2480);expect(capture.height).toBe(3508);expect(capture.size).toBeGreaterThan(10000);
  await expect(page.locator('.paper')).not.toHaveClass(/sheet-export/);expect(await page.locator('.paper').evaluate(el=>({width:el.clientWidth,height:el.clientHeight}))).toEqual(before);
  await expect(feature).toContainText('测试圣职：保护者');
});

test('a newly unlocked level choice keeps its name and compact count through selection and reload',async({page},info)=>{
  const data=structuredClone(raw) as Record<string,any[]>;
  data.class[0].classFeatures.push('测试进阶选择|测试职业|XPHB|2|XPHB');
  data.classFeature.push({name:'测试进阶选择',source:'XPHB',className:'测试职业',classSource:'XPHB',level:2,entries:[{type:'options',count:1,entries:[{type:'entries',name:'进阶甲',entries:['原创进阶选项甲。']},{type:'entries',name:'进阶乙',entries:['原创进阶选项乙。']}]}]});
  await ready(page,data);
  if(info.project.name==='touch-390')await page.getByRole('button',{name:'切换为非 A4 显示',exact:true}).click();
  const level=page.getByRole('spinbutton',{name:'测试职业等级',exact:true});await level.fill('2');await level.press('Tab');
  await page.getByRole('tab',{name:'特性',exact:true}).click();
  const feature=page.locator('.feature-bubble').filter({hasText:'测试进阶选择'});
  await expect(feature).toHaveClass(/choice-pending/);await expect(feature).toContainText('0/1');
  const size=await feature.locator('.feature-choice-count').evaluate(el=>({width:(el as HTMLElement).offsetWidth,height:(el as HTMLElement).offsetHeight}));
  expect(size.width*size.height).toBeLessThanOrEqual(500);
  await page.screenshot({path:info.outputPath('upgraded-choice.png'),fullPage:info.project.name==='touch-390'});
  if(info.project.name==='touch-390')await feature.locator('.feature-caption').tap();else await feature.locator('.feature-caption').click();
  await expect(workspace(page,'测试进阶选择')).toBeVisible();await workspace(page,'测试进阶选择').getByRole('button',{name:'进阶甲',exact:true}).click();await page.keyboard.press('Escape');
  await expect(feature).not.toHaveClass(/choice-pending/);await expect(feature).toContainText('测试进阶选择：进阶甲');
  await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();await page.getByRole('tab',{name:'特性',exact:true}).click();
  await expect(feature).toContainText('测试进阶选择：进阶甲');await expect(page.getByRole('spinbutton',{name:'测试职业等级',exact:true})).toHaveValue('2');
});
