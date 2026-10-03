import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {installCardAutomation,installBrowserAutomation} from './automationFixtures';
import {normalizeData} from '../../src/data/catalog';
import {newCharacter,type Character,type Entry} from '../../src/core/model';
const entry=(kind:Entry['kind'],name:string,raw:Entry['raw']={}):Entry=>({id:`test:${kind}:${encodeURIComponent(name)}`,kind,name,english:name,source:'XPHB',edition:'2024',packId:'test',revision:'1',raw,entries:['用于验证的法术正文。']});
const add=(c:Character,e:Entry,level=3)=>c.selections.push({id:e.id,entry:e,quantity:1,level,equipped:false});
async function load(page:Page,c:Character,setup?:()=>Promise<unknown>){await mockSource(page);await suppressAnnouncement(page);await setup?.();await installCardAutomation(page,c,[],false);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗'}).click();await page.getByRole('tab',{name:'法术',exact:true}).click();}

test('prepared spell remains marked in the known list, context menus and fullscreen previews still work',async({page})=>{
 const c=newCharacter();add(c,entry('class','测试法师',{casterProgression:'full',spellcastingAbility:'int',preparedSpellsProgression:[4,5,6],spellsKnownProgressionFixed:[6,2,2]}));add(c,entry('spell','星光矢',{level:1}));
 await load(page,c);const known=page.locator('.spell-library .spell-stock-tile'),prepared=page.locator('.ordinary-prepared-group .spell-stock-tile');
 await expect(page.locator('.spell-slots-cell')).toHaveCount(0);await known.click();await expect(prepared).toHaveCount(0);await expect(page.locator('.detail-title')).toContainText('星光矢');
 await page.getByRole('switch',{name:'编辑模式'}).click();await known.click();await expect(prepared).toContainText('星光矢');await expect(known).toContainText('已预备');await prepared.click();await expect(known).not.toContainText('已预备');
 await known.dragTo(page.getByRole('button',{name:'预备空位3',exact:true}));await expect(page.locator('[data-prepared-slot="2"] .spell-stock-tile')).toContainText('星光矢');await prepared.click();await known.click({button:'right'});await page.getByRole('menuitem',{name:'放入预备栏',exact:true}).click();await expect(prepared).toHaveCount(1);
 await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(prepared).toHaveCount(1);await expect(known).toContainText('已预备');
 await page.getByRole('button',{name:'卡片全屏',exact:true}).click();await prepared.hover();await expect(page.getByRole('tooltip')).toBeVisible();await prepared.click({button:'right'});await expect(page.getByRole('menu',{name:'法术操作'})).toBeVisible();await expect(page.locator('.tooltip-backdrop')).toHaveCount(0);
});

test('a level-change caster uses the prepared display without a known library, with an explicit manual daily override',async({page})=>{
 const c=newCharacter();add(c,entry('class','吟游测试',{casterProgression:'full',preparedSpellsProgression:[4,5,6],preparedSpellsChange:'level'}));add(c,entry('spell','诗歌',{level:1}));await load(page,c);
 await expect(page.locator('.prepared-cell')).toContainText('诗歌');await expect(page.locator('.spell-library')).toHaveCount(0);
 await page.getByRole('switch',{name:'编辑模式'}).click();await page.getByRole('button',{name:'每日预备',exact:true}).click();await expect(page.locator('.spell-library')).toBeVisible();await page.getByRole('button',{name:'跟随职业',exact:true}).click();await expect(page.locator('.spell-library')).toHaveCount(0);await expect(page.locator('.prepared-cell')).toContainText('诗歌');
});

test('daily full-list caster shows eligible known spells with preparation marks instead of hiding chosen ones',async({page})=>{
 const c=newCharacter();add(c,entry('class','测试牧师',{casterProgression:'full',cantripProgression:[3,3,3],preparedSpellsProgression:[4,5,6],preparedSpellsChange:'restLong'}));
 await load(page,c,async()=>{
  const values=[{name:'一环祈祷',source:'XPHB',level:1,entries:['测试祈祷']},{name:'二环祈祷',source:'XPHB',level:2,entries:['测试祈祷']},{name:'高环祈祷',source:'XPHB',level:3,entries:['测试祈祷']}];
  for(const value of values)Object.assign(value,{classes:{fromClassList:[{name:'测试牧师',source:'XPHB'}]}});
  await installBrowserAutomation(page,normalizeData({spell:values},'fixture-1'),false);
  await page.route('https://5e.kiwee.top/data/spells/spells-test.json',r=>r.fulfill({json:{spell:values}}));
  await page.route('https://5e.kiwee.top/data/generated/gendata-spell-source-lookup.json',r=>r.fulfill({json:{xphb:Object.fromEntries(values.map(v=>[v.name,{class:{XPHB:{测试牧师:true}}}]))}}));
 });
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'法术',exact:true}).click();await page.getByRole('switch',{name:'编辑模式'}).click();await expect(page.locator('.spell-library')).toContainText('已知法术');await expect(page.locator('.spell-library .spell-stock-tile')).toHaveCount(2);
 const known=page.locator('.spell-library .spell-stock-tile').filter({hasText:'一环祈祷'});await known.click();await expect(page.locator('.ordinary-prepared-group .spell-stock-tile')).toHaveCount(1);await expect(page.locator('.spell-library .spell-stock-tile')).toHaveCount(2);await expect(known).toContainText('已预备');await page.locator('.ordinary-prepared-group .spell-stock-tile').click();await expect(known).not.toContainText('已预备');
});

test('long spell names keep an independent tier and readable known/prepared states on narrow screens',async({page})=>{
 const c=newCharacter();add(c,entry('class','测试法师',{casterProgression:'full',preparedSpellsProgression:[4,5,6],spellsKnownProgressionFixed:[6,2,2]}));add(c,entry('spell','很长很长名字的防护法术',{level:1}));add(c,entry('spell','三环星尘',{level:3}));await load(page,c);
 const known=page.locator('.spell-library .spell-stock-tile'),long=known.filter({hasText:'很长很长名字'});await expect(long.locator('.spell-stock-level')).toHaveText('1');await expect(long.locator('.stock-name')).toHaveCSS('text-overflow','ellipsis');
 await page.getByRole('switch',{name:'编辑模式'}).click();await known.filter({hasText:'三环星尘'}).click();const prepared=page.locator('.ordinary-prepared-group .spell-stock-tile');await expect(prepared.locator('.spell-stock-level')).toHaveText('3');
 await page.setViewportSize({width:420,height:1000});await expect(long).toBeVisible();await expect(prepared).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await expect(known.filter({hasText:'三环星尘'})).toContainText('已预备');
 await prepared.click();await expect(known.filter({hasText:'三环星尘'})).not.toContainText('已预备');await expect(page.locator('.spell-slots-cell')).toHaveCount(0);
});
