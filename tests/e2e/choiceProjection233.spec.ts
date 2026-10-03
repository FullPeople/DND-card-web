import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {installCardAutomation} from './automationFixtures';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
async function saved(page:Page){return page.evaluate(()=>new Promise<any>((resolve,reject)=>{const request=indexedDB.open('dnd-card-standalone');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,read=db.transaction('documents').objectStore('documents').get('workspace');read.onsuccess=()=>{resolve(read.result);db.close();};read.onerror=()=>{reject(read.error);db.close();};};}));}
for(const mode of ['a4','screen'] as const)test(`${mode} choice projection survives display edits, class undo, readonly mode and reload`,async({page})=>{
 // The compact screen layout intentionally hides the player field below a
 // 760px sheet container. Exercise both display fields in the wide layout.
 const wideWidth=mode==='screen'?2560:1512;await page.setViewportSize({width:wideWidth,height:982});
 await mockSource(page,{displayMode:mode});await suppressAnnouncement(page);
 const characters=Array.from({length:12},(_,i)=>{const c=newCharacter();c.name=`原创标签 ${i}`;c.automation=newAutomationState();c.runtime.resources.spent={name:'已消耗资源',current:1,max:7};return c;});
 const active=characters.at(-1)!;const owner:Entry={id:'authored-choice-owner',kind:'class',name:'测试法师',english:'Test Mage',edition:'2024',source:'XPHB',packId:'authored',revision:'1',entries:['原创选择投影验收。'],raw:{name:'测试法师',ENG_name:'Test Mage',cantripProgression:[1],classTableGroups:[{rowsSpellProgression:[[2]]}]}};
 active.selections=[{id:'owner',entry:owner,level:1,quantity:1,equipped:false}];
 await installCardAutomation(page,active,[],false);
 await page.addInitScript(characters=>{localStorage.setItem('dnd-card:editing','true');const r=indexedDB.open('dnd-card-standalone',1);r.onupgradeneeded=()=>{r.result.createObjectStore('documents');r.result.createObjectStore('cache');};r.onsuccess=()=>{const db=r.result,t=db.transaction('documents','readwrite'),s=t.objectStore('documents'),read=s.get('workspace');read.onsuccess=()=>{if(!read.result)s.put({schemaVersion:1,characters,activeId:characters.at(-1)!.id,packs:[]},'workspace');};t.oncomplete=()=>db.close();};},characters);
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toHaveAttribute('aria-checked','true');
 const tabs=page.getByRole('tablist',{name:'当前角色'}),name=page.getByRole('textbox',{name:'角色姓名',exact:true}),player=page.getByRole('textbox',{name:'玩家姓名',exact:true});
 const cantrip=page.locator('.class-features').getByRole('button',{name:'戏法 0/1',exact:true});await expect(cantrip).toBeVisible();
 await expect(name).toBeVisible();await expect(player).toBeVisible();await name.fill('很长的原创角色姓名用于核实标签宽度变化后仍然可见');await player.fill('原创玩家');await expect(cantrip).toBeVisible();
 await expect.poll(async()=>{const w=await saved(page),c=w.characters.find((c:any)=>c.id===w.activeId);return [c.name,c.player];}).toEqual(['很长的原创角色姓名用于核实标签宽度变化后仍然可见','原创玩家']);
 await page.setViewportSize({width:390,height:844});
 if(mode==='screen')await expect(page.locator('input[aria-label="玩家姓名"]')).toBeHidden();
 await expect.poll(()=>tabs.locator('[aria-selected=true]').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement!.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;})).toBe(true);
 await name.fill('短');await expect.poll(()=>tabs.locator('[aria-selected=true]').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement!.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;})).toBe(true);
 // Class mechanics invalidate the shared view; undo restores the real prior state.
 await page.setViewportSize({width:wideWidth,height:982});await page.locator('.identity-class .identity-title').press('Delete');await expect(cantrip).toHaveCount(0);await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(cantrip).toBeVisible();
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await expect(name).toHaveAttribute('readonly','');await expect(player).toHaveAttribute('readonly','');await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await expect(cantrip).toBeVisible();
 await expect.poll(async()=>{const w=await saved(page);return w.characters.find((c:any)=>c.id===w.activeId)?.selections.some((s:any)=>s.id==='owner');}).toBe(true);
 await page.reload();await expect(name).toHaveValue('短');await expect(player).toHaveValue('原创玩家');await expect(cantrip).toBeVisible();const w=await saved(page),after=w.characters.find((c:any)=>c.id===w.activeId);expect(after.runtime.resources.spent).toEqual(active.runtime.resources.spent);expect(w.characters.slice(0,-1)).toEqual(characters.slice(0,-1));
});
