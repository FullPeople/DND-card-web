import {test,expect,type Page,type Locator} from '@playwright/test';
import {newCharacter,type Character} from '../../src/core/model';

// Retained behaviors from the 217/218 suites, exercised through the approved dashboard.
const fixture='/tests/fixtures/resource-dashboard220/index.html';
const read=async(page:Page):Promise<Character>=>JSON.parse((await page.locator('#fixture-data').textContent())!);
async function seek(scope:Locator,id:string){const match=scope.locator(`[data-resource-id="${id}"]`);await match.scrollIntoViewIfNeeded();await expect(match).toBeVisible();return match;}

for(const levels of [2,4,6,9])test(`retained regression: ${levels} standard levels and an independent pact pool remain accessible through continuous vertical scrolling`,async({page})=>{
 const c=newCharacter();c.id='dashboard220-original-fixture';c.name='原创密集法术位';
 c.runtime.resources=Object.fromEntries(Array.from({length:levels},(_,i)=>[`spell-slot:${i+1}`,{name:`${i+1}环法术位`,current:2,max:4,type:'count'}]));
 c.runtime.resources['pact-slot:5']={name:'5环契约法术位',current:1,max:3,type:'count'};
 c.spellSettings={ability:'int',attackBonus:0,dcBonus:0,mode:'prepared',capacity:0,prepared:[],slots:Object.fromEntries(Array.from({length:levels},(_,i)=>[String(i+1),{max:4,used:2}]))};
 const scenario=`compat-slots-${levels}`;
 await page.addInitScript(([key,data])=>localStorage.setItem(key,data),[`resource-dashboard220:${scenario}`,JSON.stringify(c)]);
 await page.goto(`${fixture}?scenario=${scenario}`);const scope=page.locator('.fixture-quickbar');
 for(const width of [1512,390]){
  await page.setViewportSize({width,height:982});await expect(scope.locator('.resource-page-nav')).toHaveCount(0);
  const seen=new Map<string,string>();
  for(const id of ['spell-slot:1','pact-slot:5']){
   await seek(scope,id);
   const faces=scope.locator('.resource-widget-face');
   expect(await faces.evaluateAll(nodes=>nodes.every(face=>{
    const bounds=face.getBoundingClientRect();
    return face.scrollHeight<=face.clientHeight+1&&[...face.querySelectorAll('.rm-name,.resource-subvalue,.rm-pool-label,.rm-pool-current')].every(child=>{const rect=child.getBoundingClientRect(),styles=getComputedStyle(child);return rect.width>0&&rect.height>0&&Number.parseFloat(styles.fontSize)>=8&&styles.visibility==='visible'&&Number(styles.opacity)>0&&rect.top>=bounds.top-1&&rect.bottom<=bounds.bottom+1&&rect.left>=bounds.left-1&&rect.right<=bounds.right+1;});
   }))).toBe(true);
   for(const row of await scope.locator('[data-subresource-id]').evaluateAll(nodes=>nodes.map(node=>({id:node.getAttribute('data-subresource-id')!,level:node.querySelector('.rm-pool-label')!.textContent!,current:node.getAttribute('data-resource-current'),label:node.getAttribute('aria-label'),icons:node.querySelectorAll('.rm-icon-unit').length,filled:node.querySelectorAll('.rm-icon-unit.is-filled').length,iconCount:node.getAttribute('data-icon-count'),numeric:node.querySelector('.rm-pool-current')?.textContent})))){seen.set(row.id,row.level);const resource=c.runtime.resources[row.id];expect(row.current).toBe(String(resource.current));expect(row.label).toBe(`${resource.name}：${resource.current} / ${resource.max}`);if(row.iconCount==='true'){expect(row.icons).toBe(resource.max);expect(row.filled).toBe(resource.current);}else expect(row.numeric).toBe(String(resource.current));}
   await scope.screenshot({path:test.info().outputPath(`dense-${levels}-${width}-${id.replace(':','-')}.png`)});
  }
  expect([...seen.keys()].sort()).toEqual(Object.keys(c.runtime.resources).sort());
  expect(Array.from({length:levels},(_,i)=>seen.get(`spell-slot:${i+1}`))).toEqual(['I','II','III','IV','V','VI','VII','VIII','IX'].slice(0,levels));expect(seen.get('pact-slot:5')).toBe('V');
  expect((await read(page)).runtime.resources).toEqual(c.runtime.resources);
 }
});

