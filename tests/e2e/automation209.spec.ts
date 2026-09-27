import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter} from '../../src/core/model';
import {exportCharacter} from '../../src/core/export';
import {newAutomationState} from '../../src/core/automation/state';

function manual(){
 const c=newCharacter();c.name='自动化迁移验收';c.abilities.dex=16;c.training={armor:'轻甲、中甲、重甲、盾牌'};c.runtime.resources={fixture:{name:'剩余次数',current:1,max:3}};
 c.selections=[{name:'验收轻甲',type:'LA',ac:11},{name:'验收重甲',type:'HA',ac:16},{name:'验收盾牌',type:'S',ac:2}].map((raw,i)=>({id:'equipment-'+i,entry:{id:'fixture:'+i,kind:'item',name:raw.name,english:'Fixture '+i,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:['原创软件验收条目。'],raw:{...raw,source:'XPHB'}},quantity:1,level:1,equipped:false}));return c;
}
async function readWorkspace(page:Page){return page.evaluate(async()=>{
 const request=indexedDB.open('dnd-card-automation-209');const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{return await new Promise<any>((resolve,reject)=>{const get=db.transaction('documents').objectStore('documents').get('workspace');get.onsuccess=()=>resolve(get.result);get.onerror=()=>reject(get.error);});}finally{db.close();}
});}
async function ready(page:Page){await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await expect(page.getByRole('button',{name:'自动化设置'})).toBeVisible();await expect(page.locator('.save-status')).toContainText('已保存到本机');}
async function importManual(page:Page){await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'manual.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(manual())))});await page.keyboard.press('Escape');await expect(page.getByRole('tab',{name:'自动化迁移验收（导入）',exact:true})).toHaveAttribute('aria-selected','true');}

test('manual card copies into automation; armor replaces, shield adds, undo and reload preserve intent and resources',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);await importManual(page);
 await page.getByRole('button',{name:'自动化设置'}).click();await expect(page.getByTestId('automation-ac')).toHaveText('13');await page.getByRole('button',{name:'复制并开启自动计算'}).click();
 await expect(page.getByRole('tab',{name:'自动化迁移验收（导入）（副本）',exact:true})).toHaveAttribute('aria-selected','true');await page.getByRole('button',{name:'自动化设置'}).click();
 await page.getByRole('checkbox',{name:'装备 验收轻甲',exact:true}).check();await expect(page.getByTestId('automation-ac')).toHaveText('14');
 await page.getByRole('checkbox',{name:'装备 验收盾牌',exact:true}).check();await expect(page.getByTestId('automation-ac')).toHaveText('16');
 await page.getByRole('checkbox',{name:'装备 验收重甲',exact:true}).check();await expect(page.getByTestId('automation-ac')).toHaveText('18');await expect(page.getByRole('checkbox',{name:'装备 验收轻甲',exact:true})).not.toBeChecked();
 await page.screenshot({path:test.info().outputPath('armor-shield-trace.png')});await page.keyboard.press('Escape');await page.getByRole('button',{name:'撤销',exact:true}).click();await page.getByRole('button',{name:'自动化设置'}).click();await expect(page.getByTestId('automation-ac')).toHaveText('16');await page.keyboard.press('Escape');await page.getByRole('button',{name:'重做',exact:true}).click();
 await expect.poll(async()=>{const w=await readWorkspace(page);return w.characters.find((c:any)=>c.id===w.activeId)?.selections.find((s:any)=>s.entry.name==='验收重甲')?.equipped;}).toBe(true);
 await page.reload();await page.getByRole('button',{name:'自动化设置'}).click();await expect(page.getByTestId('automation-ac')).toHaveText('18');
 const w=await readWorkspace(page),original=w.characters.find((c:any)=>c.name==='自动化迁移验收（导入）'),copy=w.characters.find((c:any)=>c.id===w.activeId);expect(original.automation).toBeUndefined();expect(original.selections.every((r:any)=>!r.equipped)).toBe(true);expect(copy.runtime.resources.fixture.current).toBe(1);expect(copy.abilities.dex).toBe(16);
 await page.getByRole('checkbox',{name:'启用自动计算',exact:true}).uncheck();await expect(page.getByTestId('automation-ac')).toHaveText('13');await page.getByRole('checkbox',{name:'启用自动计算',exact:true}).check();await expect(page.getByTestId('automation-ac')).toHaveText('18');expect(errors).toEqual([]);
});
test('narrow screen keeps settings readable and uses isolated storage',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);await page.getByRole('button',{name:'自动化设置'}).click();await expect(page.getByRole('dialog',{name:'自动化开发版',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);const names=await page.evaluate(async()=>(await indexedDB.databases()).map(d=>d.name));expect(names).toContain('dnd-card-automation-209');expect(names).not.toContain('dnd-card-standalone');await page.screenshot({path:test.info().outputPath('automation-mobile.png')});
});
test('failed equipment save preserves the previous database and the current draft, then a later save commits both actions once',async({page})=>{
 await ready(page);await importManual(page);await page.getByRole('button',{name:'自动化设置'}).click();await page.getByRole('button',{name:'复制并开启自动计算'}).click();await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const before=await readWorkspace(page);
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as any).rejectAutomationSave=true;IDBObjectStore.prototype.put=function(...args:any[]){if((window as any).rejectAutomationSave&&this.name==='documents'&&args[1]==='workspace')throw new DOMException('injected full storage','QuotaExceededError');return original.apply(this,args as any);};});
 await page.getByRole('button',{name:'自动化设置'}).click();await page.getByRole('checkbox',{name:'装备 验收重甲',exact:true}).check();await expect(page.locator('.save-status')).toContainText('保存失败');await expect(page.getByTestId('automation-ac')).toHaveText('16');expect(await readWorkspace(page)).toEqual(before);
 await page.evaluate(()=>{(window as any).rejectAutomationSave=false;});await page.getByRole('checkbox',{name:'装备 验收盾牌',exact:true}).check();await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const saved=await readWorkspace(page),c=saved.characters.find((c:any)=>c.id===saved.activeId);expect(c.selections.filter((r:any)=>r.equipped).map((r:any)=>r.entry.name)).toEqual(['验收重甲','验收盾牌']);expect(c.runtime.resources.fixture.current).toBe(1);
 await page.reload();await page.getByRole('button',{name:'自动化设置'}).click();await expect(page.getByTestId('automation-ac')).toHaveText('18');
});

