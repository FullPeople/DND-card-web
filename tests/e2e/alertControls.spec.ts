import {test,expect,type Page,type Locator,type TestInfo} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mockSource,suppressAnnouncement} from './fixtures';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {reviewedAlertData as data,reviewedAlertFixture} from './reviewedAlertFixture';
import {exportCharacter} from '../../src/core/export';
import type {Character} from '../../src/core/model';
import {savedCharacter as saved,setSiteSource} from './reviewedRuleBrowserState';
import {alertControl,alertCatalogReadyControl,alertFeatOption} from './reviewedAlertLocators';
import {canonicalJsonSha256,ALERT_FEAT_ANNOTATION,ALERT_FEAT_RAW_SHA256,ALERT_FEAT_INPUT_SHA256,ALERT_SOURCE_ANNOTATION,ALERT_WIZARD_SHA256,captureAuthoredAlertControl,captureAuthoredAlertOverview} from './reviewedAlertArtifactPrivacy';

const consent='确认警觉先攻加值未计入手工值';
let wizardSource:any,alertSources:any[];
function input(path:string,hash:string){
 const directory=process.env.REVIEWED_FEATS_FROZEN_DIR;
 if(!directory)throw Error('Actual Alert App acceptance requires frozen originals; authored fallback is forbidden.');
 const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8')),rows=index.rows.filter((row:any)=>row.url.endsWith('/data/'+path));
 expect(rows.length).toBe(1);const body=JSON.parse(readFileSync(`${directory}/${rows[0].path}`,'utf8'));
 expect(createHash('sha256').update(JSON.stringify(body)).digest('hex')).toBe(hash);return body;
}
function realWizard(){return wizardSource||=(input('class/class-wizard.json',ALERT_WIZARD_SHA256));}
function realAlert(){
 if(alertSources)return alertSources;
 alertSources=input('feats.json',ALERT_FEAT_INPUT_SHA256).feat.filter((row:any)=>row.ENG_name==='Alert'&&['PHB','XPHB'].includes(row.source));
 expect(alertSources.length).toBe(2);
 for(const[source,hash]of [['PHB',ALERT_FEAT_RAW_SHA256],['XPHB','ac77107ad9a59813f0d986e500aa4692a05d9ade118ca84732f4f49b4cd3f0fb']])
  expect(createHash('sha256').update(JSON.stringify(alertSources.find(row=>row.source===source))).digest('hex')).toBe(hash);
 return alertSources;
}
async function mock(page:Page){
 const source=realWizard(),rules=realAlert();
 test.info().annotations.push({type:ALERT_FEAT_ANNOTATION,description:ALERT_FEAT_RAW_SHA256},{type:ALERT_SOURCE_ANNOTATION,description:ALERT_WIZARD_SHA256});
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.route('**/data/class/index.json',route=>route.fulfill({json:{wizard:'class-wizard.json'}}));
 await page.route('**/data/class/class-wizard.json',route=>route.fulfill({json:source}));
 await page.route('**/data/feats.json',route=>route.fulfill({json:{feat:[...rules,...data.feat]}}));
}
async function tab(page:Page,name:string){
 const button=page.getByRole('tab',{name,exact:true});await button.click();await expect(button).toHaveAttribute('aria-selected','true');
 const panel=page.locator('.paper[data-active-sheet="true"]');await expect(panel).toHaveClass(new RegExp(`(?:^| )page-${['主要','特性','背景','法术','背包'].indexOf(name)}(?: |$)`));await expect(panel).toBeVisible();return panel;
}
async function editor(page:Page,enabled=true){const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});await expect(toggle).toBeEnabled();await expect(toggle).toHaveAttribute('aria-busy','false');if(await toggle.getAttribute('aria-checked')!==String(enabled))await toggle.click();await expect(toggle).toHaveAttribute('aria-checked',String(enabled));}
async function ready(page:Page,options:{manual?:boolean;mixedAsi?:boolean}={}){
 await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');await expect(alertCatalogReadyControl(page)).toBeEnabled();
 let c=reviewedAlertFixture();const actual=await page.evaluate(async body=>{const path='/card/src/data/catalog.ts',module=await import(path);return module.normalizeData(body,'frozen-wizard-alert-browser').find((row:any)=>row.kind==='class'&&row.english==='Wizard'&&row.source==='PHB');},realWizard());
 expect(actual).toBeDefined();c.selections[0].entry=actual;c.jackOfAllTrades=false;
 if(options.manual){c.adjustments=[{id:'manual-initiative',target:'initiative',value:17,reason:'手工先攻最终值'}];c.sheetBonuses!.initiative=2;}
 // Use browser Vite modules, not untransformed buildMode imports in Node.
 // This is a preexisting separately owned ASI; Alert is still real UI consent.
 if(options.mixedAsi)c=await page.evaluate(async({character,wizard})=>{
  const catalogPath='/card/src/data/catalog.ts',sheetPath='/card/src/core/sheet.ts',choicesPath='/card/src/core/automation/choices.ts',asiPath='/card/src/core/automation/asi.ts';
  const [catalog,sheet,choices,asi]=await Promise.all([import(catalogPath),import(sheetPath),import(choicesPath),import(asiPath)]),entries=catalog.normalizeData(wizard,'frozen-wizard-alert-browser');
  character.selections[0].level=8;sheet.syncFeatures(character,entries);
  const choice=choices.sheetChoices(character,entries).find((row:any)=>row.sourceProgression==='feat'&&row.grantLevel===8);
  if(!choice)throw Error('The actual Wizard8 legacy source is required');const ability=choice.options.find((row:any)=>row.entry.raw._classAbilityRecord===true);
  if(!ability)throw Error('The real legacy ASI alternative is required');choices.setSheetChoiceSlot(character,choice.id,0,ability.value,entries);asi.setAsiAllocation(character,choice.id,{dex:2});return character;
 },{character:c,wizard:realWizard()});
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'reviewed-alert-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true}),imported=page.getByRole('tab',{name:/警觉交互验收（导入）/});
 await expect(review.or(imported)).toBeVisible();if(await review.isVisible()){await expect(review).toContainText('导入后保留该角色自己的规则版本');await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();}
 await expect(imported).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const database=await page.evaluate(async()=>{const path='/card/src/platform/workspaceIdentity.ts';return(await import(path)).workspaceIdentity.database;});await restoreAuthoredChoices(page,database,{'alert-wizard':true});await editor(page);return saved(page);
}
async function workspace(page:Page){
 await editor(page);const panel=await tab(page,'特性'),record=panel.locator('.detail-feats [data-class-choice]').filter({hasText:'职业 4 级'});await expect(record).toHaveCount(1);await expect(record).toBeVisible();
 if(await record.locator('[data-choice-id]').count()===0){const heading=panel.locator('.detail-class-features .feature-group h4 > button');await expect(heading).toHaveCount(1);await heading.click({button:'right'});await page.getByRole('menuitem',{name:'显示自带选项',exact:true}).click();}
 await record.locator('[data-choice-id]').click();const value=panel.locator('.choice-workspace');await expect(value).toBeVisible();return value;
}
async function choose(page:Page,name='警觉',selected=true){
 const choices=await workspace(page),entryId=name==='警觉'?'kiwee:feat:phb:alert::::::':'kiwee:feat:phb:authored%20alert%20replacement::::::',option=await alertFeatOption(choices,name,entryId);
 await expect(option).toHaveCount(1);await expect(option).toHaveAttribute('aria-disabled','false');await option.click();await expect(option).toHaveAttribute('aria-pressed',String(selected));await choices.getByRole('button',{name:'收起选择',exact:true}).click();
}
async function control(page:Page){const value=alertControl(await tab(page,'特性'));await expect(value).toHaveCount(1);await expect(value).toBeVisible();return value;}
async function persisted(page:Page){await expect(page.locator('.save-status')).toContainText('已保存到本机');return saved(page);}
async function confirm(page:Page){
 const value=await control(page),choiceId=await value.getAttribute('data-reviewed-feat-choice'),entryId=await value.getAttribute('data-reviewed-feat-entry'),before=await persisted(page),owner=before.selections.find(row=>row.parentId==='alert-wizard'&&row.entry.id===choiceId?.split(':class-legacy-feat:')[1]);expect(owner).toBeDefined();
 await expect(value.getByRole('button',{name:'确认警觉',exact:true})).toBeDisabled();await value.getByRole('checkbox',{name:consent,exact:true}).check();await value.getByRole('button',{name:'确认警觉',exact:true}).click();
 await expect(value).toContainText('警觉已生效');await expect(value.getByRole('checkbox',{name:consent,exact:true})).not.toBeChecked();
 await expect.poll(async()=>(await persisted(page)).reviewedAlert?.bindings).toEqual([{selectionId:owner!.id,choiceId,entryId,intent:{kind:'alert',confirmedManualInitiativeExcluded:true}}]);return value;
}
async function geometry(panel:Locator){
 const cell=panel.locator('.initiative-cell');await expect(cell).toHaveCount(1);
 await expect.poll(async()=>cell.evaluate(element=>{const surface=element.querySelector<HTMLElement>('.cell-surface'),value=element.querySelector<HTMLElement>('[data-stat="initiative"]'),label=element.querySelector<HTMLElement>('.cell-heading > h3');if(!surface||!value||!label)return null;const inside=(a:DOMRect,b:DOMRect)=>a.left>=b.left-1&&a.top>=b.top-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1,bounds=surface.getBoundingClientRect();return{readable:parseFloat(getComputedStyle(value).fontSize)>=18&&parseFloat(getComputedStyle(label).fontSize)>=11,inside:[value,label].every(node=>{const range=document.createRange();range.selectNodeContents(node);const glyph=range.getBoundingClientRect();let unclipped=true;for(let parent=node.parentElement;parent&&parent!==surface.parentElement;parent=parent.parentElement){const style=getComputedStyle(parent);if(/hidden|clip|auto|scroll/.test(style.overflow+style.overflowX+style.overflowY)&&!inside(glyph,parent.getBoundingClientRect()))unclipped=false;}return glyph.width>0&&glyph.height>0&&inside(glyph,bounds)&&inside(node.getBoundingClientRect(),bounds)&&unclipped&&(node.clientWidth===0||node.scrollWidth<=node.clientWidth+1);}),positive:bounds.width>0&&bounds.height>0};})).toEqual({readable:true,inside:true,positive:true});
}
async function summary(page:Page,initiative:number,dex=14,capture?:{info:TestInfo;stage:string},finalDex=dex){
 await editor(page,false);const panel=await tab(page,'主要');await expect(panel.locator('[data-stat="initiative"]')).toHaveText(`${initiative>=0?'+':''}${initiative}`);await expect(panel.getByRole('spinbutton',{name:'敏捷基础值',exact:true})).toHaveValue(String(finalDex));expect((await saved(page)).abilities.dex).toBe(dex);await expect(panel.locator('[data-stat="hp"]')).toHaveText('32');await expect(panel.getByRole('textbox',{name:'当前生命值',exact:true})).toHaveValue('7');await expect(panel.getByRole('textbox',{name:'临时生命值',exact:true})).toHaveValue('3');await geometry(panel);if(capture)await captureAuthoredAlertOverview(panel,capture.info,capture.stage);await editor(page);
}
async function layoutModes(page:Page,info:TestInfo,initiative=7,prefix=''){
 await editor(page,false);const panel=await tab(page,'主要');await page.evaluate(async()=>{const path='/card/src/ui/sheetDisplay.ts';(window as any).releaseAlertCapture=(await import(path)).beginSheetCapture();});
 try{await expect(page.locator('.sheet-viewport:has(.paper[data-active-sheet="true"])')).toHaveAttribute('data-sheet-display','a4');await expect(panel.locator('[data-stat="initiative"]')).toHaveText(`${initiative>=0?'+':''}${initiative}`);await geometry(panel);await captureAuthoredAlertOverview(panel,info,prefix?`${prefix}-a4`:'a4');await page.emulateMedia({media:'print'});await geometry(panel);await captureAuthoredAlertOverview(panel,info,prefix?`${prefix}-print`:'print');}
 finally{await page.emulateMedia({media:'screen'});await page.evaluate(()=>(window as any).releaseAlertCapture());}
 await expect(page.locator('.sheet-viewport:has(.paper[data-active-sheet="true"])')).toHaveAttribute('data-sheet-display','screen');await geometry(panel);await editor(page);
}
async function level(page:Page,value:number){await editor(page);const input=(await tab(page,'特性')).getByRole('spinbutton',{name:'法师等级',exact:true});await input.fill(String(value));await input.press('Tab');await expect.poll(async()=>(await saved(page)).selections.find(row=>row.id==='alert-wizard')?.level).toBe(value);}
async function baseDex(page:Page,value:number){await editor(page);const panel=await tab(page,'主要');await panel.getByRole('spinbutton',{name:'敏捷基础值',exact:true}).click();const trace=page.getByRole('dialog',{name:'敏捷数据追溯',exact:true}),input=trace.getByRole('spinbutton',{name:'敏捷追溯输入',exact:true});await input.fill(String(value));await input.press('Enter');await expect(trace).toHaveCount(0);await expect.poll(async()=>(await saved(page)).abilities.dex).toBe(value);}
function protectedState(after:Character,before:Character){
 for(const field of ['abilities','training','baseHp','sheetBonuses','quickbarActions','proficiencies','expertise','skillBonuses','notes','adjustments','inventory','asiAllocations'] as const)expect(canonicalJsonSha256([after[field]])).toBe(canonicalJsonSha256([before[field]]));
 expect(canonicalJsonSha256(after.runtime)).toBe(canonicalJsonSha256(before.runtime));expect(after.runtime.resources['manual-alert'].current).toBe(2);expect(canonicalJsonSha256(after.selections.filter(row=>row.entry.kind==='feat'))).toBe(canonicalJsonSha256([]));
}
async function fits(value:Locator){await value.scrollIntoViewIfNeeded();const box=await value.evaluate(el=>{const b=el.getBoundingClientRect();return{left:b.left,right:b.right,width:innerWidth,overflow:el.scrollWidth>el.clientWidth+1};});expect(box.left).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(box.width+1);expect(box.overflow).toBe(false);}