test('retained regression: touch can spend and vertically reach other resources without losing balances',async({browser,baseURL,browserName})=>{
 test.skip(browserName==='firefox','Firefox does not support Playwright isMobile contexts; narrow desktop interactions have separate coverage');
 const context=await browser.newContext({baseURL,viewport:{width:375,height:650},hasTouch:true,isMobile:true});
 try {
  const page=await context.newPage();await page.goto(fixture);const scope=page.locator('.fixture-quickbar');
  await scope.locator('[data-resource-id="surge"] .resource-widget-face').tap();const panel=page.getByRole('dialog',{name:'动作如潮资源操作',exact:true});
  await panel.getByRole('button',{name:'动作如潮 3',exact:true}).tap();await panel.getByRole('button',{name:'关闭资源操作',exact:true}).tap();
  expect((await read(page)).runtime.resources.surge.current).toBe(2);await expect(scope.locator('[data-resource-id="surge"]')).toHaveAttribute('data-resource-current','2');
  await seek(scope,'focus');await expect(scope.locator('.resource-page-nav')).toHaveCount(0);
  const geometry=await scope.locator('.resource-widget-canvas').evaluate(el=>({w:el.clientWidth,h:el.clientHeight,sw:el.scrollWidth,sh:el.scrollHeight}));expect(geometry.sw).toBeLessThanOrEqual(geometry.w+1);expect(geometry.sh).toBeLessThanOrEqual(geometry.h+1);
  await seek(scope,'surge');await expect(scope.locator('[data-resource-id="surge"]')).toHaveAttribute('data-resource-current','2');await page.reload();expect((await read(page)).runtime.resources.surge.current).toBe(2);
 } finally {await context.close();}
});

test('retained regression: a custom group edits only its selected child and preserves other balances after reload',async({page})=>{
 await page.goto(fixture);const initial=(await read(page)).runtime.resources;
 await page.getByTestId('dashboard-open').click();const dialog=page.getByRole('dialog',{name:'仪表盘',exact:true});await expect(dialog.locator('.resource-dashboard')).toHaveAttribute('data-overlap-count','0');
 await dialog.getByRole('button',{name:'多模块',exact:true}).click();await dialog.getByRole('button',{name:'添加子项',exact:true}).click();await dialog.locator('[data-template-id="pool"]').click();await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const added=await read(page),ids=Object.keys(added.runtime.resources).filter(id=>!Object.hasOwn(initial,id));expect(ids).toHaveLength(3);
 const anchor=ids.find(id=>added.quickbarLayout?.widgets?.[id]?.members?.length===3)!;const group=await seek(dialog,anchor);await group.locator('.resource-widget-face').click();expect((await read(page)).runtime.resources).toEqual(added.runtime.resources);await expect(page.locator('.resource-widget-popover')).toHaveCount(0);
 await group.locator('.resource-widget-face').dblclick();await expect(dialog.locator('.resource-module-tabs button')).toHaveCount(3);await dialog.getByRole('button',{name:'子资源 2',exact:true}).click();
 await dialog.getByRole('textbox',{name:'资源名称',exact:true}).fill('余烬');await dialog.getByRole('spinbutton',{name:'资源剩余',exact:true}).fill('1');await dialog.getByRole('button',{name:'保存',exact:true}).click();
 const expected=structuredClone(added.runtime.resources),child=ids.find(id=>expected[id].name==='子资源 2')!;expected[child]={...expected[child],name:'余烬',current:1};
 await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const savedResources=(await read(page)).runtime.resources;expect(savedResources).toEqual(expected);for(const field of ['locked','icon'] as const){expect(Object.hasOwn(savedResources[child],field)).toBe(Object.hasOwn(added.runtime.resources[child],field));expect(savedResources[child][field]).toBe(added.runtime.resources[child][field]);}await page.reload();expect((await read(page)).runtime.resources).toEqual(expected);
 const main=page.locator('.fixture-quickbar'),restored=await seek(main,anchor);await expect(restored.locator('.resource-subvalue')).toHaveCount(3);await restored.locator('.resource-widget-face').click();
 const panel=page.getByRole('dialog',{name:'新资源资源操作',exact:true});await panel.getByText('余烬',{exact:true}).hover();await panel.getByRole('button',{name:'设置余烬',exact:true}).click();const config=page.getByRole('dialog',{name:'资源配置',exact:true});
 await expect(config.getByRole('textbox',{name:'资源名称',exact:true})).toHaveValue('余烬');await expect(config.locator('.resource-editor-form')).toHaveCount(1);
});