test('equipped weapon has separate clickable thrown and two-handed formulas, surviving save and reload',async({page})=>{
 await ready(page);const c=manual();c.name='武器自动化验收';c.automation=newAutomationState();c.abilities.str=18;c.training!.weapons='简易武器';
 c.quickbarActions=[{id:'manual',name:'保留手写攻击',attack:'+9',damage:'2d8+7'}];
 c.selections.push({id:'weapon-fixture',entry:{...c.selections[0].entry,id:'fixture:weapon',name:'验收长兵器',english:'Fixture Spear',raw:{type:'M',weaponCategory:'simple',dmg1:'1d6',dmg2:'1d8',dmgType:'P',property:['T','V']}},quantity:4,level:1,equipped:false});
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'weapon.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'自动化设置'}).click();await page.getByRole('checkbox',{name:'装备 验收长兵器'}).check();await page.keyboard.press('Escape');
 const thrown=page.locator('[data-quick-id="auto-weapon:weapon-fixture:thrown"]'),twohanded=page.locator('[data-quick-id="auto-weapon:weapon-fixture:two-handed"]');
 await expect(thrown).toContainText('投掷');await expect(thrown).toContainText('1d6+4');await expect(twohanded).toContainText('1d8+4');await expect(page.locator('[data-quick-id="custom:manual"]')).toContainText('2d8+7');
 const edit=page.getByRole('switch',{name:'编辑模式',exact:true});if(await edit.getAttribute('aria-checked')==='true')await edit.click();
 const dice=page.getByRole('dialog',{name:'本地投骰'});
 await thrown.getByRole('button',{name:'+6',exact:true}).click();await expect(dice.getByRole('textbox',{name:'骰子表达式'})).toHaveValue('1d20+6');await dice.getByRole('button',{name:'投骰',exact:true}).click();await expect(dice.getByRole('status')).toContainText('1d20:');const total=Number((await dice.getByRole('status').innerText()).split(' ')[0]);expect(total).toBeGreaterThanOrEqual(7);expect(total).toBeLessThanOrEqual(26);await dice.getByRole('button',{name:'关闭'}).click();
 await thrown.getByRole('button',{name:/1d6\+4/}).click();await expect(dice.getByRole('textbox',{name:'骰子表达式'})).toHaveValue('1d6+4');await dice.getByRole('button',{name:'关闭'}).click();
 await twohanded.getByRole('button',{name:/1d8\+4/}).click();await expect(dice.getByRole('textbox',{name:'骰子表达式'})).toHaveValue('1d8+4');await dice.getByRole('button',{name:'关闭'}).click();
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();await expect(thrown).toBeVisible();
 await page.getByRole('button',{name:'自动化设置'}).click();await page.getByRole('checkbox',{name:'装备 验收长兵器'}).uncheck();await page.keyboard.press('Escape');await expect(thrown).toHaveCount(0);await expect(page.locator('[data-quick-id="custom:manual"]')).toBeVisible();
});

