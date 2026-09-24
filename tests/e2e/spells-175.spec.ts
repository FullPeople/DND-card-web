import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter,type Character,type Entry} from '../../src/core/model';
const entry=(kind:Entry['kind'],name:string,raw:Entry['raw']={}):Entry=>({id:`test:${kind}:${name}`,kind,name,english:name,source:'XPHB',edition:'2024',packId:'test',revision:'1',raw,entries:['用于验证的正文。']});
const add=(c:Character,e:Entry,level=1)=>{const row={id:e.id,entry:e,quantity:1,level,equipped:false};c.selections.push(row);return row;};
async function load(page:Page,c:Character,setup?:()=>Promise<unknown>){await mockSource(page);await setup?.();await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗'}).click();}

test('normal-mode preparations fly as compact tiles and survive reload while slots stay in resources',async({page})=>{
 const c=newCharacter();add(c,entry('class','星术师',{classTableGroups:[{rowsSpellProgression:[[2],[3],[4,2]]}],spellcastingAbility:'int'}),3);add(c,entry('spell','星光矢',{level:1,school:'V'}));add(c,entry('spell','星界护盾',{level:1,school:'A',duration:[{concentration:true}]}));
 await load(page,c);await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(page.getByRole('switch',{name:'编辑模式'})).toHaveAttribute('aria-checked','false');
 await expect(page.locator('.spell-slots-cell')).toHaveCount(0);await expect(page.locator('.prepared-cell')).toBeVisible();await expect(page.getByRole('button',{name:'预备空位1',exact:true})).toBeVisible();
 const learned=page.locator('.spell-library .spell-stock-tile').filter({hasText:'星光矢'});await expect(learned).toHaveCSS('display','block');await expect(learned).toHaveCSS('height','14px');await expect(learned.locator('.stock-name')).toHaveCSS('text-align','left');
 await page.evaluate(()=>{(window as any).spellFlights=0;new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node instanceof HTMLElement&&node.classList.contains('spell-tile-flight'))(window as any).spellFlights++;}).observe(document.body,{childList:true});});
 await learned.click();await expect(page.getByRole('button',{name:'取消预备星光矢',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as any).spellFlights)).toBe(1);
 await page.getByRole('button',{name:'取消预备星光矢',exact:true}).click();await expect(page.getByRole('button',{name:'取消预备星光矢',exact:true})).toHaveCount(0);await expect(page.locator('.prepared-cell')).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as any).spellFlights)).toBe(2);
 await page.locator('.spell-library .spell-stock-tile').filter({hasText:'星界护盾'}).click();await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(page.getByRole('button',{name:'取消预备星界护盾',exact:true})).toBeVisible();await page.screenshot({path:'F:/CodexWork/2026-09-20/w-xu/spells179-flight.png',fullPage:true});
});

test('manually added subclass level feature is grouped under the source-qualified subclass at its main class level',async({page})=>{
 const c=newCharacter();const cls=add(c,entry('class','星术师'),6);const sub=add(c,entry('subclass','星术学派',{shortName:'星术',className:'星术师',classSource:'XPHB'}));Object.assign(sub,{parentId:cls.id});add(c,entry('feature','星轨',{className:'星术师',classSource:'XPHB',subclassShortName:'星术',subclassSource:'XPHB',level:6}));
 await load(page,c);await page.getByRole('tab',{name:'特性',exact:true}).click();await expect(page.locator('.detail-class-features')).toContainText('子职 星术学派 Lv.6');await expect(page.locator('.detail-class-features')).not.toContainText('其他特性');await expect(page.locator('.detail-class-features')).toContainText('星轨');
});

test('dragging a nested section from a subclass level feature preserves subclass ownership',async({page})=>{
 const c=newCharacter(),cls=add(c,entry('class','星术师'),6),sub=add(c,entry('subclass','星术学派',{shortName:'星术',className:'星术师',classSource:'XPHB'}));Object.assign(sub,{parentId:cls.id});
 await load(page,c,()=>page.route('**/data/class/class-test.json',r=>r.fulfill({json:{
  class:[{name:'星术师',source:'XPHB',hd:{faces:6}}],
  subclass:[{name:'星术学派',source:'XPHB',shortName:'星术',className:'星术师',classSource:'XPHB',subclassFeatures:['星轨|星术师|XPHB|星术|XPHB|6']}],
  subclassFeature:[{name:'星轨',source:'XPHB',className:'星术师',classSource:'XPHB',subclassShortName:'星术',subclassSource:'XPHB',level:6,entries:[{type:'entries',name:'星光屏障',entries:['一层手动记录的屏障。']}]}]
 }})));
 await page.getByRole('switch',{name:'编辑模式'}).click();await page.locator('.catalog-row').filter({hasText:'星术师'}).click();await page.getByRole('button',{name:'子职',exact:true}).click();await page.locator('.class-subclasses button').filter({hasText:'星术学派'}).click();
 const heading=page.locator('.document-heading-toggle').filter({hasText:'星光屏障'});await expect(heading).toBeVisible();await heading.dragTo(page.locator('.class-features'));
 await expect(page.locator('.class-features')).toContainText('星光屏障');await expect(page.locator('.class-features')).toContainText('子职 星术学派 Lv.6');await expect(page.locator('.class-features')).not.toContainText('其他特性');
});
