import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../../src/core/automation/choices';
import {exportCharacter} from '../../src/core/export';
import evidence from '../../src/core/automation/classChoiceEvidence.json' with {type:'json'};

// The fixture contains authored metadata and reviewed identities, no source prose.
function card(){
 const entry=(id:string,name:string,kind:Entry['kind'],raw:Entry['raw']):Entry=>({id,name,english:name,kind,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:[],raw});
 const cls=entry('invocation-browser:class','Warlock','class',{_category:'class',casterProgression:'pact',spellcastingAbility:'cha',optionalfeatureProgression:[{name:'Learned Invocations',featureType:['EI'],progression:evidence.optionalProgressions.find(row=>row.owner==='Warlock|XPHB')!.progression}]}),invocation=entry('invocation-browser:armor','Armor of Shadows','feature',{_category:'optionalfeature',featureType:['EI'],additionalSpells:[{innate:{_:['Mage Armor|XPHB']}}]}),spell=entry('invocation-browser:spell','Mage Armor','spell',{_category:'spell',level:1,range:{type:'point',distance:{type:'touch'}}});
 const entries=[cls,invocation,spell],c=newCharacter('2024');c.name='Invocation Browser';c.notes='Retain this manual note';c.automation=newAutomationState();
 c.selections=[{id:'owner',entry:cls,level:1,quantity:1,equipped:false},{id:'manual-mage',entry:spell,level:1,quantity:1,equipped:false}];
 c.runtime.resources.manual={name:'Authored manual counter',max:5,current:2};const learned=sheetChoices(c,entries).find(row=>row.sourceProgression==='optional')!;setSheetChoiceSlot(c,learned.id,0,invocation.id,entries);syncChoiceContent(c,entries);return exportCharacter(c);
}
async function stored(page:Page){return page.evaluate(async()=>{
 const request=indexedDB.open('dnd-card-automation-choices-20261001');await new Promise<void>((resolve,reject)=>{request.onerror=()=>reject(request.error);request.onupgradeneeded=()=>{request.transaction?.abort();reject(Error('Expected isolated authored workspace'));};request.onsuccess=()=>resolve();});
 const db=request.result;try{return await new Promise<any>((resolve,reject)=>{const read=db.transaction('documents').objectStore('documents').get('workspace');read.onerror=()=>reject(read.error);read.onsuccess=()=>resolve(read.result.characters.find((c:any)=>c.id===read.result.activeId));});}finally{db.close();}
});}
test('activates, casts on self, reopens and cancels a learned invocation while retaining its manual spell',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);await page.goto('/');await expect(page.locator('.save-status')).toContainText('已保存到本地');
 await page.getByRole('button',{name:'导出 / 导入',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'invocation-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(card()))});await expect(page.getByRole('tab',{name:/Invocation Browser（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await restoreAuthoredChoices(page);
 await page.getByRole('tab',{name:'特性',exact:true}).click();await page.locator('.class-choice-records').getByRole('button',{name:'启用来源施法',exact:true}).click();await expect(page.locator('[data-choice-workspace]')).toBeVisible();await expect(page.locator('.choice-option')).toHaveCount(1);await expect(page.locator('.choice-hint')).toContainText('对自身');await page.locator('.choice-option').click();await page.getByRole('button',{name:'完成并退出',exact:true}).click();
 await expect.poll(async()=>Object.values((await stored(page)).spellSettings?.special||{}).filter((row:any)=>row.sourceGrant?.target==='self').length).toBe(1);const before=await stored(page),resources=JSON.stringify(before.runtime.resources);
 await page.getByRole('tab',{name:'法术',exact:true}).click();await page.getByRole('button',{name:'Mage Armor施法管理',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Mage Armor施法管理',exact:true});await expect(dialog).toContainText('对自身随意施法');await expect(dialog.getByRole('combobox')).toHaveCount(0);await dialog.getByRole('button',{name:'使用',exact:true}).click();await expect.poll(async()=>(await stored(page)).runtime.automationActions?.last?.target).toBe('self');expect(JSON.stringify((await stored(page)).runtime.resources)).toBe(resources);await page.getByRole('button',{name:'关闭施法管理',exact:true}).click();
 await page.reload();await expect.poll(async()=>(await stored(page)).runtime.automationActions?.last?.target).toBe('self');await page.getByRole('tab',{name:'特性',exact:true}).click();await page.locator('.class-choice-records').getByRole('button',{name:'更改来源施法',exact:true}).click();await expect(page.locator('.choice-option')).toHaveAttribute('aria-pressed','true');await page.screenshot({path:info.outputPath('invocation-self-cast.png')});await page.locator('.choice-option').click();await page.getByRole('button',{name:'完成并退出',exact:true}).click();
 await expect.poll(async()=>(await stored(page)).selections.filter((row:any)=>row.grantKey?.startsWith('source-spell:')).length).toBe(0);const after=await stored(page);expect(after.selections.find((row:any)=>row.id==='manual-mage')).toEqual(before.selections.find((row:any)=>row.id==='manual-mage'));expect(after.notes).toBe('Retain this manual note');expect(after.runtime.resources.manual).toEqual({name:'Authored manual counter',max:5,current:2});expect(errors).toEqual([]);
});