test('source spells stay fixed, use their own casting ability and keep spent charges after reload and disable',async({page})=>{
 await ready(page);const c=manual();c.name='来源法术验收';c.automation=newAutomationState();c.abilities.cha=18;c.abilities.wis=14;
 const base=c.selections[0].entry;
 const spell={...base,id:'fixture:source-spell',kind:'spell' as const,name:'验收护幕',english:'Fixture Ward',raw:{level:1,school:'A',entries:['原创软件验收法术。']}};
 c.selections=[{id:'own-spell',entry:spell,quantity:1,level:1,equipped:false},{id:'gift-race',entry:{...base,id:'fixture:race',kind:'race',name:'验收种族',raw:{additionalSpells:[{ability:{choose:['int','cha']},innate:{'_':{daily:{'2':['Fixture Ward|XPHB']}}}}]}},quantity:1,level:1,equipped:false},{id:'gift-class',entry:{...base,id:'fixture:class',kind:'class',name:'验收职业',raw:{hd:{faces:8},spellcastingAbility:'wis',additionalSpells:[{prepared:{'1':['Fixture Ward|XPHB']}}]}},quantity:1,level:1,equipped:false}];
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'source-spells.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'自动化设置'}).click();await page.getByRole('combobox',{name:'验收种族的施法属性'}).selectOption('cha');await page.keyboard.press('Escape');await page.getByRole('tab',{name:'法术',exact:true}).click();
 const race=page.locator('.source-spell-group').filter({hasText:'来自验收种族'}).locator('.source-spell-row'),cls=page.locator('.source-spell-group').filter({hasText:'来自验收职业'}).locator('.source-spell-row');
 const dialog=page.getByRole('dialog',{name:'验收护幕施放详情'});
 await race.getByRole('button',{name:'验收护幕施放详情'}).click();await expect(dialog).toContainText('魅力 · 攻击 +6 · DC 14');await page.keyboard.press('Escape');
 await cls.getByRole('button',{name:'验收护幕施放详情'}).click();await expect(dialog).toContainText('感知 · 攻击 +4 · DC 12');await page.keyboard.press('Escape');await expect(race.locator('.spell-stock-tile')).toHaveAttribute('data-drag-enabled','false');
 const edit=page.getByRole('switch',{name:'编辑模式'});if(await edit.getAttribute('aria-checked')!=='true')await edit.click();
 await race.locator('.spell-stock-tile').click({button:'right'});await expect(page.getByRole('menu',{name:'法术操作'}).getByRole('menuitem',{name:'从角色卡移除'})).toHaveCount(0);await expect(page.getByRole('menuitem',{name:'改为普通法术'})).toHaveCount(0);await page.keyboard.press('Escape');
 await race.getByRole('button',{name:'验收护幕施放详情'}).click();await dialog.getByRole('button',{name:'使用',exact:true}).click();await expect(dialog.getByRole('spinbutton',{name:'验收护幕剩余次数'})).toHaveValue('1');await page.keyboard.press('Escape');
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.screenshot({path:test.info().outputPath('source-spells.png')});await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(race).toContainText('免费 1/2');
 await page.getByRole('button',{name:'自动化设置'}).click();await page.getByRole('checkbox',{name:'启用自动计算'}).uncheck();await page.keyboard.press('Escape');await race.getByRole('button',{name:'验收护幕施放详情'}).click();await expect(dialog.getByRole('button',{name:'使用',exact:true})).toBeDisabled();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'自动化设置'}).click();await page.getByRole('checkbox',{name:'启用自动计算'}).check();await page.keyboard.press('Escape');await expect(race).toContainText('免费 1/2');
 const w=await readWorkspace(page),saved=w.characters.find((x:any)=>x.id===w.activeId);expect(saved.selections.filter((s:any)=>s.entry.kind==='spell')).toHaveLength(3);expect(saved.selections.some((s:any)=>s.id==='own-spell'&&!s.parentId)).toBe(true);
});

async function importSharedSpells(page:Page){
 const c=manual();c.name='共享施法验收';c.automation=newAutomationState();const base=c.selections[0].entry;
 const first={...base,id:'fixture:shared-a',kind:'spell' as const,name:'共享甲',english:'Shared A',raw:{level:1,school:'A'}},second={...first,id:'fixture:shared-b',name:'共享乙',english:'Shared B',raw:{level:2,school:'A'}};
 c.selections=[{id:'manual-a',entry:first,quantity:1,level:1,equipped:false},{id:'manual-b',entry:second,quantity:1,level:1,equipped:false},{id:'shared-owner',entry:{...base,id:'fixture:shared-source',kind:'race',name:'共用来源',raw:{additionalSpells:[{ability:'cha',prepared:{'_':{daily:{'2':['Shared A|XPHB','Shared B|XPHB']}}}}]}},quantity:1,level:1,equipped:false}];
 c.runtime.resources['spell-slot:1']={current:2,max:2};c.runtime.resources['spell-slot:3']={current:1,max:2};
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'shared-spells.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});await page.keyboard.press('Escape');await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(page.locator('.spell-source-notices')).toContainText('来源法术需要核对');await page.getByRole('button',{name:'自动化设置'}).click();await page.getByRole('combobox',{name:'共用来源的次数归属：Shared A、Shared B'}).selectOption('shared');await page.keyboard.press('Escape');await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(page.locator('.source-spell-row')).toHaveCount(2);await expect(page.locator('.save-status')).toContainText('已保存到本机');
 return {first:page.locator('.source-spell-row').filter({hasText:'共享甲'}),second:page.locator('.source-spell-row').filter({hasText:'共享乙'})};
}

