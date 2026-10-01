import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Character,type Entry} from '../../src/core/model';

// Original software fixtures only. Organizing shortcuts must not alter their source entities.
function fixture(){
 const c=newCharacter();c.name='快捷栏整理验收';
 const entry=(id:string,kind:Entry['kind'],name:string,raw:Entry['raw']={}):Entry=>({id,kind,name,english:name,source:'CUSTOM',edition:'both',packId:'organizer-fixture',revision:'1',entries:['原创测试条目。'],raw:{_custom:true,...raw}});
 const sword=entry('organizer-sword','item','旅行短剑',{dmg1:'1d6+2',attackBonus:4});
 const spell=entry('organizer-spell','spell','微光印记',{level:0});
 const feature=entry('organizer-feature','feature','专注姿态');
 c.selections=[sword,spell,feature,...Array.from({length:32},(_,i)=>entry('unused-'+i,'feature','未固定能力 '+i))].map(e=>({id:'selection-'+e.id,entry:e,quantity:1,level:1,equipped:false}));
 c.quickbarActions=[{id:'alpha',name:'星矢',attack:'+6',damage:'2d8+4'},{id:'beta',name:'月刃',attack:'+5',damage:'1d10+3'}];
 c.externalSnapshot={combat:{weapons:[{name:'旧式徒手攻击',attack_bonus:'+3',damage:'1d4+1'}]}};
 c.quickbarCopies=[{id:'pin-feature',entry:feature}];c.quickbar=['selection-'+spell.id];
 c.runtime.resources={focus:{name:'专注',current:1,max:4,type:'count'},reserve:{name:'后备',current:2,max:3,type:'count'}};
 c.quickbarLayout={order:['resource:reserve','custom:alpha','custom:beta'],hidden:['resource:reserve'],widgets:{focus:{style:'bar',x:2,y:1,w:6,h:3,page:0,members:['focus','reserve'],label:'战斗储备'}}};
 return c;
}
async function load(page:Page,c:Character){
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/');
 await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 await page.getByTestId('character-file').setInputFiles({name:'organizer-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});
 await expect(page.getByRole('tab',{name:c.name+'（导入）',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'关闭弹窗'}).click();await page.getByRole('switch',{name:'编辑模式'}).click();
 await expect.poll(async()=>(await saved(page)).name).toBe(c.name+'（导入）');
}
async function saved(page:Page):Promise<Character>{return page.evaluate(async()=>{
 const names=await indexedDB.databases(),name=names.some(x=>x.name==='dnd-card-standalone')?'dnd-card-standalone':'dnd-card-workspace';
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(name);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 return new Promise<Character>((resolve,reject)=>{const req=db.transaction('documents').objectStore('documents').get('workspace');req.onsuccess=()=>{const w=req.result;db.close();resolve(w.characters.find((c:Character)=>c.id===w.activeId));};req.onerror=()=>reject(req.error);});
});}
async function open(page:Page){await page.getByRole('button',{name:'整理快捷栏',exact:true}).click();await expect(page.getByRole('heading',{name:'整理快捷栏',exact:true})).toBeVisible();}

test('organizer only lists active shortcuts; reorder and removal preserve source data, resources and grouped widget layout across reload',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await load(page,fixture());const before=await saved(page);await open(page);
 const organizer=page.locator('.quickbar-organizer'),attacks=organizer.getByRole('list',{name:'在用攻击'}),pins=organizer.getByRole('list',{name:'固定条目'});
 await expect(attacks.locator('li')).toHaveCount(4);await expect(pins.locator('li')).toHaveCount(2);
 await expect(organizer).not.toContainText('未固定能力');await expect(organizer.locator('form')).toHaveCount(0);await expect(organizer.locator('select')).toHaveCount(0);
 await page.screenshot({path:test.info().outputPath('organizer-populated-desktop.png')});
 await organizer.getByRole('button',{name:'上移月刃',exact:true}).click();await expect(attacks.locator('li').first()).toContainText('月刃');
 await organizer.getByRole('button',{name:'上移▞ 微光印记',exact:true}).click();await expect(pins.locator('li').first()).toContainText('微光印记');
 await organizer.getByRole('button',{name:'从快捷栏移除▞ 旅行短剑',exact:true}).click();await expect(attacks.locator('li')).toHaveCount(3);
 await organizer.getByRole('button',{name:'取消固定▞ 专注姿态',exact:true}).click();await expect(pins.locator('li')).toHaveCount(1);
 await expect.poll(async()=>(await saved(page)).quickbarLayout?.hidden).toEqual(['resource:reserve','selection:organizer-sword']);
 const changed=await saved(page);expect(changed.selections).toEqual(before.selections);expect(changed.runtime.resources).toEqual(before.runtime.resources);expect(changed.quickbarLayout?.widgets).toEqual(before.quickbarLayout?.widgets);expect(changed.quickbarActions).toEqual(before.quickbarActions);expect(changed.externalSnapshot).toEqual(before.externalSnapshot);expect(changed.quickbarLayout?.order).toContain('resource:reserve');
 await page.getByRole('button',{name:'关闭弹窗'}).click();await page.reload();await expect(page.locator('.quickbar-attacks [data-quick-id]').first()).toContainText('月刃');await expect(page.locator('[data-quick-id="selection:organizer-sword"]')).toHaveCount(0);await expect(page.locator('.quick-pin')).toHaveCount(1);
 await open(page);await organizer.getByRole('button',{name:'显示已隐藏攻击（1）',exact:true}).click();await expect(attacks.locator('li')).toHaveCount(4);
 await expect.poll(async()=>(await saved(page)).quickbarLayout?.hidden).toEqual(['resource:reserve']);
 const restored=await saved(page);expect(restored.quickbarLayout?.widgets).toEqual(before.quickbarLayout?.widgets);expect(restored.runtime.resources).toEqual(before.runtime.resources);expect(restored.selections).toEqual(before.selections);expect(restored.quickbarLayout?.order?.[0]).toBe('resource:reserve');
 await page.setViewportSize({width:420,height:900});await expect(organizer).toBeVisible();expect(await organizer.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.screenshot({path:test.info().outputPath('organizer-populated-narrow.png')});
 expect(errors).toEqual([]);
});

test('manual attack editor is optional, updates existing actions, and preserves hidden legacy action data',async({page})=>{
 await load(page,fixture());await open(page);const organizer=page.locator('.quickbar-organizer');
 await expect(organizer.getByRole('textbox',{name:'名字',exact:true})).toHaveCount(0);
 await organizer.getByRole('button',{name:'编辑星矢',exact:true}).click();await expect(organizer.getByRole('textbox',{name:'名字',exact:true})).toHaveValue('星矢');
 await organizer.getByRole('textbox',{name:'命中加值',exact:true}).fill('+8');await organizer.getByRole('button',{name:'保存',exact:true}).click();await expect(organizer.locator('[data-organizer-key="custom:alpha"]')).toContainText('+8');
 await organizer.getByRole('button',{name:'＋ 新建手填攻击',exact:true}).click();await organizer.getByRole('textbox',{name:'名字',exact:true}).fill('晨星');await organizer.getByRole('textbox',{name:'命中加值',exact:true}).fill('+7');await organizer.getByRole('textbox',{name:'伤害',exact:true}).fill('2d6+3');await organizer.getByRole('button',{name:'添加',exact:true}).click();
 await organizer.getByRole('button',{name:'从快捷栏移除星矢',exact:true}).click();await organizer.getByRole('button',{name:'从快捷栏移除旧式徒手攻击',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).quickbarActions?.map(a=>[a.name,a.attack,a.damage])).toEqual([['星矢','+8','2d8+4'],['月刃','+5','1d10+3'],['晨星','+7','2d6+3']]);
 await expect.poll(async()=>(await saved(page)).quickbarLayout?.hidden?.length).toBe(3);
 await page.getByRole('button',{name:'关闭弹窗'}).click();await page.reload();await expect(page.locator('.quick-weapon').filter({hasText:'星矢'})).toHaveCount(0);await expect(page.locator('.quick-weapon').filter({hasText:'旧式徒手攻击'})).toHaveCount(0);await expect(page.locator('.quick-weapon').filter({hasText:'晨星'})).toContainText('+7');
 await open(page);await organizer.getByRole('button',{name:'显示已隐藏攻击（2）',exact:true}).click();await expect(organizer.locator('[data-organizer-key="custom:alpha"]')).toContainText('+8');await expect(organizer.getByRole('list',{name:'在用攻击'})).toContainText('旧式徒手攻击');
 await expect.poll(async()=>(await saved(page)).quickbarLayout?.hidden).toEqual(['resource:reserve']);
});
