import {test,expect} from '@playwright/test';

test('sub-row scrolling keeps live position without rebuilding the same catalog window',async({page},info)=>{
 await page.goto('/card/tests/fixtures/virtual-list/index.html');const list=page.getByLabel('检查列表');
 await list.evaluate(node=>{node.scrollTop=1026;});await expect(list.locator('.virtual-row').first()).toHaveAttribute('data-row-index','17');
 const result=await list.evaluate(async node=>{
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  const before=(window as any).rowRenders;
  for(let i=1;i<=8;i++){node.scrollTop=1026+i;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));}
  return {before,after:(window as any).rowRenders,top:node.scrollTop};
 });
 expect(result.after).toBe(result.before);expect(result.top).toBe(1034);
 await page.getByRole('button',{name:'改变行高'}).click();
 await expect(list.locator('.virtual-row').first()).toHaveAttribute('data-row-index','11');
 await page.getByRole('button',{name:'最后一项'}).click();await expect(list.getByText('原创条目 499',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'缩短列表'}).click();await expect(list.getByText('原创条目 0',{exact:true})).toBeVisible();await expect(list.locator('.virtual-row')).toHaveCount(3);
 await info.attach('virtual-list-row-renders.json',{body:JSON.stringify({scrollSteps:8,...result},null,2),contentType:'application/json'});
});
