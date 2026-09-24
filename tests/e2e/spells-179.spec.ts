import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter,type Character,type Entry} from '../../src/core/model';
const entry=(kind:Entry['kind'],name:string,raw:Entry['raw']={}):Entry=>({id:`test:${kind}:${name}`,kind,name,english:name,source:'XPHB',edition:'2024',packId:'test',revision:'1',raw,entries:['用于验证的法术正文。']});
const add=(c:Character,e:Entry,level=3)=>c.selections.push({id:e.id,entry:e,quantity:1,level,equipped:false});
async function load(page:Page,c:Character,setup?:()=>Promise<unknown>){await mockSource(page);await setup?.();await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗'}).click();await page.getByRole('tab',{name:'法术',exact:true}).click();}

test('left click moves the one spell between book and preparation, right click opens a menu, slots stay off this page',async({page})=>{
 const c=newCharacter();c.name='法术书预备演示';add(c,entry('class','测试法师',{casterProgression:'full',spellcastingAbility:'int',preparedSpellsProgression:[4,5,6],preparedSpellsChange:'restLong',spellsKnownProgressionFixed:[6,2,2]}));
 for(const name of ['星光矢','星界护盾','很长很长很长名字的测试法术','雾幕','焰光','冰棱','祝愿'])add(c,entry('spell',name,{level:1,school:'V'}));
 await load(page,c);await expect(page.locator('.spell-slots-cell')).toHaveCount(0);const first=page.locator('.spell-library .spell-stock-tile').filter({hasText:'星光矢'});await expect(first).toHaveCSS('height','28px');
 const grid=page.locator('.spell-library .spell-stock-grid').first();expect((await grid.evaluate(e=>getComputedStyle(e).gridTemplateColumns)).split(' ').length).toBe(5);expect((await page.locator('.prepared-slots').evaluate(e=>getComputedStyle(e).gridTemplateColumns)).split(' ').length).toBe(5);
 await first.hover();await expect(page.locator('.entry-detail')).toContainText('星光矢');await first.click();await expect(page.locator('.prepared-cell .spell-stock-tile')).toContainText('星光矢');await expect(page.locator('.spell-stock-tile').filter({hasText:'星光矢'})).toHaveCount(1);
 await page.locator('.prepared-cell .spell-stock-tile').click();await expect(first).toBeVisible();await first.dragTo(page.getByRole('button',{name:'预备空位3',exact:true}));await expect(page.locator('[data-prepared-slot="2"] .spell-stock-tile')).toContainText('星光矢');await page.locator('.prepared-cell .spell-stock-tile').click();await first.click({button:'right'});await expect(page.getByRole('menu',{name:'法术操作'})).toBeVisible();await expect(page.locator('.tooltip-backdrop')).toHaveCount(0);await page.getByRole('menuitem',{name:'预备法术',exact:true}).click();await expect(page.locator('.prepared-cell .spell-stock-tile')).toHaveCount(1);
 await page.mouse.move(2,2);await page.screenshot({path:'F:/CodexWork/2026-09-20/w-xu/spells179-wizard.png'});
 await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(page.locator('.prepared-cell .spell-stock-tile')).toHaveCount(1);await expect(page.locator('.spell-stock-tile').filter({hasText:'星光矢'})).toHaveCount(1);
 await page.getByRole('button',{name:'卡片全屏',exact:true}).click();const compact=page.locator('.prepared-cell .spell-stock-tile');await compact.hover();await expect(page.getByRole('tooltip')).toBeVisible();await compact.click({button:'right'});await expect(page.getByRole('menu',{name:'法术操作'})).toBeVisible();await expect(page.locator('.tooltip-backdrop')).toHaveCount(0);
});

test('2024 level-change caster has no preparation panel unless the player explicitly overrides it',async({page})=>{
 const c=newCharacter();add(c,entry('class','吟游测试',{casterProgression:'full',preparedSpellsProgression:[4,5,6],preparedSpellsChange:'level'}));add(c,entry('spell','诗歌',{level:1}));await load(page,c);await expect(page.locator('.prepared-cell')).toHaveCount(0);await expect(page.locator('.spell-library .spell-stock-tile')).toHaveCount(1);
 await page.getByRole('switch',{name:'编辑模式'}).click();await page.getByRole('button',{name:'预备法术制',exact:true}).click();await expect(page.locator('.prepared-cell')).toBeVisible();await page.getByRole('button',{name:'跟随职业',exact:true}).click();await expect(page.locator('.prepared-cell')).toHaveCount(0);
});

test('daily full-list caster gets the eligible source list and can prepare without duplicating all spells into the card',async({page})=>{
 const c=newCharacter();c.name='全法表预备演示';add(c,entry('class','测试牧师',{casterProgression:'full',preparedSpellsProgression:[4,5,6],preparedSpellsChange:'restLong'}));
 await load(page,c,async()=>{
  const values=[{name:'一环祈祷',source:'XPHB',level:1,entries:['测试祈祷']},{name:'二环祈祷',source:'XPHB',level:2,entries:['测试祈祷']},{name:'高环祈祷',source:'XPHB',level:3,entries:['测试祈祷']}];
  await page.route('https://5e.kiwee.top/data/spells/spells-test.json',r=>r.fulfill({json:{spell:values}}));
  await page.route('https://5e.kiwee.top/data/generated/gendata-spell-source-lookup.json',r=>r.fulfill({json:{xphb:Object.fromEntries(values.map(v=>[v.name,{class:{XPHB:{测试牧师:true}}}]))}}));
 });
 await expect(page.locator('.spell-library')).toContainText('职业法术表');await expect(page.locator('.spell-library .spell-stock-tile')).toHaveCount(2);await page.locator('.spell-library .spell-stock-tile').filter({hasText:'一环祈祷'}).click();await expect(page.locator('.prepared-cell .spell-stock-tile')).toHaveCount(1);await expect(page.locator('.spell-library .spell-stock-tile')).toHaveCount(1);await page.locator('.prepared-cell .spell-stock-tile').click();await expect(page.locator('.spell-library .spell-stock-tile')).toHaveCount(2);
});

test('spell tiles double their height and retain a right-aligned tier through preparation and narrow layout',async({page})=>{
 const c=newCharacter();c.name='法术环阶显示';add(c,entry('class','测试法师',{casterProgression:'full',preparedSpellsChange:'restLong',preparedSpellsProgression:[4,5,6,7,8],spellsKnownProgressionFixed:[6,2,2,2,2]}),5);
 for(const [name,level] of [['星火',0],['很长很长名字的防护法术',1],['雾幕',1],['辉光',1],['寒潮',1],['结界',1],['三环星尘',3]] as const)add(c,entry('spell',name,{level}));
 await load(page,c);const tiles=page.locator('.spell-stock-tile'),long=tiles.filter({hasText:'很长很长名字'});await expect(long).toHaveCSS('height','28px');await expect(page.locator('.spell-stock-empty').first()).toHaveCSS('height','28px');await expect(tiles.filter({hasText:'星火'}).locator('.spell-stock-level')).toHaveText('0');await expect(long.locator('.spell-stock-level')).toHaveText('1');
 const grid=long.locator('..');expect((await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns)).split(' ').length).toBe(5);
 const checkName=async()=>{await expect(long.locator('.stock-name')).toHaveCSS('text-overflow','ellipsis');const space=await long.evaluate(el=>{const name=el.querySelector('.stock-name')!.getBoundingClientRect(),tier=el.querySelector('.spell-stock-level')!.getBoundingClientRect(),box=el.getBoundingClientRect();return {gap:tier.left-name.right,center:tier.y+tier.height/2-(box.y+box.height/2)};});expect(space.gap).toBeGreaterThanOrEqual(0);expect(Math.abs(space.center)).toBeLessThanOrEqual(1);};await checkName();
 await tiles.filter({hasText:'三环星尘'}).click();const prepared=page.locator('.prepared-cell .spell-stock-tile');await expect(prepared.locator('.spell-stock-level')).toHaveText('3');await expect(page.locator('.spell-tile-flight')).toHaveCount(0);await page.mouse.move(2,2);await page.screenshot({path:'F:/CodexWork/2026-09-20/w-xu/spells181-tier-wide.png'});
 await page.setViewportSize({width:420,height:1000});await expect(long).toHaveCSS('height','48px');await expect(prepared).toHaveCSS('height','48px');expect((await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns)).split(' ').length).toBe(5);await checkName();await expect(prepared.locator('.spell-stock-level')).toHaveText('3');await page.locator('.sheet-details').screenshot({path:'F:/CodexWork/2026-09-20/w-xu/spells181-tier-narrow.png'});
 await prepared.click();await expect(page.locator('.spell-library .spell-stock-tile').filter({hasText:'三环星尘'}).locator('.spell-stock-level')).toHaveText('3');await expect(page.locator('.spell-slots-cell')).toHaveCount(0);
});
