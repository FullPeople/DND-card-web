import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Character,type Entry} from '../../src/core/model';
import {inventoryState} from '../../src/core/characterDetails';
import {validateCharacter} from '../../src/core/validation';

async function readCard(page:Page){
 return page.evaluate(async()=>{
  const path='/src/platform/storage.ts';const {loadWorkspace}=await import(path);
  const workspace=await loadWorkspace(true);return workspace.characters.find((card:Character)=>card.id===workspace.activeId) as Character;
 });
}
async function setup(page:Page,card:Character,displayMode:'a4'|'screen'='a4'){
 validateCharacter(card);
 await mockSource(page,{displayMode});await suppressAnnouncement(page);await page.goto('/');
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.evaluate(async(card)=>{
  const path='/src/platform/storage.ts';const {loadWorkspace,saveWorkspace}=await import(path);
  const workspace=await loadWorkspace();await saveWorkspace({...workspace,characters:[card],activeId:card.id});
 },card);
 await page.reload();await expect(page.getByRole('tab',{name:card.name,exact:true})).toBeVisible();
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
}

test('coin edits show ordinary decimal GP values and preserve denomination balances after reopening',async({page})=>{
 const card=newCharacter();card.name='Currency display witness';
 card.inventory={...inventoryState(card),coins:{cp:29,sp:0,ep:1,gp:12,pp:2}};
 await setup(page,card);await page.getByRole('tab',{name:'背包',exact:true}).click();
 const silver=page.locator('[data-stock-id="coin:sp"]');
 await silver.getByRole('button',{name:'银币数量',exact:true}).click();
 await silver.getByRole('textbox',{name:'银币数量',exact:true}).fill('3');
 await silver.getByRole('textbox',{name:'银币数量',exact:true}).press('Enter');
 await expect(silver.locator('.stock-value')).toHaveText('0.3 GP');
 await expect(page.locator('[data-stock-id="coin:cp"] .stock-value')).toHaveText('0.29 GP');
 await expect.poll(async()=>(await readCard(page)).inventory?.coins.sp).toBe(3);
 await page.reload();await page.getByRole('tab',{name:'背包',exact:true}).click();
 await expect(page.locator('[data-stock-id="coin:sp"] .stock-value')).toHaveText('0.3 GP');
 expect((await readCard(page)).inventory?.coins).toEqual({cp:29,sp:3,ep:1,gp:12,pp:2});
});

test('five-page PDF collapses opened feature prose for capture and restores the unchanged card and display',async({page},info)=>{
 const card=newCharacter();card.name='Export layout witness';card.notes='Preserve authored manual notes.';
 const entries:Entry[]=Array.from({length:24},(_,i)=>({id:`export-witness:${i}`,kind:'feature',name:`Export entry ${String(i+1).padStart(2,'0')}`,english:`Export entry ${i+1}`,source:'XPHB',edition:'2024',packId:'authored',revision:'1',raw:{},entries:Array.from({length:i===0?40:2},(_,j)=>`Authored layout paragraph ${j+1}. This text tests the existing card export.`)}));
 card.selections=entries.map(entry=>({id:entry.id,entry,quantity:1,level:1,equipped:false}));
 card.featureLayout={order:entries.map(entry=>entry.id),expanded:[entries[0].id],detailsExpanded:[entries[0].id]};
 await setup(page,card,'screen');await page.getByRole('tab',{name:'特性',exact:true}).click();
 await expect(page.locator('.detail-class-features .feature-bubble.is-expanded')).toHaveCount(1);
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 const before=await readCard(page);
 await page.evaluate(()=>{
  const samples:any[]=[];(window as any).exportSamples=samples;
  new MutationObserver(()=>{
   const paper=document.querySelector<HTMLElement>('.paper.sheet-export');if(!paper)return;
   samples.push({page:paper.getAttribute('aria-labelledby'),expanded:paper.querySelectorAll('.feature-bubble.is-expanded').length,prose:paper.querySelectorAll('.feature-prose').length,width:paper.clientWidth,height:paper.clientHeight,features:[...paper.querySelectorAll('[data-feature-id] .feature-caption')].map(node=>node.textContent?.trim())});
  }).observe(document.querySelector('.paper')!,{attributes:true,attributeFilter:['class']});
 });
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载 PDF',exact:true}).click();
 await (await download).saveAs(info.outputPath('collapsed-five-pages.pdf'));
 await expect(page.locator('.transfer-panel [role=status]')).toContainText('5 页 A4 PDF');
 const samples=await page.evaluate(()=>(window as any).exportSamples as {expanded:number;prose:number;width:number;height:number;features:string[]}[]);
 expect(samples.length).toBeGreaterThanOrEqual(5);
 expect(samples.every(sample=>sample.expanded===0&&sample.prose===0)).toBe(true);
 expect(samples.every(sample=>sample.width>=678&&Math.abs(sample.height/sample.width-297/210)<.01)).toBe(true);
 expect(samples.some(sample=>entries.every(entry=>sample.features.some(name=>name?.includes(entry.name))))).toBe(true);
 await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await expect(page.getByRole('tab',{name:'特性',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toHaveAttribute('aria-checked','true');
 await expect(page.locator('.detail-class-features .feature-bubble.is-expanded')).toHaveCount(1);
 await expect(page.locator('.sheet-viewport')).toHaveAttribute('data-sheet-display','screen');
 expect(await page.evaluate(()=>localStorage.getItem('dnd-card-sheet-display'))).toBe('screen');
 expect(await readCard(page)).toEqual(before);
 await page.screenshot({path:info.outputPath('restored-feature-layout.png')});
});

test('a failed image capture restores feature expansion and screen preference without saving character edits',async({page})=>{
 const card=newCharacter();card.name='Failed export restoration';
 const entry:Entry={id:'failure-witness',kind:'feature',name:'Restored feature',english:'Restored feature',source:'XPHB',edition:'2024',packId:'authored',revision:'1',raw:{},entries:['Authored failure recovery witness.']};
 card.selections=[{id:entry.id,entry,quantity:1,level:1,equipped:false}];
 card.featureLayout={order:[entry.id],expanded:[entry.id],detailsExpanded:[entry.id]};
 await setup(page,card,'screen');await page.getByRole('tab',{name:'特性',exact:true}).click();
 await expect(page.locator('.feature-bubble.is-expanded')).toHaveCount(1);const before=await readCard(page);
 const result=await page.evaluate(async()=>{
  const path='/src/platform/sheetImage.ts';const {captureSheet}=await import(path),original=HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};
  try{await captureSheet();return 'unexpected-success';}catch(error){return String(error);}finally{HTMLCanvasElement.prototype.toBlob=original;}
 });
 expect(result).toContain('PNG 生成失败');await expect(page.locator('.paper')).not.toHaveClass(/sheet-export/);
 await expect(page.locator('.feature-bubble.is-expanded')).toHaveCount(1);
 await expect(page.locator('.sheet-viewport')).toHaveAttribute('data-sheet-display','screen');
 expect(await readCard(page)).toEqual(before);
});
