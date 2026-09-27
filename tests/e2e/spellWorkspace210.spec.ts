import {test,expect,type Page,type Locator} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Entry} from '../../src/core/model';
import {spellState} from '../../src/core/characterDetails';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';

const e=(id:string,name:string,kind:Entry['kind'],raw:Entry['raw']):Entry=>({id,name,english:id,kind,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:['原创法术页验收资料。'],raw});
const spell=(id:string,name:string,level:number)=>e(id,name,'spell',{level,school:'A',_spellClasses:{XPHB:{'Source Mage':true}}});
const row=(entry:Entry)=>({id:entry.id,entry,level:1,quantity:1,equipped:false});
function card(){const c=newCharacter();c.name='法师法术布局验收';c.automation=newAutomationState();
 c.selections=[row(e('Source Mage','验收法师','class',{casterProgression:'full',spellcastingAbility:'int',cantripProgression:[2],preparedSpellsProgression:[2],spellsKnownProgressionFixed:[6]})),row(spell('Spark','小火花',0)),row(spell('Frost','小冰晶',0)),row(spell('Mist','小雾团',0)),row(spell('Ward','护盾示例',1)),row(spell('Step','闪步示例',1)),row(spell('Beam','光束示例',1)),row(e('Gift Race','验收提夫林','race',{additionalSpells:[{ability:'cha',innate:{'_':{daily:{'1':['Ward|XPHB']}}}}]}))];
 c.spellSettings={...spellState(c),cantrips:{'Source Mage':['Spark','Frost']}};return c;
}
async function load(page:Page,c=card()){
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await expect(page.getByRole('button',{name:'自动化设置'})).toBeVisible();
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'spells.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});await page.keyboard.press('Escape');
 const editing=page.getByRole('switch',{name:'编辑模式',exact:true});if(await editing.getAttribute('aria-checked')!=='true')await editing.click();await page.getByRole('tab',{name:'法术',exact:true}).click();
}
async function drag(page:Page,from:Locator,to:Locator){await from.scrollIntoViewIfNeeded();await to.scrollIntoViewIfNeeded();const a=await from.boundingBox(),b=await to.boundingBox();if(!a||!b)throw Error('drag target missing');await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2+12,a.y+a.height/2,{steps:3});await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:15});await page.mouse.up();}

test('wizard spells share one prepared area with independent cantrip, gift and normal slots; real drags and reload agree with overview',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await load(page);
 await expect(page.locator('.prepared-cell .cell-heading')).toContainText('预备法术');await expect(page.locator('.spell-library .cell-heading')).toContainText('已知法术');await expect(page.getByRole('heading',{name:'固定 / 次数法术'})).toHaveCount(0);
 const known=page.locator('.spell-library'),ordinary=page.locator('.ordinary-prepared-group'),cantrips=page.locator('[data-cantrip-group="Source Mage"]'),gift=page.locator('.source-spell-group');
 await expect(cantrips.locator('.spell-stock-tile')).toHaveCount(2);await expect(gift).toContainText('来自验收提夫林');await expect(gift).toContainText('免费 1/1 · 长休');await expect(ordinary.locator('.stock-empty')).toHaveCount(2);
 // The same UID already exists as a gifted spell. Its ordinary copy must still prepare.
 await drag(page,known.locator('[data-entry-id="Ward"]'),ordinary.locator('[data-prepared-slot="0"]'));await expect(ordinary).toContainText('护盾示例');await expect(known.locator('[data-entry-id="Ward"]')).toContainText('已预备');
 await known.locator('[data-entry-id="Step"]').click();await expect(ordinary.locator('.spell-stock-tile')).toHaveCount(2);await expect(gift).toContainText('免费 1/1');
 // Explicitly dropping onto a filled slot replaces it at full capacity.
 await drag(page,known.locator('[data-entry-id="Beam"]'),ordinary.locator('[data-prepared-slot="0"]'));await expect(ordinary).toContainText('光束示例');await expect(ordinary).not.toContainText('护盾示例');await expect(known.locator('[data-entry-id="Ward"]')).not.toContainText('已预备');
 await drag(page,known.locator('[data-entry-id="Mist"]'),cantrips.locator('[data-spell-index="0"]'));await expect(cantrips).toContainText('小雾团');await expect(cantrips).not.toContainText('小火花');await expect(ordinary.locator('.spell-stock-tile')).toHaveCount(2);
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(cantrips).toContainText('小火花');await page.getByRole('button',{name:'重做',exact:true}).click();await expect(cantrips).toContainText('小雾团');
 await gift.getByRole('button',{name:'护盾示例施放详情'}).click();await page.getByRole('dialog',{name:'护盾示例施放详情'}).getByRole('button',{name:'使用',exact:true}).click();await page.keyboard.press('Escape');await expect(gift).toContainText('免费 0/1');
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.screenshot({path:test.info().outputPath('spell-workspace-desktop.png')});await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(cantrips).toContainText('小雾团');await expect(gift).toContainText('免费 0/1');await expect(ordinary).toContainText('光束示例');
 await page.getByRole('tab',{name:'主要',exact:true}).click();await expect(page.locator('.overview-spells')).toContainText('小雾团');await expect(page.locator('.overview-spells')).not.toContainText('小火花');await expect(page.locator('.overview-spells')).toContainText('护盾示例');expect(errors).toEqual([]);
});

test('a learned caster has no known-library panel and retains separate cantrip and gifted spell display on narrow screens',async({page})=>{
 const c=card();c.name='术士法术布局验收';c.selections[0].entry.raw={casterProgression:'full',spellcastingAbility:'cha',cantripProgression:[2],spellsKnownProgression:[4]};c.spellSettings=undefined;
 await page.setViewportSize({width:390,height:844});await load(page,c);await expect(page.locator('.spell-library')).toHaveCount(0);await expect(page.locator('.prepared-cell')).toContainText('来自验收提夫林');await expect(page.locator('.prepared-cell')).toContainText('职业法术');await expect(page.getByRole('button',{name:'职业法术空位1'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:test.info().outputPath('spell-workspace-mobile.png'),fullPage:true});
});

test('an unlearned cantrip from the loaded class list can fill a slot without granting the entire catalog',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);
 const catalogSpell={name:'目录星火',ENG_name:'Catalog Spark',source:'XPHB',level:0,school:'V',classes:{fromClassList:[{name:'Source Mage',source:'XPHB'}]},entries:['原创目录验收戏法。']};
 await page.route('**/data/spells/spells-test.json',route=>route.fulfill({json:{spell:[catalogSpell]},headers:{'access-control-allow-origin':'*'}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'自动化设置'})).toBeVisible();
 const c=card();c.spellSettings!.cantrips={'Source Mage':['','Frost']};await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'catalog.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});await page.keyboard.press('Escape');
 const editing=page.getByRole('switch',{name:'编辑模式',exact:true});if(await editing.getAttribute('aria-checked')!=='true')await editing.click();await page.getByRole('tab',{name:'法术',exact:true}).click();
 await page.locator('.wiki-pane').getByRole('button',{name:'法术',exact:true}).click();
 const known=page.locator('.spell-library').getByRole('button',{name:'目录星火',exact:true});await expect(known).toBeVisible();await page.getByRole('button',{name:'验收法师戏法空位1',exact:true}).click();await known.click();
 await expect(page.locator('[data-cantrip-group="Source Mage"]')).toContainText('目录星火');await expect(known).toContainText('已选');await expect(page.locator('.ordinary-prepared-group .stock-empty')).toHaveCount(2);
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(page.locator('[data-cantrip-group="Source Mage"]')).toContainText('目录星火');
});