test('Alert actual Wizard4 ASI requires manual initiative review, adds only five, persists, cancels, replaces and withdraws',async({page},info)=>{
 test.setTimeout(150000);const before=await ready(page);await summary(page,2);await choose(page);await summary(page,2);let value=await control(page);await expect(value).toContainText('尚未确认警觉');await confirm(page);const active=await saved(page);await summary(page,7,14,{info,stage:'confirmed'});await layoutModes(page,info);await page.reload();await summary(page,7);expect((await saved(page)).reviewedAlert).toEqual(active.reviewedAlert);value=await control(page);await expect(value).toContainText('突袭');await expect(value.getByRole('combobox')).toHaveCount(0);await expect(value.getByRole('button')).toHaveCount(3);await fits(value);await captureAuthoredAlertControl(value,info,'confirmed');
 await value.getByRole('checkbox',{name:consent,exact:true}).check();await value.getByRole('button',{name:'取消警觉编辑',exact:true}).click();await expect(value.getByRole('checkbox',{name:consent,exact:true})).not.toBeChecked();expect((await saved(page)).reviewedAlert).toEqual(active.reviewedAlert);
 await choose(page,'原创替代记录');await expect.poll(async()=>(await saved(page)).reviewedAlert?.bindings).toEqual([]);await summary(page,2);await choose(page);await expect(await control(page)).toContainText('尚未确认警觉');await confirm(page);await(await control(page)).getByRole('button',{name:'撤回警觉',exact:true}).click();await expect.poll(async()=>(await saved(page)).reviewedAlert?.bindings).toEqual([]);await page.reload();await summary(page,2);protectedState(await saved(page),before);
});

