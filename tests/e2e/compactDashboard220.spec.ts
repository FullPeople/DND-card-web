import {test,expect} from '@playwright/test';

for(const width of [1100,390])test.describe(`compact dashboard ${width}`,()=>{
 test.use({viewport:{width,height:844}});
 test('real compact faces retain their pending operation row across close, reopen and reload',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('/tests/fixtures/compact-dashboard220/');
  const ring=page.locator('.compact-resource[data-resource-id="ring"]'),face=ring.locator('.resource-widget-face'),popover=ring.locator('.compact-resource-popover');
  await expect(page.locator('.resource-module-art')).toHaveCount(4);
  await expect(ring.locator('.resource-module-art')).toHaveCSS('--rm-icon-tone','#436978');
  await expect(page.locator('[data-resource-id="pips"] .resource-module-art .rm-icon-unit')).toHaveCount(4);
  await expect(page.locator('[data-resource-id="fraction"] .resource-module-art')).toHaveAttribute('data-module-style','fraction');
  await expect(ring).toHaveAttribute('data-resource-current','3');
  await page.evaluate(()=>{(window as any).originalResourceRow=document.querySelector('[data-resource-id="ring"] .console-resource');});
  await face.click();await expect(popover).toBeVisible();
  await popover.getByRole('button',{name:'消耗环形行动',exact:true}).click();
  await expect(ring).toHaveAttribute('data-resource-current','2');
  await popover.getByRole('button',{name:'关闭资源操作',exact:true}).click();await expect(popover).toBeHidden();
  expect(await page.evaluate(()=>(window as any).originalResourceRow===document.querySelector('[data-resource-id="ring"] .console-resource'))).toBe(true);
  await face.click();await expect(popover).toBeVisible();await expect(ring).toHaveAttribute('data-resource-current','2');
  await expect(page.locator('#pending')).toHaveText('0');
  const persisted=JSON.parse(await page.locator('#fixture-data').textContent()||'{}');expect(persisted.resources.find((r:any)=>r.id==='ring').current).toBe(2);
  await popover.getByRole('button',{name:'关闭资源操作',exact:true}).click();
  await page.reload();await expect(ring).toHaveAttribute('data-resource-current','2');await expect(ring.locator('.resource-module-art')).toHaveCSS('--rm-icon-tone','#436978');
  await face.click();await expect(popover).toBeVisible();await expect(popover.locator('.resource-numeric')).toHaveText('2 / 5');
  const bounds=await popover.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
  expect(errors).toEqual([]);await page.screenshot({path:testInfo.outputPath(`compact-popover-${width}.png`),fullPage:true});
 });
 test('capacity-filtered editor styles fit a narrow panel and preserve the selected face',async({page},testInfo)=>{
  await page.goto('/tests/fixtures/compact-dashboard220/');
  const pips=page.locator('.compact-resource[data-resource-id="pips"]');await pips.locator('.resource-widget-face').click();
  await pips.locator('.console-resource').hover();
  await page.evaluate(()=>{(window as any).originalResourceRow=document.querySelector('[data-resource-id="pips"] .console-resource');});
  await pips.getByRole('button',{name:'设置图标行动',exact:true}).click();
  await expect(pips.locator('.compact-resource-popover')).toBeHidden();
  expect(await page.evaluate(()=>(window as any).originalResourceRow===document.querySelector('[data-resource-id="pips"] .console-resource'))).toBe(true);
  const editor=page.getByRole('dialog',{name:'资源设置',exact:true}),buttons=editor.locator('.resource-style-picker button');
  await expect(buttons).toHaveCount(11);
  for(const name of ['子资源','子资源铭牌','子资源条','子资源图标','单次状态'])await expect(buttons.filter({hasText:name})).toHaveCount(0);
  await expect(buttons.filter({hasText:'图标矩阵'})).toBeVisible();
  const overflow=await editor.evaluate(node=>({scroll:node.scrollWidth,width:node.clientWidth,viewport:innerWidth,rect:node.getBoundingClientRect().toJSON(),buttons:[...node.querySelectorAll('.resource-style-picker button')].map(button=>button.getBoundingClientRect().toJSON())}));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.width+1);expect(overflow.rect.left).toBeGreaterThanOrEqual(0);expect(overflow.rect.right).toBeLessThanOrEqual(width);
  for(const button of overflow.buttons){expect(button.left).toBeGreaterThanOrEqual(overflow.rect.left);expect(button.right).toBeLessThanOrEqual(overflow.rect.right);}
  await buttons.filter({hasText:'菱形'}).click();await editor.getByRole('button',{name:'保存',exact:true}).click();await expect(editor).toBeHidden();
  await expect(pips.locator('.resource-module-art')).toHaveAttribute('data-module-style','diamond');await expect(pips.locator('.resource-module-art')).toHaveCSS('--rm-icon-tone','#926041');
  await page.reload();await expect(pips.locator('.resource-module-art')).toHaveAttribute('data-module-style','diamond');
  const state=JSON.parse(await page.locator('#fixture-data').textContent()||'{}');expect(state.layouts.pips.icon).toBe('flame');expect(state.resources.find((r:any)=>r.id==='pips').current).toBe(2);
  await pips.locator('.resource-widget-face').click();await pips.locator('.console-resource').hover();await pips.getByRole('button',{name:'设置图标行动',exact:true}).click();await expect(editor).toBeVisible();
  await expect(pips.locator('.compact-resource-popover')).toBeHidden();
  await editor.getByLabel('资源上限',{exact:true}).fill('100');await expect(buttons).toHaveCount(7);for(const name of ['图标','图标矩阵','断环','分段槽'])await expect(buttons.filter({hasText:name})).toHaveCount(0);await expect(editor.locator('.resource-editor-preview .resource-module-art')).toHaveAttribute('data-module-style','diamond');
  await page.screenshot({path:testInfo.outputPath(`compact-editor-${width}.png`),fullPage:true});
  await editor.getByRole('button',{name:'取消',exact:true}).click();await pips.locator('.resource-widget-face').click();
  await expect(pips.locator('.compact-resource-popover')).toBeVisible();await expect(pips).toHaveAttribute('data-resource-current','2');expect(JSON.parse(await page.locator('#fixture-data').textContent()||'{}').resources.find((r:any)=>r.id==='pips').max).toBe(4);
 });
});

