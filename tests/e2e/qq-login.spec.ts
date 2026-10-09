import {expect,test} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

for(const width of [1440,390])for(const path of ['/card/?intro=0','/library/'])test(`QQ login entry ${width} ${path}`,async({page})=>{
  await page.setViewportSize({width,height:900});await mockSource(page);await suppressAnnouncement(page);await page.goto(path);
  const link=page.locator('header').getByRole('link',{name:'QQ 登录',exact:true});await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href',/^\/api\/auth\/qq\/login\?returnTo=/);
  const image=link.locator('img');await expect.poll(()=>image.evaluate(node=>(node as HTMLImageElement).naturalWidth)).toBe(width===390?120:170);
  const box=await link.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);expect(box!.y).toBeLessThan(160);
  await link.click();await expect(page.getByRole('heading',{name:'QQ 登录'})).toBeVisible();await expect(page.getByText('网站尚未完成 QQ 登录配置',{exact:false})).toBeVisible();
  await expect(page.getByRole('link',{name:'返回网站'})).toHaveAttribute('href',path);
});