test('Alert respects manual absolute initiative17 plus offset2 and signed final values without double counting in screen A4 or print',async({page},info)=>{
 test.setTimeout(150000);const before=await ready(page,{manual:true});await choose(page);await confirm(page);await summary(page,19,14,{info,stage:'manual'});let value=await control(page);await expect(value).toContainText('自然先攻 7');await expect(value).toContainText('手工最终值 17');await expect(value).toContainText('不会在此手工总值上再次叠加');const stored=(await saved(page)).reviewedAlert;
 let panel=await tab(page,'主要');await panel.getByRole('button',{name:'先攻数据追溯',exact:true}).click();const trace=page.getByRole('dialog',{name:'先攻数据追溯',exact:true});await expect(trace).toContainText('警觉');await expect(trace).toContainText('17');await page.keyboard.press('Escape');
 const offset=panel.getByLabel('先攻调整值',{exact:true});await offset.fill('-140');await offset.press('Tab');await expect.poll(async()=>(await saved(page)).sheetBonuses?.initiative).toBe(-140);await summary(page,-123,14,{info,stage:'signed-large'});await layoutModes(page,info,-123,'signed-large');panel=await tab(page,'主要');await panel.getByLabel('先攻调整值',{exact:true}).fill('2');await panel.getByLabel('先攻调整值',{exact:true}).press('Tab');await summary(page,19);await page.reload();await summary(page,19);expect((await saved(page)).reviewedAlert).toEqual(stored);value=await control(page);await fits(value);await captureAuthoredAlertControl(value,info,'manual');await value.getByRole('button',{name:'撤回警觉',exact:true}).click();await summary(page,19);protectedState(await saved(page),before);
});

