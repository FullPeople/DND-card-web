import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter,exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
import {normalizeLegacyUpload} from '../../src/platform/legacyPlayerBridge';
import {ANNOUNCEMENT_KEY,announcementVersionFor} from '../../src/platform/announcement';

async function closeImportedCard(page:Page,name:string){
 // File.text() completes asynchronously; the import selects its card and reopens this dialog.
 await expect(page.locator('.character-tabs').getByRole('tab',{name:name+'（导入）'})).toHaveAttribute('aria-selected','true');
 const dialog=page.getByRole('dialog',{name:'导入与导出',exact:true});await dialog.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect(dialog).toHaveCount(0);
}
test('suite notice shows a collapsed red Owner explanation near the front and requires acknowledgement',async({page,baseURL})=>{
 await mockSource(page,{suiteAnnouncement:true});const url=new URL(baseURL!);url.hash='suite=notice197&bridge='+encodeURIComponent(url.origin);await page.goto(url.href);
 const dialog=page.getByRole('dialog',{name:'欢迎使用 Full Suite 枭熊工作台！'}),owner=dialog.locator('.announcement-owner');await expect(dialog).toBeVisible();expect(await owner.evaluate(e=>(e as HTMLDetailsElement).open)).toBe(false);
 await expect(owner.locator('summary')).toHaveText('关于设置玩家单独权限的重要说明');await expect(owner.locator('summary')).toHaveCSS('color','rgb(174, 39, 39)');await expect(dialog.getByRole('link',{name:'进入独立车卡网站',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
 await owner.locator('summary').click();await expect(owner).toContainText('Owner Only');await expect(owner.locator('img')).toHaveCount(3);await owner.locator('summary').click();await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'我知道了',exact:true}).click();expect(await page.evaluate(key=>localStorage.getItem(key+':suite'),ANNOUNCEMENT_KEY)).toBe(announcementVersionFor('suite'));await page.reload();await expect(dialog).toHaveCount(0);
});
test('starting sections precede growth; equipment inline references drag, remove and preserve book identity',async({page})=>{
 await mockSource(page);
 await page.route('**/data/class/class-test.json',route=>route.fulfill({json:{class:[{name:'验收职业',source:'XPHB',startingProficiencies:{skills:[{choose:{from:['animal handling','athletics'],count:1}}],weapons:['{@item 测试匕首|XPHB}','simple','martial'],armor:['light','shield'],armorProficiencies:[{light:true,shield:true}],tools:['vehicles (land)']},startingEquipment:{entries:['领取 {@item 测试匕首|XPHB}。']},classTableGroups:[{colLabels:['成长'],rows:[['入门']]}],entries:['后续职业正文。']}]}}));
 await page.route('**/data/items-base.json',route=>route.fulfill({json:{baseitem:[{name:'测试匕首',source:'XPHB',type:'M',weaponCategory:'simple',entries:['自制测试武器。']}]}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('switch',{name:'编辑模式'}).click();
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'职业',exact:true}).click();await page.locator('.catalog-row').filter({hasText:'验收职业'}).click();
 const detail=page.locator('.entry-detail');await expect(detail).toContainText('驯兽、运动');await expect(detail).toContainText('陆上载具');await expect(detail).not.toContainText('armorProficiencies');
 const headings=await detail.locator('.document-section>h4').allTextContents();expect(headings.slice(0,3).map(s=>s.trim())).toEqual(['起始熟练项','起始装备','职业成长表']);
 const dagger=detail.locator('.inline-reference').filter({hasText:'测试匕首'}).first(),weapons=page.locator('.training-row').filter({hasText:'武器'});
 await dagger.click({button:'right'});await expect(page.getByRole('menuitem',{name:'在 Wiki 中查看'})).toHaveCount(0);await expect(page.getByRole('menuitem',{name:'添加至角色卡'})).toBeVisible();await page.keyboard.press('Escape');
 await dagger.dragTo(weapons);await expect(weapons).toContainText('测试匕首');await page.reload();await expect(weapons).toContainText('测试匕首');
 await weapons.getByRole('button',{name:'测试匕首',exact:true}).click({button:'right'});await expect(page.getByRole('menuitem',{name:'添加至角色卡'})).toHaveCount(0);await page.getByRole('menuitem',{name:'移除',exact:true}).click();await expect(weapons).not.toContainText('测试匕首');
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'装备词条',exact:true}).click();await page.getByLabel('装备词条分类搜索').fill('盾牌');await page.locator('.catalog-row').filter({hasText:'盾牌'}).first().dragTo(page.locator('.training-row').filter({hasText:'护甲'}));await expect(page.locator('.training-row').filter({hasText:'护甲'})).toContainText('盾牌');
 await page.screenshot({path:test.info().outputPath('equipment-training.png')});
});
test('spell details end with separately identified classes and other learners',async({page})=>{
 await mockSource(page);await page.route('**/data/generated/gendata-spell-source-lookup.json',route=>route.fulfill({json:{xphb:{微光术:{class:{XPHB:{测试法师:true},PHB:{测试法师:true}},feat:{XPHB:{旅行笔记:true}}}}}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'法术',exact:true}).click();await page.locator('.catalog-row').filter({hasText:'微光术'}).click();
 const learners=page.locator('.entry-detail .spell-learners');await expect(learners).toContainText('谁能学');await expect(learners).toContainText('旅行笔记');await expect(learners.getByRole('button',{name:'测试法师',exact:true})).toHaveCount(2);expect(await learners.evaluate(el=>el===el.parentElement?.lastElementChild)).toBe(true);await page.screenshot({path:test.info().outputPath('spell-learners.png')});
 await learners.getByRole('button',{name:'旅行笔记',exact:true}).click();await expect(page.locator('.detail-title')).toContainText('旅行笔记');
});
test('one JSON control accepts native and legacy files and exports the selected card in the full format',async({page})=>{
 await mockSource(page);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 const native=newCharacter();native.name='统一完整备份';native.training={armor:'盾牌'};const old=newCharacter();old.name='旧枭熊文件';
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await expect(page.getByLabel('JSON格式')).toHaveCount(0);await expect(page.getByRole('button',{name:'导入枭熊 JSON'})).toHaveCount(0);
 for(const data of [exportCharacter(native),exportOwlbear(old,evaluate(old))])await page.getByTestId('character-file').setInputFiles({name:'character.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await page.getByLabel('导出角色').selectOption({label:'统一完整备份（导入）'});await page.getByRole('button',{name:'生成并复制 JSON'}).click();const result=JSON.parse(await page.getByLabel('角色 JSON 文本').inputValue());expect(result.format).toBe('dnd-card-web');expect(result.character.name).toBe('统一完整备份（导入）');expect(result.character.training.armor).toBe('盾牌');await page.screenshot({path:test.info().outputPath('unified-json.png')});
});

test('website weapon attacks stay visible and editable after Owlbear file roundtrip',async({page})=>{
 await mockSource(page);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 const c=newCharacter();c.name='武器往返验收';c.quickbarActions=[{id:'bow',name:'验收长弓',attack:'+7',damage:'1d8+4'}];
 const upload=normalizeLegacyUpload(exportCharacter(c));expect(upload.combat.weapons[0]).toMatchObject({attack_bonus:'+7',damage:'1d8+4'});
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 await page.getByTestId('character-file').setInputFiles({name:'owlbear-weapon.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(upload))});
 await closeImportedCard(page,c.name);
 const row=page.locator('.quick-weapon').filter({hasText:'验收长弓'});await expect(row).toHaveCount(1);await expect(row).toContainText('+7');await expect(row).toContainText('1d8+4');
 await page.reload();await expect(row).toHaveCount(1);await expect(row).toContainText('1d8+4');
 await page.screenshot({path:test.info().outputPath('weapon-roundtrip208.png')});
});


test('dragged shield and martial training affect equipped automation once and survive reload',async({page})=>{
 await mockSource(page);const c=newCharacter();c.name='拖入熟练验收';c.abilities.str=18;c.automation=newAutomationState();c.training={armor:'',weapons:''};
 const entries:Entry[]=[{name:'训练盾牌',type:'S',ac:2},{name:'训练军用剑',type:'M',weaponCategory:'martial',dmg1:'1d8',dmgType:'S'}].map((raw,i)=>({id:'training-item:'+i,kind:'item',name:raw.name,english:raw.name,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:[],raw}));
 c.selections=entries.map(entry=>({id:entry.id,entry,quantity:1,level:1,equipped:true}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'training.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});await closeImportedCard(page,c.name);
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();await expect(page.getByTestId('automation-ac')).toHaveText('10');await expect(page.locator('.automation-panel summary').filter({hasText:'训练军用剑'})).toContainText('命中 4');await page.keyboard.press('Escape');
 await page.getByRole('switch',{name:'编辑模式'}).click();await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'装备词条',exact:true}).click();
 for(const [name,label] of [['盾牌','护甲'],['军用武器','武器']]){
  await page.getByLabel('装备词条分类搜索').fill(name);const row=page.locator('.catalog-row').filter({hasText:name}).first(),training=page.locator('.training-row').filter({hasText:label});
  await row.dragTo(training);await row.dragTo(training);await expect(training.locator('.feature-bubble')).toHaveCount(1);await expect(training).toContainText(name);
 }
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();await expect(page.getByTestId('automation-ac')).toHaveText('12');await expect(page.locator('.automation-panel summary').filter({hasText:'训练军用剑'})).toContainText('命中 6');await page.keyboard.press('Escape');
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();await page.getByRole('button',{name:'自动化设置',exact:true}).click();await expect(page.getByTestId('automation-ac')).toHaveText('12');await expect(page.locator('.automation-panel summary').filter({hasText:'训练军用剑'})).toContainText('命中 6');await page.screenshot({path:test.info().outputPath('dragged-training-automation.png')});
});

for(const action of ['remove','zero'] as const)test(`background gift ${action} stays removed through refresh and undo redo`,async({page})=>{
 await mockSource(page);const c=newCharacter();c.name='赠品移除验收';
 const background:Entry={id:'gift-background',kind:'background',name:'原创赠品背景',english:'Gift Background',source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:['用于赠品生命周期验收。'],raw:{startingEquipment:[{_:['测试皮甲|XPHB']}]}};
 c.selections=[{id:'background-gift-owner',entry:background,quantity:1,level:1,equipped:false}];
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'gift.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});await closeImportedCard(page,c.name);await page.getByRole('tab',{name:'背包',exact:true}).click();
 const gift=page.locator('.paper .stock-item').filter({hasText:'测试皮甲'});await expect(gift).toHaveCount(1);
 if(action==='remove'){await gift.locator('.stock-name').click({button:'right'});await page.getByRole('menuitem',{name:'移除',exact:true}).click();}
 else {const quantity=gift.getByLabel('测试皮甲数量');await quantity.click();await quantity.fill('0');await quantity.press('Enter');}
 await expect(gift).toHaveCount(0);await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(gift).toHaveCount(1);await page.getByRole('button',{name:'重做',exact:true}).click();await expect(gift).toHaveCount(0);
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();await page.getByRole('tab',{name:'背包',exact:true}).click();await expect(gift).toHaveCount(0);
 for(let i=0;i<2;i++){await page.getByRole('button',{name:'更新资料',exact:true}).click();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await expect(gift).toHaveCount(0);}
 await page.screenshot({path:test.info().outputPath(`gift-${action}-persisted.png`)});
});
