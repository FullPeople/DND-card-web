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
async function closeImportedCard(page:Page,name:string){
 // File.text() completes asynchronously; the import selects its card and reopens this dialog.
 await expect(page.locator('.character-tabs').getByRole('tab',{name:name+'（导入）'})).toHaveAttribute('aria-selected','true');
 const dialog=page.getByRole('dialog',{name:'导入与导出',exact:true});await dialog.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect(dialog).toHaveCount(0);
}
async function load(page:Page,c=card(),prepare?:()=>Promise<void>){
 await mockSource(page);await suppressAnnouncement(page);await prepare?.();await page.goto('/');await expect(page.getByRole('button',{name:'自动化设置'})).toBeVisible();
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'spells.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});await closeImportedCard(page,c.name);
 const editing=page.getByRole('switch',{name:'编辑模式',exact:true});if(await editing.getAttribute('aria-checked')!=='true')await editing.click();await page.getByRole('tab',{name:'法术',exact:true}).click();
}
async function drag(page:Page,from:Locator,to:Locator){
 // hover waits for a stable, visible source after deferred rendering/scaling.
 await from.hover();const a=await from.boundingBox();if(!a)throw Error('drag source missing');
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2+12,a.y+a.height/2,{steps:3});
 // A4 can put the destination outside the source viewport. Start the gesture
 // on the visible source before scrolling the destination into reach.
 await to.scrollIntoViewIfNeeded();const b=await to.boundingBox();if(!b)throw Error('drag target missing');
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:15});await page.mouse.up();
}

// Observe actual rendered motion over successive browser frames, including its destination.
async function recordMotion(page:Page){await page.evaluate(()=>{
 const state={flights:[] as {x:number;y:number}[],landings:[] as string[],reflows:[] as {id:string;x:number}[],dragTargets:[] as string[],stop:false};
 (window as any).spellMotion=state;
 const frame=()=>{if(state.stop)return;
  const flight=document.querySelector('.spell-tile-flight');if(flight){const r=flight.getBoundingClientRect();state.flights.push({x:r.x,y:r.y});}
  document.querySelectorAll<HTMLElement>('.spell-flight-arrival').forEach(el=>state.landings.push(el.dataset.spellId||''));
  document.querySelectorAll<HTMLElement>('.drag-landing-hidden').forEach(el=>state.dragTargets.push(el.dataset.spellId||''));
  document.querySelectorAll<HTMLElement>('[data-spell-id]').forEach(el=>{if(el.getAnimations().some(a=>a.id==='spell-reflow'))state.reflows.push({id:el.dataset.spellId!,x:el.getBoundingClientRect().x});});
  requestAnimationFrame(frame);
 };requestAnimationFrame(frame);
});}
async function motionResult(page:Page){await expect(page.locator('.spell-tile-flight,.pointer-ghost,.spell-flight-arrival,.drag-landing-hidden')).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>document.getAnimations().filter(a=>a.id==='spell-reflow').length)).toBe(0);return page.evaluate(()=>{const s=(window as any).spellMotion;s.stop=true;return s as {flights:{x:number;y:number}[];landings:string[];reflows:{id:string;x:number}[];dragTargets:string[]};});}