test('Alert source and level suspension retain one owner across readonly reopen while clear undo redo and reselection revoke consent',async({page,context},info)=>{
 test.setTimeout(150000);const before=await ready(page);await choose(page);await confirm(page);const active=await saved(page);await level(page,3);await summary(page,2);let value=await control(page);await expect(value).toContainText('警觉记录已保留');await expect(value.getByRole('button',{name:'确认警觉',exact:true})).toBeDisabled();expect((await saved(page)).reviewedAlert).toEqual(active.reviewedAlert);await level(page,4);await summary(page,7);await setSiteSource(page,'PHB',false);await summary(page,2);value=await control(page);await expect(value.getByRole('checkbox',{name:consent,exact:true})).toBeDisabled();await expect(value.getByRole('button',{name:'撤回警觉',exact:true})).toBeEnabled();await page.reload();await expect(await control(page)).toContainText('警觉记录已保留');
 const other=await context.newPage();await mock(other);await other.goto('/card/?intro=0');await expect(other.locator('.card-permission-banner')).toContainText('另一标签页正在编辑');const readonly=await control(other);for(const name of ['确认警觉','取消警觉编辑','撤回警觉'])await expect(readonly.getByRole('button',{name,exact:true})).toBeDisabled();await expect(readonly.getByRole('checkbox',{name:consent,exact:true})).toBeDisabled();expect((await saved(other)).reviewedAlert).toEqual(active.reviewedAlert);await other.close();
 await setSiteSource(page,'PHB',true);await summary(page,7);await choose(page,'警觉',false);await expect.poll(async()=>(await saved(page)).reviewedAlert?.bindings).toEqual([]);await summary(page,2);await page.getByRole('button',{name:'撤销',exact:true}).click();await expect.poll(async()=>(await persisted(page)).reviewedAlert).toEqual(active.reviewedAlert);await summary(page,7);await page.getByRole('button',{name:'重做',exact:true}).click();await expect.poll(async()=>(await saved(page)).reviewedAlert?.bindings).toEqual([]);await choose(page);value=await control(page);await expect(value).toContainText('尚未确认警觉');await fits(value);await captureAuthoredAlertControl(value,info,'reselect');protectedState(await saved(page),before);
});

