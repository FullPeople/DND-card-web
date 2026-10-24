import {expect,type Locator,type Page} from '@playwright/test';

/** One real pointer gesture. Scrolling and hit testing are viewport operations,
 * never answer/state injection. Auto-scroll may move a slot during the path. */
export async function pointerChoiceDrop(page:Page,row:Locator,slot:Locator,accepted=true){
 await expect(row).toBeVisible();await row.scrollIntoViewIfNeeded();const from=await row.boundingBox();expect(from).not.toBeNull();
 await page.mouse.move(from!.x+25,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(from!.x+40,from!.y+from!.height/2,{steps:3});
 await expect(page.locator('.pointer-ghost')).toBeVisible();await expect(slot).toBeVisible();
 if((page.viewportSize()?.width||0)<=760)await expect(page.locator('.sheet-pane')).toHaveClass(/mobile-active/);
 const center=async()=>{
  await slot.evaluate(element=>element.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
  const rect=await slot.boundingBox();expect(rect).not.toBeNull();return {x:rect!.x+rect!.width/2,y:rect!.y+rect!.height/2};
 };
 const initial=await center();await page.mouse.move(initial.x,initial.y,{steps:15});
 // Recenter after the path, then calibrate once to current geometry. Do not
 // release over coordinates captured before pointerDrag's edge auto-scroll.
 const final=await center();await page.mouse.move(final.x,final.y);
 await expect.poll(()=>slot.evaluate((element,point)=>{
  const hit=document.elementFromPoint(point.x,point.y),rect=element.getBoundingClientRect();
  let safe=point.x>rect.left&&point.x<rect.right&&point.y>rect.top&&point.y<rect.bottom;
  for(let parent=element.parentElement;parent;parent=parent.parentElement){
   const style=getComputedStyle(parent),bounds=parent.getBoundingClientRect();
   if(/auto|scroll/.test(style.overflowY)&&parent.scrollHeight>parent.clientHeight)safe&&=point.y>bounds.top+24&&point.y<bounds.bottom-24;
  }
  return {target:hit?.closest('[data-drop-zone]')===element,safe,over:element.classList.contains('drop-over')};
 },final)).toMatchObject({target:true,safe:true,...(accepted?{over:true}:{})});
 await page.mouse.up();await expect(page.locator('.pointer-ghost')).toHaveCount(0);
}
