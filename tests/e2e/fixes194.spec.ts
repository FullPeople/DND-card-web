import {test,expect,type Page} from '@playwright/test';
import {mockSource,fillFromDetail} from './fixtures';
import {newCharacter,type Character,type Entry} from '../../src/core/model';
import {exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
const entry=(kind:Entry['kind'],name:string,raw:Entry['raw']={}):Entry=>({id:`check:${kind}:${name}`,kind,name,english:name,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',raw,entries:['验收用条目正文']});
const add=(c:Character,e:Entry,level=1)=>c.selections.push({id:e.id,entry:e,quantity:1,level,equipped:false});
async function start(page:Page){await mockSource(page);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();}
async function upload(page:Page,c:Character){await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'check.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});}
test('prepare/remove reflects immediately on main page, survives reload, always includes cantrips',async({page})=>{
 await start(page);const c=newCharacter();c.name='法术即时显示';add(c,entry('class','测试书法师',{hd:{faces:6},casterProgression:'full',spellcastingAbility:'int',preparedSpellsProgression:[4,5,6],preparedSpellsChange:'restLong',spellsKnownProgressionFixed:[6,2,2]}),3);
 add(c,entry('spell','星光矢',{level:1}));add(c,entry('spell','微弱光芒',{level:0}));await upload(page,c);await page.getByRole('button',{name:'关闭弹窗'}).click();
 await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(page.locator('.prepared-cell')).toBeVisible();await page.locator('.spell-library .spell-stock-tile').filter({hasText:'星光矢'}).click();
 await page.getByRole('tab',{name:'主要',exact:true}).click();await expect(page.locator('.overview-spells')).toContainText('已预备法术');await expect(page.locator('.overview-spells')).toContainText('星光矢');await expect(page.locator('.overview-spells')).toContainText('微弱光芒');
 await page.getByRole('tab',{name:'法术',exact:true}).click();await page.locator('.prepared-cell .spell-stock-tile').click();await page.getByRole('tab',{name:'主要',exact:true}).click();await expect(page.locator('.overview-spells')).not.toContainText('星光矢');await expect(page.locator('.overview-spells')).toContainText('微弱光芒');
 await page.reload();await expect(page.locator('.overview-spells')).not.toContainText('星光矢');await expect(page.locator('.overview-spells')).toContainText('微弱光芒');
});
test('personal text authoring, high-level class editing and rolled HP all persist',async({page})=>{
 await start(page);await page.getByRole('switch',{name:'编辑模式'}).click();await page.getByRole('button',{name:'条目 / 等级',exact:true}).click();
 await page.getByLabel('卡内条目类型',{exact:true}).selectOption('class');await page.getByLabel('卡内条目名称').fill('星海守望者');await page.getByLabel('自定义职业等级').fill('12');await page.getByLabel('卡内条目正文').fill('星海守望者的自定义职业描述。');await page.getByRole('button',{name:'加入角色卡',exact:true}).click();
 await expect(page.getByLabel('星海守望者目标等级')).toHaveValue('12');await page.getByLabel('卡内条目类型').selectOption('feature');await page.getByLabel('卡内条目名称').fill('星海庇佑');await page.getByLabel('卡内条目正文').fill('每日记下一个见闻。');await page.getByLabel('自定义条目归属').selectOption({label:'星海守望者'});await page.getByRole('button',{name:'加入角色卡',exact:true}).click();
 await page.screenshot({path:test.info().outputPath('194-personal-entries.png')});await page.getByRole('button',{name:'关闭弹窗'}).click();await expect(page.locator('.class-features')).toContainText('星海庇佑');
 await page.getByRole('button',{name:'设置生命值取值方式'}).click();await page.getByRole('button',{name:'逐级骰值',exact:true}).click();await page.getByLabel('星海守望者2级生命骰结果').fill('2');await page.getByLabel('星海守望者3级生命骰结果').click();await expect(page.getByLabel('星海守望者2级生命骰结果')).toHaveValue('2');await page.screenshot({path:test.info().outputPath('194-hp-editor.png')});
 await page.getByRole('button',{name:'关闭弹窗'}).click();await page.reload();await expect(page.locator('.identity-class')).toContainText('星海守望者');await expect(page.locator('.class-features')).toContainText('星海庇佑');
});
test('category search is independent from global search and other categories',async({page})=>{
 await start(page);const query=page.getByRole('searchbox',{name:'职业分类搜索'});await query.fill('不存在的职业');await expect(page.locator('.catalog-row')).toHaveCount(0);
 await page.locator('.category-tabs').getByRole('button',{name:'法术',exact:true}).click();await page.getByRole('searchbox',{name:'法术分类搜索'}).fill('微光');await page.locator('.category-tabs').getByRole('button',{name:'职业',exact:true}).click();await expect(query).toHaveValue('不存在的职业');
 await page.reload();await expect(query).toHaveValue('不存在的职业');await query.fill('测试法师');await expect(page.locator('.catalog-row')).toHaveCount(1);
});
test('version conflict requires review before creating a copy; cancel leaves book intact',async({page})=>{
 await start(page);const c=newCharacter('2014');c.name='旧版八级';const cls=entry('class','旧版职业',{hd:{faces:6}});cls.source='PHB';cls.edition='2014';add(c,cls,8);await upload(page,c);
 await expect(page.getByRole('heading',{name:'导入前核对'})).toBeVisible();await expect(page.getByText('导入后保留该角色自己的规则版本。',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'取消导入',exact:true}).click();await page.getByRole('button',{name:'关闭弹窗'}).click();await expect(page.getByRole('button',{name:/角色簿/})).toContainText('1');
 await upload(page,c);await page.getByRole('button',{name:'保留全部记录并导入'}).click();await page.getByRole('button',{name:'关闭弹窗'}).click();await expect(page.locator('.identity-class')).toContainText('旧版职业');await expect(page.getByRole('button',{name:/角色簿/})).toContainText('2');
});
test('subclass fill link opens subclasses instead of the main class body',async({page})=>{
 await start(page);await page.getByRole('switch',{name:'编辑模式'}).click();await page.locator('.catalog-row').first().click();await fillFromDetail(page);
 await page.locator('.identity-subclass').getByRole('button',{name:'点击并拖拽填写'}).click();await expect(page.getByRole('button',{name:'子职',exact:true})).toHaveAttribute('aria-expanded','true');await expect(page.locator('.entry-detail')).toContainText('测试学派');
});

test('legacy import with no prepared spells recovers its source-declared spellbook and preparation capacity',async({page})=>{
 await mockSource(page);await page.route('https://5e.kiwee.top/data/class/class-test.json',route=>route.fulfill({json:{class:[{name:'测试书法师',source:'XPHB',hd:{faces:6},casterProgression:'full',spellcastingAbility:'int',preparedSpellsProgression:[4,5,6],preparedSpellsChange:'restLong',spellsKnownProgressionFixed:[6,2,2]}]}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 const original=newCharacter();add(original,entry('class','测试书法师',{hd:{faces:6}}),3);add(original,entry('spell','书中法术',{level:1}));
 await page.getByLabel('枭熊 JSON 文本').fill(JSON.stringify(exportOwlbear(original,evaluate(original))));await page.getByRole('button',{name:'从文本导入枭熊'}).click();await page.getByRole('button',{name:'关闭弹窗'}).click();await page.getByRole('tab',{name:'法术',exact:true}).click();
 await expect(page.locator('.prepared-cell')).toContainText('0 / 6');await page.locator('.spell-library .spell-stock-tile').filter({hasText:'书中法术'}).click();await expect(page.locator('.prepared-cell')).toContainText('1 / 6');await expect(page.locator('.prepared-cell')).toContainText('书中法术');
});
test('quickref cover label renders correctly in an actual reading pane',async({page})=>{
 await start(page);const c=newCharacter(),f=entry('feature','方块特质');f.entries=['在内部可以被看到，但仍处于{@quickref 掩护||3||全身掩护}状态。'];add(c,f);await upload(page,c);await page.getByRole('button',{name:'关闭弹窗'}).click();await page.locator('.class-features .feature-bubble').hover();await expect(page.locator('.entry-detail')).toContainText('全身掩护');await expect(page.locator('.entry-detail')).not.toContainText('3状态');
});
test('mounted main spell box follows remote preparation changes without local save writes',async({page,baseURL})=>{
 await mockSource(page);await page.goto(baseURL+'/#suite=spell194&bridge='+encodeURIComponent(new URL(baseURL!).origin));await expect(page.locator('.app-shell')).toBeVisible();
 await page.evaluate(()=>{(window as any).writes=[];window.addEventListener('message',e=>{if(['save','stats','resource'].includes(e.data?.type))(window as any).writes.push(e.data);});});
 const c=newCharacter();c.name='远端预备更新';add(c,entry('class','测试书法师',{hd:{faces:6},casterProgression:'full',spellcastingAbility:'int',preparedSpellsProgression:[4,5,6],preparedSpellsChange:'restLong',spellsKnownProgressionFixed:[6,2,2]}),3);add(c,entry('spell','同步预备术',{level:1}));
 c.spellSettings={mode:'prepared',ability:'int',capacity:6,capacityAdjustment:0,attackBonus:0,dcBonus:0,prepared:[],slots:{}};
 const send=async(revision:number,prepared:string[])=>{const native=structuredClone(c);native.spellSettings!.prepared=prepared;const document={...exportOwlbear(native,evaluate(native)),dnd_card_web:native,_suiteRevision:revision};await page.evaluate(({document,revision})=>{const state={key:'room:card:one',itemId:'card:one',cardId:'one',kind:'character',name:document.dnd_card_web.name,role:'PLAYER',write:true,documentRevision:revision,stats:{},resources:[],conditions:[]},emit=(type:string,payload:any)=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session:'spell194',hostStarted:194,type,...payload}}));emit('ready',{});emit('catalog',{sequence:revision*2,role:'PLAYER',cards:[{...state,id:'one',inScene:true,locked:false}],enabled:{},visibility:{wiki:true,monsters:true}});emit('selection',{sequence:revision*2+1,state,document});emit('navigate',{});},{document,revision});};
 await send(1,[]);await expect(page.getByRole('tab',{name:'远端预备更新',exact:true})).toBeVisible();await page.getByRole('tab',{name:'远端预备更新',exact:true}).click();await expect(page.locator('.overview-spells')).not.toContainText('同步预备术');await send(2,['check:spell:同步预备术']);await expect(page.locator('.overview-spells')).toContainText('同步预备术');await send(3,[]);await expect(page.locator('.overview-spells')).not.toContainText('同步预备术');expect(await page.evaluate(()=>(window as any).writes.length)).toBe(0);
});