test('original spell height, cut frame, ritual wash and rotating concentration seal survive preparation and narrow layout',async({page})=>{
 const c=card(),ward=c.selections.find(s=>s.id==='Ward')!;Object.assign(ward.entry.raw,{meta:{ritual:true},duration:[{type:'timed',concentration:true}]});await load(page,c);
 const known=page.locator('.spell-library [data-spell-id="Ward"]'),gift=page.locator('.source-spell-row .spell-stock-tile'),cantrip=page.locator('[data-cantrip-group="Source Mage"] .spell-stock-tile').first();
 for(const tile of [known,gift,cantrip]){await expect(tile).toHaveCSS('height','28px');await expect(tile.locator('.spell-tile-frame')).toHaveAttribute('viewBox','0 0 100 28');await expect(tile.locator('.spell-tile-frame')).toBeVisible();}
 await expect(known.locator('svg.spell-concentration-mark')).toHaveCount(1);await expect(known.locator('.spell-concentration-mark')).toHaveCSS('animation-name','spell-concentration-turn');await expect(known).toHaveCSS('background-image',/linear-gradient/);
 await known.click();const prepared=page.locator('.ordinary-prepared-group [data-spell-id="Ward"]');await expect(prepared).toBeVisible();await expect(known).toContainText('已预备');
 for(const tile of [known,prepared,gift]){await expect(tile).toHaveCSS('height','28px');await tile.hover();await expect(tile).toHaveCSS('background-image',/linear-gradient/);}
 await page.mouse.move(1200,40);await page.screenshot({path:test.info().outputPath('spell-style-desktop.png')});await page.locator('.paper').screenshot({path:test.info().outputPath('spell-style-card.png')});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('.sheet-viewport')).toHaveAttribute('data-sheet-display','a4');for(const tile of [known,prepared,gift,cantrip])await expect(tile).toHaveCSS('height','28px');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:test.info().outputPath('spell-style-mobile.png'),fullPage:true});await known.scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('spell-style-mobile-selected.png')});
});

test('known spells press in place and toggle a prepared copy, including cantrips, without flight or reflow',async({page})=>{
 await load(page);const known=page.locator('.spell-library [data-spell-id="Ward"]'),prepared=page.locator('.ordinary-prepared-group [data-spell-id="Ward"]'),gift=page.locator('.source-spell-row');
 // The page is loaded on demand. Snapshot the mounted library, not the empty
 // interval between selecting its tab and completing the deferred module.
 await expect(known).toBeVisible();
 const positions=()=>page.locator('.spell-library .spell-stock-tile').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {id:(el as HTMLElement).dataset.spellId,x:r.x,y:r.y,w:r.width,h:r.height};}));
 const before=await positions();await recordMotion(page);await known.click();await expect(prepared).toBeVisible();await expect(known).toHaveAttribute('aria-pressed','true');await expect(known).toHaveCSS('box-shadow',/inset/);await expect(known.locator('.spell-ready-mark')).toContainText('已预备');expect(await positions()).toEqual(before);
 await known.click();await expect(prepared).toHaveCount(0);await expect(known).toHaveAttribute('aria-pressed','false');await expect(known.locator('.spell-ready-mark')).toHaveCount(0);await expect(gift).toContainText('免费 1/1');expect(await positions()).toEqual(before);
 const spark=page.locator('.spell-library [data-spell-id="Spark"]'),group=page.locator('[data-cantrip-group="Source Mage"]');await expect(spark).toHaveAttribute('aria-pressed','true');await spark.click();await expect(spark).toHaveAttribute('aria-pressed','false');await expect(group.locator('[data-spell-id="Spark"]')).toHaveCount(0);
 await spark.click();await expect(spark).toHaveAttribute('aria-pressed','true');await expect(group.locator('[data-spell-id="Spark"]')).toHaveCount(1);expect(await positions()).toEqual(before);
 const motion=await motionResult(page);expect(motion.flights).toEqual([]);expect(motion.reflows).toEqual([]);expect(motion.landings).toEqual([]);
 await known.click();await expect(prepared).toHaveCount(1);await prepared.click();await expect(known).toHaveAttribute('aria-pressed','false');await expect(known).toBeVisible();
 await known.click();await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(known).toHaveAttribute('aria-pressed','true');await expect(prepared).toHaveCount(1);await expect(spark).toHaveAttribute('aria-pressed','true');
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await known.click();await expect(known).toHaveAttribute('aria-pressed','true');await expect(prepared).toHaveCount(1);await expect(page.locator('.detail-title')).toContainText('护盾示例');
});