async function spellDialog(page:Page,name:string){if(await page.getByRole('button',{name:'关闭施放详情'}).count())await page.getByRole('button',{name:'关闭施放详情'}).click();await page.getByRole('button',{name:`${name}施放详情`,exact:true}).click();return page.getByRole('dialog',{name:`${name}施放详情`});}

test('shared spells choose charges or an explicit upcast slot, and undo redo reload preserve one atomic action',async({page})=>{
 await ready(page);const {first,second}=await importSharedSpells(page);
 let dialog=await spellDialog(page,'共享甲');await dialog.getByRole('button',{name:'使用',exact:true}).click();await page.keyboard.press('Escape');await expect(second).toContainText('共用 1/2');
 dialog=await spellDialog(page,'共享乙');await dialog.getByRole('button',{name:'使用',exact:true}).click();await page.keyboard.press('Escape');await expect(first).toContainText('共用 0/2');
 dialog=await spellDialog(page,'共享甲');await expect(dialog.getByRole('button',{name:'使用',exact:true})).toBeDisabled();await dialog.getByRole('combobox',{name:'共享甲施法消耗'}).selectOption('slot:spell-slot:3');await dialog.getByRole('button',{name:'使用',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('3 环施法');await page.keyboard.press('Escape');
 const slot=async()=>{const w=await readWorkspace(page);return w.characters.find((c:any)=>c.id===w.activeId).runtime.resources['spell-slot:3'].current;};await expect.poll(slot).toBe(0);
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect.poll(slot).toBe(1);await expect(first).toContainText('共用 0/2');
 await page.getByRole('button',{name:'重做',exact:true}).click();await expect.poll(slot).toBe(0);await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(second).toContainText('共用 0/2');
 dialog=await spellDialog(page,'共享乙');await dialog.getByRole('button',{name:'恢复共用次数'}).click();await page.keyboard.press('Escape');await expect(first).toContainText('共用 2/2');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const w=await readWorkspace(page),saved=w.characters.find((c:any)=>c.id===w.activeId);expect(saved.runtime.automationActions.sequence).toBe(4);expect(saved.runtime.automationActions.last.mode).toBe('restore');expect(saved.runtime.resources['spell-slot:1'].current).toBe(2);expect(saved.runtime.resources['spell-slot:3'].current).toBe(0);expect(saved.runtime.resources.fixture.current).toBe(1);await expect(first.locator('.stock-name')).toBeInViewport({ratio:0.9999});await expect(second.locator('.stock-name')).toBeInViewport({ratio:0.9999});await page.screenshot({path:test.info().outputPath('shared-spell-actions.png')});
});

test('a failed spell-action save retains the prior counter and receipt on disk, then saves both intended casts together',async({page})=>{
 await ready(page);const {first,second}=await importSharedSpells(page);const before=await readWorkspace(page);
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as any).rejectSpellSave=true;IDBObjectStore.prototype.put=function(...args:any[]){if((window as any).rejectSpellSave&&this.name==='documents'&&args[1]==='workspace')throw new DOMException('injected spell storage failure','QuotaExceededError');return original.apply(this,args as any);};});
 let dialog=await spellDialog(page,'共享甲');await dialog.getByRole('button',{name:'使用',exact:true}).click();await page.keyboard.press('Escape');await expect(first).toContainText('共用 1/2');await expect(page.locator('.save-status')).toContainText('保存失败');expect(await readWorkspace(page)).toEqual(before);
 await page.evaluate(()=>{(window as any).rejectSpellSave=false;});dialog=await spellDialog(page,'共享乙');await dialog.getByRole('button',{name:'使用',exact:true}).click();await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const w=await readWorkspace(page),saved=w.characters.find((c:any)=>c.id===w.activeId);expect(saved.runtime.automationActions.sequence).toBe(2);const pools=Object.entries(saved.runtime.resources).filter(([id])=>id.startsWith('source-spell-pool:'));expect(pools).toHaveLength(1);expect((pools[0][1] as any).current).toBe(0);expect(saved.runtime.resources['spell-slot:1'].current).toBe(2);
 await page.reload();await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(first).toContainText('共用 0/2');await expect(second).toContainText('共用 0/2');
});