test('Alert uses final DEX from a separate real level8 ASI and preserves Jack of All Trades without entering ability cap ordering',async({page},info)=>{
 test.setTimeout(150000);const before=await ready(page,{mixedAsi:true});await summary(page,3,14,undefined,16);await choose(page);await confirm(page);await summary(page,8,14,{info,stage:'mixed-asi'},16);const binding=(await saved(page)).reviewedAlert,asi=canonicalJsonSha256((await saved(page)).asiAllocations);let panel=await tab(page,'主要');await panel.getByRole('checkbox',{name:'万事通',exact:true}).check();await expect.poll(async()=>(await saved(page)).jackOfAllTrades).toBe(true);await summary(page,9,14,{info,stage:'jack'},16);
 await baseDex(page,16);await summary(page,10,16,undefined,18);expect(canonicalJsonSha256((await saved(page)).asiAllocations)).toBe(asi);expect((await saved(page)).reviewedAlert).toEqual(binding);await baseDex(page,14);panel=await tab(page,'主要');await panel.getByRole('checkbox',{name:'万事通',exact:true}).uncheck();await summary(page,8,14,undefined,16);await page.reload();await summary(page,8,14,undefined,16);const value=await control(page);await expect(value.getByRole('combobox')).toHaveCount(0);await expect(value).toContainText('不提升属性');await captureAuthoredAlertControl(value,info,'mixed-asi');await value.getByRole('button',{name:'撤回警觉',exact:true}).click();await summary(page,3,14,undefined,16);protectedState(await saved(page),before);
});

