import { test, expect, type Page } from '@playwright/test';
import { newCharacter, type Character, type Entry } from '../../src/core/model';
import { CONDITION_VISUALS } from '../../src/ui/conditionVisuals';
import { mockSource } from './fixtures';
// Five-page physics and concurrent registered effects need a larger end-to-end budget.
test.setTimeout(90000);
const makeEntry=(id:string,kind:Entry['kind'],name:string,english:string):Entry=>({id,kind,name,english,source:'XPHB',edition:'2024',packId:'test',revision:'1',raw:kind==='class'?{hd:{faces:8}}:{},entries:['自制显示测试资料。']});
const row=(entry:Entry,level=1)=>({id:entry.id,entry,level,quantity:1,equipped:false});
async function openCard(page:Page,c:Character){await mockSource(page);await page.goto('/');await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'atmosphere.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗'}).click();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();}

test('highest class watermark follows levels, tie order, removal, page changes and refresh',async({page})=>{
 const c=newCharacter();c.profile.optional.multiclass=true;c.selections=[row(makeEntry('wizard','class','法师','Wizard'),2),row(makeEntry('fighter','class','战士','Fighter'),1)];
 await openCard(page,c);await page.getByRole('switch',{name:'编辑模式'}).click();const badge=page.locator('.class-watermarks img');await expect(badge).toHaveCount(1);await expect(badge).toHaveAttribute('data-class-badge','wizard');
 await page.getByRole('spinbutton',{name:'战士等级',exact:true}).fill('2');await page.getByRole('spinbutton',{name:'战士等级',exact:true}).press('Tab');await expect(badge).toHaveAttribute('data-class-badge','wizard');
 await page.getByRole('spinbutton',{name:'战士等级',exact:true}).fill('3');await page.getByRole('spinbutton',{name:'战士等级',exact:true}).press('Tab');await expect(badge).toHaveAttribute('data-class-badge','fighter');
 const margins=await badge.evaluate(e=>{const b=e.getBoundingClientRect(),p=e.closest('.paper')!.getBoundingClientRect();return {left:(b.left-p.left)/p.width,right:(p.right-b.right)/p.width,top:(b.top-p.top)/p.height,bottom:(p.bottom-b.bottom)/p.height};});
 for(const value of Object.values(margins))expect(value).toBeGreaterThan(.15);
 await page.getByRole('tab',{name:/特性/}).click();await expect(badge).toHaveAttribute('data-class-badge','fighter');
 await page.reload();await expect(badge).toHaveAttribute('data-class-badge','fighter');await page.getByRole('tab',{name:/主要/}).click();await page.getByRole('switch',{name:'编辑模式'}).click();
 await page.locator('.identity-class .identity-title').filter({hasText:'战士'}).press('Delete');await expect(badge).toHaveAttribute('data-class-badge','wizard');
 await page.evaluate(() => { (window as any).watermarkLeft = false; const node = document.querySelector('.class-watermarks')!; const observer = new MutationObserver(() => { if (node.getAttribute('data-phase') === 'leaving') { (window as any).watermarkLeft = true; observer.disconnect(); } }); observer.observe(node, { attributes: true }); });
 await page.locator('.identity-class .identity-title').filter({hasText:'法师'}).press('Delete');await expect.poll(() => page.evaluate(() => (window as any).watermarkLeft)).toBe(true);await expect(badge).toHaveCount(0);
});