test('reduced motion preserves spell choices without flight remnants or hidden cards',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await load(page);await recordMotion(page);const known=page.locator('.spell-library [data-spell-id="Ward"]'),prepared=page.locator('.ordinary-prepared-group [data-spell-id="Ward"]');await known.click();await expect(prepared).toBeVisible();
 await drag(page,prepared,page.locator('.spell-library .cell-heading'));await expect(prepared).toHaveCount(0);await expect(known).toBeVisible();const motion=await motionResult(page);expect(motion.flights).toEqual([]);expect(motion.reflows).toEqual([]);await expect(page.locator('.drag-lifted')).toHaveCount(0);
});

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

test('explicit class cantrip adjustment persists and lowering the limit retains recorded choices',async({page})=>{
 await load(page);const group=page.locator('[data-cantrip-group="Source Mage"]'),input=page.getByLabel('验收法师所学戏法数量调整',{exact:true});
 expect((await group.locator('label').boundingBox())!.height).toBeLessThan(35);
 await expect(input).toHaveValue('0');await input.fill('1');await input.press('Enter');await page.locator('.spell-library').getByRole('button',{name:'小雾团',exact:true}).click();
 await expect(group.locator('[data-spell-id]')).toHaveCount(3);await expect(group.locator('h4')).toContainText('3 / 3');
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(input).toHaveValue('1');await expect(group.locator('[data-spell-id]')).toHaveCount(3);
 await input.fill('-1');await input.press('Enter');await expect(group.locator('h4')).toContainText('3 / 1');await expect(group.locator('.spell-overflow summary')).toContainText('2 项已保留原记录');await expect(group.locator('[data-spell-id]')).toHaveCount(1);await expect(page.locator('.ordinary-prepared-group h4')).toContainText('0 / 2');
});
test('a declared feat grants its cantrip after a real Wiki drop even when class cantrips are full',async({page})=>{
 await load(page,card(),async()=>{await page.route('**/data/feats.json',route=>route.fulfill({json:{feat:[{name:'明确赠送验收专长',ENG_name:'Declared Gift',source:'XPHB',additionalSpells:[{known:{'_':['Mist|XPHB#c']}}],entries:['原创资料，明确赠送引用仅用于软件验收。']}]},headers:{'access-control-allow-origin':'*',etag:'declared-gift'}}));});
 const ordinary=page.locator('[data-cantrip-group="Source Mage"]');await expect(ordinary.locator('[data-spell-id]')).toHaveCount(2);
 await page.getByRole('tab',{name:'主要',exact:true}).click();await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'专长',exact:true}).click();
 const feat=page.locator('.catalog-row').filter({hasText:'明确赠送验收专长'});await expect(feat).toBeVisible();await drag(page,feat,page.locator('.heritage-features'));
 await page.getByRole('tab',{name:'法术',exact:true}).click();const gift=page.locator('.source-spell-group').filter({hasText:'来自明确赠送验收专长'});
 await expect(gift.getByRole('button',{name:'小雾团',exact:true})).toBeVisible();await expect(ordinary.locator('[data-spell-id]')).toHaveCount(2);await expect(page.locator('.ordinary-prepared-group h4')).toContainText('0 / 2');
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(gift.getByRole('button',{name:'小雾团',exact:true})).toBeVisible();await expect(ordinary.locator('[data-spell-id]')).toHaveCount(2);
 await page.getByRole('tab',{name:'主要',exact:true}).click();await drag(page,page.locator('.catalog-row').filter({hasText:'明确赠送验收专长'}),page.locator('.heritage-features'));await expect(page.locator('.suite-toast')).toContainText('已经在角色卡中');
 await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(gift.locator('.spell-grant-tile')).toHaveCount(1);await page.screenshot({path:test.info().outputPath('declared-feat-cantrip-full.png')});
});
test('full class cantrips accept an explicitly recorded feat gift separately across reload, deletion and duplicate drops',async({page})=>{
 const c=card();c.selections.push(row(e('gift-feat','选学专长','feat',{})));await load(page,c);
 await page.getByLabel('赠送法术来源',{exact:true}).selectOption('gift-feat',{timeout:5000});
 await expect(page.getByLabel('来源法术上限调整',{exact:true})).toHaveValue('0');
 await page.getByLabel('来源法术上限调整',{exact:true}).fill('1');await page.getByLabel('来源法术上限调整',{exact:true}).press('Enter');
 const group=page.locator('[data-source-cantrip-group="gift-feat"]'),ordinary=page.locator('[data-cantrip-group="Source Mage"]');
 const library=page.locator('.spell-library'),mist=library.getByRole('button',{name:'小雾团',exact:true});
 await drag(page,mist,group);await expect(group.locator('.spell-grant-tile')).toHaveCount(1);await expect(ordinary.locator('[data-spell-id]')).toHaveCount(2);
 await drag(page,mist,group);await expect(group.locator('.spell-grant-tile')).toHaveCount(1);
 await expect(page.locator('.ordinary-prepared-group h4')).toContainText('0 / 2');
 await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();
 await expect(group.locator('.spell-grant-tile')).toHaveCount(1);await expect(ordinary.locator('[data-spell-id]')).toHaveCount(2);
 await group.getByRole('button',{name:'小雾团',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'从角色卡移除',exact:true}).click();
 await expect(group.locator('.spell-grant-tile')).toHaveCount(0);await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(group.locator('.spell-grant-tile')).toHaveCount(0);
 await drag(page,library.getByRole('button',{name:'小雾团',exact:true}),group);await expect(group.locator('.spell-grant-tile')).toHaveCount(1);
 await drag(page,library.getByRole('button',{name:'小火花',exact:true}),group);await expect(page.locator('.suite-toast')).toContainText('赠送法术数量已满');await expect(group.locator('.spell-grant-tile')).toHaveCount(1);
 await expect(page.locator('.spell-tile-flight,.entry-drag-ghost,.drag-lifted,.drag-landing-hidden')).toHaveCount(0);await page.screenshot({path:test.info().outputPath('feat-cantrip-separate.png')});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await group.scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('feat-cantrip-separate-mobile.png'),fullPage:true});
});
test('an unlearned cantrip from the loaded class list can fill a slot without granting the entire catalog',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);
 const catalogSpell={name:'目录星火',ENG_name:'Catalog Spark',source:'XPHB',level:0,school:'V',classes:{fromClassList:[{name:'Source Mage',source:'XPHB'}]},entries:['原创目录验收戏法。']};
 await page.route('**/data/spells/spells-test.json',route=>route.fulfill({json:{spell:[catalogSpell]},headers:{'access-control-allow-origin':'*'}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'自动化设置'})).toBeVisible();
 const c=card();c.spellSettings!.cantrips={'Source Mage':['','Frost']};await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'catalog.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});await closeImportedCard(page,c.name);
 const editing=page.getByRole('switch',{name:'编辑模式',exact:true});if(await editing.getAttribute('aria-checked')!=='true')await editing.click();await page.getByRole('tab',{name:'法术',exact:true}).click();
 await page.locator('.wiki-pane').getByRole('button',{name:'法术',exact:true}).click();
 const known=page.locator('.spell-library').getByRole('button',{name:'目录星火',exact:true});await expect(known).toBeVisible();await page.getByRole('button',{name:'验收法师戏法空位1',exact:true}).click();await known.click();
 await expect(page.locator('[data-cantrip-group="Source Mage"]')).toContainText('目录星火');await expect(known).toContainText('已选');await expect(page.locator('.ordinary-prepared-group .stock-empty')).toHaveCount(2);
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(page.locator('[data-cantrip-group="Source Mage"]')).toContainText('目录星火');
});