test('Alert retained-card drafts clear on switch and real IndexedDB save failure never claims saved or resurrects stale consent',async({page},info)=>{
 test.setTimeout(150000);await ready(page);await choose(page);let value=await control(page);await value.getByRole('checkbox',{name:consent,exact:true}).check();const tabs=page.locator('.character-tabs'),other=tabs.locator('[role="tab"][aria-selected="false"]');await expect(other).toHaveCount(1);await other.click();await expect.poll(async()=>(await saved(page)).name).not.toContain('警觉交互验收');await tabs.getByRole('tab',{name:/警觉交互验收（导入）/}).click();value=await control(page);await expect(value.getByRole('checkbox',{name:consent,exact:true})).not.toBeChecked();const before=await persisted(page);
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as any).rejectAlertSave=true;IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){if((window as any).rejectAlertSave&&this.name==='documents'&&args[1]==='workspace')throw new DOMException('authored Alert quota failure','QuotaExceededError');return original.apply(this,args);};});await value.getByRole('checkbox',{name:consent,exact:true}).check();await value.getByRole('button',{name:'确认警觉',exact:true}).click();await expect(page.locator('.save-status')).toContainText('保存失败');await expect(value.getByTestId('alert-save-status')).toContainText('保存失败');await expect(value.getByTestId('alert-save-status')).not.toContainText('已保存到本机');await expect(value.getByRole('checkbox',{name:consent,exact:true})).not.toBeChecked();expect(canonicalJsonSha256(await saved(page))).toBe(canonicalJsonSha256(before));await captureAuthoredAlertControl(value,info,'save-failure');
 await page.evaluate(()=>(window as any).rejectAlertSave=false);await choose(page,'原创替代记录');await persisted(page);expect((await saved(page)).reviewedAlert?.bindings).toEqual([]);await page.reload();await summary(page,2);await choose(page);await expect(await control(page)).toContainText('尚未确认警觉');
});