for(const width of [1100,390])test(`actual overview groups shared, pact and custom pools at ${width}px without losing operations`,async({page},info)=>{
 await page.setViewportSize({width,height:1000});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/tests/fixtures/compact-overview222/#suite=compact-overview222&bridge='+encodeURIComponent(String(info.project.use.baseURL)));
 const card=page.locator('[data-resource-target="hero"]'),modules=card.locator('.compact-resource');await expect(modules).toHaveCount(4);
 const shared=card.locator('[data-resource-id="spell-slot:1"]'),pact=card.locator('[data-resource-id="pact-slot:2"]'),group=card.locator('[data-resource-id="food"]');
 await expect(shared.locator('.rm-pool-label')).toHaveText(['I','II','III','IV','V','VI','VII','VIII','IX']);await expect(shared.locator('.resource-module-art')).toHaveAttribute('data-module-style','poolchips');
 await expect(pact.locator('.rm-pool-label')).toHaveText(['II']);await expect(pact.locator('[data-subresource-id="pact-slot:2"]')).toHaveAttribute('data-resource-current','1');await expect(pact.locator('[data-subresource-id="pact-slot:2"]')).toHaveAttribute('aria-label','2环契约位：1 / 2');await expect(pact.locator('.rm-icon-unit')).toHaveCount(2);await expect(pact.locator('.rm-icon-unit.is-filled')).toHaveCount(1);await expect(group.locator('.rm-pool-label')).toHaveText(['食物','饮水']);await expect(group.locator('.resource-module-art')).toHaveCSS('--rm-icon-tone','#527448');
 await expect(card.locator('[data-resource-id="focus"] .rm-icon-unit')).toHaveCount(3);
 const clipped=await modules.locator('.resource-widget-face').evaluateAll(faces=>faces.some(face=>{const rect=face.getBoundingClientRect();return [...face.querySelectorAll('.resource-subvalue')].some(el=>{const r=el.getBoundingClientRect();return r.top<rect.top-1||r.left<rect.left-1||r.right>rect.right+1||r.bottom>rect.bottom+1;});}));expect(clipped).toBe(false);
 await page.evaluate(()=>{(window as any).originalPoolRow=document.querySelector('[data-resource-id="spell-slot:1"] .console-resource');});
 await shared.locator('.resource-widget-face').click();await shared.getByRole('button',{name:'原创总览测试1环法术位 3',exact:true}).click();await expect(shared.locator('[data-subresource-id="spell-slot:1"]')).toHaveAttribute('data-resource-current','2');
 await shared.getByRole('button',{name:'关闭资源操作',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).overview222.authority().resources.find((r:any)=>r.id==='spell-slot:1').current)).toBe(2);
 expect(await page.evaluate(()=>(window as any).originalPoolRow===document.querySelector('[data-resource-id="spell-slot:1"] .console-resource'))).toBe(true);await expect(pact.locator('[data-subresource-id="pact-slot:2"]')).toHaveAttribute('data-resource-current','1');await expect(pact.locator('[data-subresource-id="pact-slot:2"]')).toHaveAttribute('aria-label','2环契约位：1 / 2');await expect(pact.locator('.rm-icon-unit')).toHaveCount(2);await expect(pact.locator('.rm-icon-unit.is-filled')).toHaveCount(1);
 await group.locator('.resource-widget-face').click();await group.getByRole('button',{name:'消耗原创总览测试饮水',exact:true}).click();await expect(group.locator('[data-subresource-id="water"]')).toHaveAttribute('data-resource-current','4');await expect(group.locator('[data-subresource-id="food"]')).toHaveAttribute('data-resource-current','4');await group.getByRole('button',{name:'关闭资源操作',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).overview222.authority().resources.find((r:any)=>r.id==='water').current)).toBe(4);await page.reload();await expect(shared.locator('[data-subresource-id="spell-slot:1"]')).toHaveAttribute('data-resource-current','2');await expect(group.locator('[data-subresource-id="water"]')).toHaveAttribute('data-resource-current','4');
 await page.evaluate(()=>(window as any).overview222.remote('pact-slot:2',2));await expect(pact.locator('[data-subresource-id="pact-slot:2"]')).toHaveAttribute('data-resource-current','2');await expect(pact.locator('[data-subresource-id="pact-slot:2"]')).toHaveAttribute('aria-label','2环契约位：2 / 2');await expect(pact.locator('.rm-icon-unit')).toHaveCount(2);await expect(pact.locator('.rm-icon-unit.is-filled')).toHaveCount(2);
 // CompactResourceGrid keeps its separate nine-item pagination; only the full dashboard became continuous.
 const publicRows=page.locator('.public-resources .resource-module-art');await expect(publicRows).toHaveCount(16);expect(new Set(await publicRows.evaluateAll(rows=>rows.map(row=>row.getAttribute('data-module-style')))).size).toBe(16);
 await page.locator('.public-resources').getByRole('button',{name:'下一页资源',exact:true}).click();await expect(page.locator('.public-resources [data-resource-id="diamond"]')).toBeVisible();await page.locator('.public-resources').getByRole('button',{name:'上一页资源',exact:true}).click();
 await page.evaluate(()=>(window as any).overview222.readonly());await shared.locator('.resource-widget-face').click();await expect(shared.getByRole('button',{name:'原创总览测试1环法术位 1',exact:true})).toBeDisabled();await shared.getByRole('button',{name:'关闭资源操作',exact:true}).click();
 expect(errors).toEqual([]);await card.screenshot({path:info.outputPath(`overview-modules-${width}.png`)});
});
