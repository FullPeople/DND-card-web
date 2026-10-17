import {test,expect} from '@playwright/test';
for(const [name,width,height,phone] of [['desktop',1440,960,false],['compact-desktop',600,420,false],['tablet',768,1024,false],['small-tablet',600,960,false],['phone',390,844,true],['landscape-phone',844,390,true]] as const){
 test.describe(name,()=>{
 test.use({hasTouch:phone||name.includes('tablet'),isMobile:phone});
 test(`${name} plays the opening once and uses the correct sidebar default`,async({page},info)=>{
  await page.setViewportSize({width,height});await page.route('**/api/home/projects',route=>route.fulfill({json:{projects:{}}}));
  await page.addInitScript(()=>{(window as any).introTrace=[];let previous='';new MutationObserver(()=>{const value=document.body?.dataset.intro;if(value&&value!==previous){previous=value;(window as any).introTrace.push(value);}}).observe(document,{attributes:true,subtree:true,attributeFilter:['data-intro']});});
  const errors:string[]=[],requests:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-intro','complete');
  if(phone)await expect(page.locator('#works-panel')).toBeHidden();
  else{await expect(page.locator('#works-panel')).toBeVisible();await expect(page.locator('.project-carousel')).toHaveAttribute('data-ready','true');await expect(page.locator('.project-showcase')).toHaveClass(/wide/);}
  await page.waitForTimeout(1600);expect((await page.evaluate(()=>(window as any).introTrace)).filter((value:string)=>value==='playing')).toHaveLength(1);
  expect(requests.some(url=>/dice-experience|physics.worker|\.wasm|api\/session/.test(url))).toBe(false);expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`${name}.png`)});
 });
 });
}

test('a failed homepage entry leaves a working reload action instead of a frozen opening',async({page})=>{
 await page.route('**/assets/index-*.js',route=>route.abort('failed'));
 await page.goto('/',{waitUntil:'commit'});await expect(page.locator('body')).toHaveAttribute('data-intro','failed');
 await expect(page.getByRole('alert')).toContainText('页面文件未能加载');await expect(page.getByRole('button',{name:'重新加载',exact:true})).toBeVisible();
});

test('carousel opening follows elapsed time when animation frames arrive slowly',async({page})=>{
 await page.setViewportSize({width:1440,height:960});
 await page.route('**/api/home/projects',route=>route.fulfill({json:{projects:{}}}));
 await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>raf(()=>{window.setTimeout(()=>callback(performance.now()),250);});});
 await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-intro','complete');
 await page.locator('.project-carousel canvas').waitFor({state:'attached'});
 await expect(page.locator('.project-carousel')).toHaveAttribute('data-ready','true',{timeout:2000});
});
