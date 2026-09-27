import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter} from '../../src/core/model';
import {exportCharacter} from '../../src/core/export';

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