const conditions=(ids:string[])=>ids.map(id=>row(makeEntry(id,'condition',CONDITION_VISUALS[id as keyof typeof CONDITION_VISUALS].name,id)));
async function noOverlap(page:Page){
 const result=await page.locator('.sheet-cell').evaluateAll(nodes=>{const r=nodes.map(e=>e.getBoundingClientRect());return r.flatMap((a,i)=>r.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)).length;});expect(result).toBe(0);
}
test('all effects coexist, death saves persist, editing restores five pages and physical hit boxes follow gravity',async({page})=>{
 const c=newCharacter();c.selections=[row(makeEntry('wizard','class','法师','Wizard'),2),...conditions(Object.keys(CONDITION_VISUALS))];await openCard(page,c);
 await expect(page.locator('.status-strip .feature-bubble')).toHaveCount(Object.keys(CONDITION_VISUALS).length);
 for(const id of Object.keys(CONDITION_VISUALS))await expect(page.locator('.paper')).toHaveClass(new RegExp(`condition-${id}(?: |$)`));
 await page.waitForTimeout(1400);await noOverlap(page);
 await expect(page.locator('.card-art-background [data-card-effect=charmed]')).toHaveCount(1);
 await expect(page.locator('.card-art-edge [data-card-effect=charmed]')).toHaveCount(0);
 expect(await page.locator('.sheet-cell').evaluateAll(nodes=>nodes.filter(e=>Math.abs(parseFloat((e as HTMLElement).style.getPropertyValue('--fall-tilt')))>=1).length)).toBeGreaterThan(1);
 await expect(page.locator('.speed-cell .cell-face')).toHaveCSS('position','absolute');expect(await page.locator('.speed-cell .cell-face').evaluate(e=>getComputedStyle(e,'::after').opacity)).toBe('1');
 await page.getByRole('checkbox',{name:'死亡豁免成功2',exact:true}).check();await page.getByRole('checkbox',{name:'死亡豁免失败1',exact:true}).check();
 await page.getByLabel('当前生命值',{exact:true}).fill('7');await page.getByLabel('当前生命值',{exact:true}).press('Tab');await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('7');
 await page.getByRole('spinbutton',{name:'力竭层数',exact:true}).fill('4');await page.getByRole('spinbutton',{name:'力竭层数',exact:true}).press('Tab');await expect(page.locator('.death-saves-cell .exhaustion-segment.segment-on')).toHaveCount(4);
 const focus=page.locator('.magic-rotation');const before=await focus.evaluate(e=>getComputedStyle(e).transform);await page.waitForTimeout(220);expect(await focus.evaluate(e=>getComputedStyle(e).transform)).not.toBe(before);
 await page.getByRole('switch',{name:'编辑模式'}).click();await page.waitForTimeout(1100);await expect(page.locator('.paper')).not.toHaveClass(/condition-/);
 expect(await page.locator('.sheet-cell').evaluateAll(nodes=>nodes.every(e=>['0px','0px 0px','none'].includes(getComputedStyle(e).translate)))).toBe(true);
 expect(await page.locator('.sheet-cell').evaluateAll(nodes=>nodes.every(e=>(e as HTMLElement).style.getPropertyValue('--fall-tilt')==='0deg'))).toBe(true);
 await expect(page.locator('.portrait-cell')).toHaveCSS('rotate','0deg');await expect(page.locator('[data-card-effect]')).toHaveCount(0);
 const home=await page.locator('.death-saves-cell').boundingBox(),prof=await page.locator('.proficiency-cell').boundingBox();expect(home!.y+home!.height).toBeLessThan(prof!.y);
 await page.reload();await expect(page.getByRole('checkbox',{name:'死亡豁免成功2',exact:true})).toBeChecked();await expect(page.getByRole('checkbox',{name:'死亡豁免失败1',exact:true})).toBeChecked();await expect(page.getByRole('spinbutton',{name:'力竭层数'})).toHaveValue('4');
 for(const name of ['特性','背景','法术','背包']){
   await page.getByRole('tab',{name:new RegExp(name)}).click();await page.waitForTimeout(1100);await noOverlap(page);await expect(page.locator('.status-strip .feature-bubble')).toHaveCount(Object.keys(CONDITION_VISUALS).length);await expect(page.locator('.portrait-cell')).toHaveCSS('rotate','180deg');
   await page.getByRole('switch',{name:'编辑模式'}).click();await page.waitForTimeout(1000);await expect(page.locator('.paper')).not.toHaveClass(/condition-/);await page.getByRole('switch',{name:'编辑模式'}).click();
 }
 await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.card-art-layer').evaluateAll(nodes=>nodes.flatMap(e=>e.getAnimations({subtree:true})).filter(a=>a.playState==='running').length)).toBe(0);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('inherited visuals survive removal of one parent, duplicate sources deduplicate and fear keeps stationary hit boxes',async({page})=>{
 const c=newCharacter();c.selections=conditions(['petrified','stunned']);await openCard(page,c);await expect(page.locator('.paper')).toHaveClass(/condition-incapacitated/);
 await page.getByRole('button',{name:'状态石化',exact:true}).press('Delete');await expect(page.locator('.paper')).toHaveClass(/condition-incapacitated/);await expect(page.locator('.paper')).not.toHaveClass(/condition-petrified/);
 await page.getByRole('button',{name:'状态震慑',exact:true}).press('Delete');await expect(page.locator('.paper')).not.toHaveClass(/condition-incapacitated/);
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(page.locator('.paper')).toHaveClass(/condition-incapacitated/);
 const c2=newCharacter();c2.selections=[...conditions(['frightened','deafened']),row(makeEntry('deaf2','condition','耳聋','deafened'))];await openCard(page,c2);
 await expect(page.locator('[data-card-effect=deafened]')).toHaveCount(1);await page.getByRole('button',{name:'状态耳聋',exact:true}).first().press('Delete');await expect(page.locator('[data-card-effect=deafened]')).toHaveAttribute('data-phase','present');
 await page.waitForTimeout(900);const b=await page.locator('.ability-str').boundingBox();await page.waitForTimeout(180);expect(await page.locator('.ability-str').boundingBox()).toEqual(b);
 expect(await page.locator('.ability-str .cell-face').evaluate(e=>getComputedStyle(e,'::before').animationName)).toBe('frame-tremor');
 await page.getByRole('tab',{name:'未命名的冒险者',exact:true}).click();await expect(page.locator('[data-card-effect]')).toHaveCount(0);
});
