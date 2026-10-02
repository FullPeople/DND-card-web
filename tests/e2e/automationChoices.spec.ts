import {mkdirSync,readFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';
mkdirSync('evidence',{recursive:true});
async function tooltipOnTop(page:Page,text:string){
 const tooltip=page.getByRole('tooltip').filter({hasText:text}).last();await expect(tooltip).toBeVisible();
 await expect.poll(()=>tooltip.evaluate(el=>{
  // Hover previews intentionally ignore pointer input until pinned. Temporarily
  // include the preview in hit testing to measure its actual painted stack.
  const b=el.getBoundingClientRect(),previous=el.style.pointerEvents;el.style.pointerEvents='auto';
  try{return document.elementFromPoint(b.x+b.width/2,b.y+20)?.closest('[role="tooltip"]')===el;}finally{el.style.pointerEvents=previous;}
 })).toBe(true);
}
const raw={class:[{name:'测试职业',ENG_name:'Fixture Class',source:'XPHB',hd:{faces:10},startingProficiencies:{skills:[{choose:{from:['athletics','perception','history'],count:2}}]},startingEquipment:{defaultData:[{A:[{item:'测试剑|XPHB'},{value:400}],B:[{value:15000}]}]},classFeatures:['测试圣职|测试职业|XPHB|1|XPHB','测试回气|测试职业|XPHB|1|XPHB']}],classFeature:[{name:'测试圣职',source:'XPHB',className:'测试职业',classSource:'XPHB',level:1,entries:[{type:'options',count:1,entries:[{type:'entries',name:'保护者',entries:['原创选项：防护。'],effects:[{op:'add',target:'ac',value:2}]},{type:'entries',name:'奇术使',entries:['原创选项：魔法。']}]}]},{name:'测试回气',source:'XPHB',className:'测试职业',classSource:'XPHB',level:1,resources:[{name:'回气',max:'@class.level + 1',formula:'1d10 + @class.level',recovery:{short:1,long:'all'}}],entries:['原创资源验收条目。']}],item:[{name:'测试剑',source:'XPHB',entries:['原创测试装备。']}]};
async function ready(page:Page,data:Record<string,any[]>=raw){
 await mockSource(page);await suppressAnnouncement(page);
 {await page.route('**/data/class/index.json',r=>r.fulfill({json:{real:'class-real.json'},headers:{'access-control-allow-origin':'*'}}));await page.route('**/data/class/class-real.json',r=>r.fulfill({json:data,headers:{'access-control-allow-origin':'*'}}));}
 if(data.spell){await page.route('**/data/spells/index.json',r=>r.fulfill({json:{XPHB:'spells-choices.json'},headers:{'access-control-allow-origin':'*'}}));await page.route('**/data/spells/spells-choices.json',r=>r.fulfill({json:{spell:data.spell},headers:{'access-control-allow-origin':'*'}}));}
 await page.route('**/data/skills.json',r=>r.fulfill({json:{skill:['XPHB','PHB'].flatMap(source=>[{name:'运动',ENG_name:'Athletics',source,entries:['原创运动技能概念。']},{name:'察觉',ENG_name:'Perception',source,entries:['原创察觉技能概念。']},{name:'历史',ENG_name:'History',source,entries:['原创历史技能概念。']}])},headers:{'access-control-allow-origin':'*'}}));
 await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const entries:Entry[]=Object.entries(data).flatMap(([kind,values])=>Array.isArray(values)?values.map(r=>({id:`fixture:${kind}:${r.source}:${r.level||0}:${r.ENG_name||r.name}`,kind:kind==='classFeature'||kind==='subclassFeature'?'feature':kind as Entry['kind'],name:r.name,english:r.ENG_name||r.name,source:r.source,edition:r.source==='PHB'?'2014':'2024',packId:'fixture',revision:'1',choices:r.choices,entries:r.entries||[],raw:{...r,_category:kind}})):[]),c=newCharacter();c.name='选择与资源验收';c.automation=newAutomationState();const owner=entries.find(e=>e.kind==='class'&&e.source==='XPHB')!;c.selections=[{id:'class-owner',entry:owner,level:1,quantity:1,equipped:false}];
 for(const [i,value] of (owner.raw.classFeatures||[]).entries()){const ref=typeof value==='string'?value:value.classFeature,[name,cls,source,level,featureSource]=ref.split('|');if(Number(level)!==1)continue;const entry=entries.find(e=>e.kind==='feature'&&e.name===name&&e.raw.className===cls&&e.raw.classSource===source&&e.raw.level===1&&e.source===(featureSource||source));if(entry)c.selections.push({id:'feature-'+i,entry,level:1,quantity:1,equipped:false,parentId:'class-owner',grantKey:`ref:${ref}`});}
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'choices.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});await expect(page.getByRole('tab',{name:/^选择与资源验收（导入）(?:\s*旧卡资料需要核对)?$/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'导入与导出',exact:true})).toHaveCount(0);const editSwitch=page.getByRole('switch',{name:'编辑模式',exact:true});await editSwitch.click();await expect(editSwitch).toHaveAttribute('aria-checked','true');
}

const workspace=(page:Page,label:string)=>page.getByRole('region',{name:`选择${label}`,exact:true});
async function dragWiki(page:Page,name:string,index:number){
 const row=page.locator('.catalog-row').filter({has:page.locator('.entry-name').filter({hasText:new RegExp(`^${name}(?:\\s|$)`)})}).first();
 await row.scrollIntoViewIfNeeded();const from=await row.boundingBox();await page.mouse.move(from!.x+30,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(from!.x+40,from!.y+from!.height/2,{steps:3});
 const slot=page.locator('.choice-slot').nth(index);await expect(slot).toBeVisible();await slot.scrollIntoViewIfNeeded();const to=await slot.boundingBox();await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:16});await page.mouse.up();
 await expect(slot).toContainText(name);await expect(page.locator('.choice-slot.drop-ready')).toHaveCount(0);await expect(page.locator('.pointer-ghost')).toHaveCount(0);
}
async function exitChoice(page:Page){await page.getByRole('button',{name:'返回特性',exact:true}).click();}
async function titleMenu(page:Page,name:string){await page.locator('.feature-group h4').getByRole('button',{name:`职业 ${name} Lv.1`,exact:true}).click({button:'right'});await expect(page.getByRole('menuitem')).toHaveCount(1);}

test('full Features workspace, Wiki skill slots, replacement and delete, gray buttons and one-item toggle persist',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);await page.getByRole('tab',{name:'特性',exact:true}).click();
 const title=page.locator('.feature-group h4').first(),style=await title.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,border:s.borderBottomWidth,font:s.fontWeight};});expect(style.background).toBe('rgba(0, 0, 0, 0)');expect(style.border).toBe('1px');expect(Number(style.font)).toBeGreaterThanOrEqual(600);
 await page.getByRole('button',{name:'起始熟练项 0/2',exact:true}).click();await expect(workspace(page,'起始熟练项')).toBeVisible();await expect(page.locator('.features-page-grid')).toHaveCount(0);await expect(page.locator('.choice-slot')).toHaveCount(2);await expect(page.getByRole('dialog',{name:'选择起始熟练项'})).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'资料版本',exact:true})).toHaveValue('2024');await expect(page.locator('.catalog-row')).toHaveCount(3);expect(await page.locator('.choice-slot').first().evaluate(el=>getComputedStyle(el).borderWidth)).toBe('0px');
 await page.screenshot({path:'evidence/wiki-skill-empty-workspace.png'});await dragWiki(page,'运动',1);await expect(page.locator('.choice-slot').nth(0)).toContainText('等待拖拽');await dragWiki(page,'察觉',0);await dragWiki(page,'历史',0);await workspace(page,'起始熟练项').getByRole('button',{name:'移除历史',exact:true}).click();await expect(page.locator('.choice-slot').nth(0)).toContainText('等待拖拽');await dragWiki(page,'察觉',0);
 await page.screenshot({path:'evidence/wiki-skill-workspace.png'});await exitChoice(page);await expect(page.getByRole('button',{name:'起始熟练项 2/2',exact:true})).not.toHaveClass(/is-pending/);await page.getByRole('button',{name:'起始熟练项 2/2',exact:true}).click();await expect(page.locator('.choice-slot-entry')).toHaveCount(2);await exitChoice(page);
 await page.getByRole('button',{name:'起始装备 0/1',exact:true}).click();await workspace(page,'起始装备').getByRole('button',{name:'方案 A',exact:true}).hover();await tooltipOnTop(page,'4 GP');await workspace(page,'起始装备').getByRole('button',{name:'方案 A',exact:true}).click();await workspace(page,'起始装备').getByRole('button',{name:'领取装备',exact:true}).click();
 const feature=page.locator('[data-feature-id]').filter({hasText:'测试圣职'}).first();await feature.locator('.feature-caption').click();await workspace(page,'测试圣职').getByRole('button',{name:'奇术使',exact:true}).hover();await tooltipOnTop(page,'原创选项：魔法。');await page.screenshot({path:'evidence/inline-choice-workspace-tooltip.png'});await workspace(page,'测试圣职').getByRole('button',{name:'奇术使',exact:true}).click();await exitChoice(page);
 await expect(feature).toContainText('测试圣职：奇术使');await expect(page.locator('.sheet-choice-chip')).toHaveCount(0);await titleMenu(page,'测试职业');await page.getByRole('menuitem',{name:'显示自带选项',exact:true}).click();await expect(page.locator('.sheet-choice-chip')).toHaveCount(2);await expect(page.locator('.sheet-choice-chip.is-pending')).toHaveCount(0);await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('tab',{name:'特性',exact:true}).click();await expect(page.locator('.sheet-choice-chip')).toHaveCount(2);await titleMenu(page,'测试职业');await page.getByRole('menuitem',{name:'隐藏自带选项',exact:true}).click();await expect(page.locator('.sheet-choice-chip')).toHaveCount(0);await expect(feature).toContainText('测试圣职：奇术使');await page.screenshot({path:'evidence/completed-options-hidden.png'});expect(errors).toEqual([]);
});
const externalDirectory=process.env.DND_AUTOMATION_CORE_DATA;
test('real 2024 cleric Wiki feature references retain selected caption and local tooltip',async({page})=>{
 test.skip(!externalDirectory,'Requires external unpublished rules');const data=JSON.parse(readFileSync(`${externalDirectory}/data_class_class-cleric.json`,'utf8').replace(/^\uFEFF/,''));await ready(page,data);await page.getByRole('tab',{name:'特性',exact:true}).click();await page.locator('.feature-group h4').getByRole('button',{name:'职业 牧师 Lv.1',exact:true}).click();await page.locator('.paper').screenshot({path:'evidence/cleric-pending-card.png'});
 await page.locator('[data-feature-id]').filter({hasText:'圣职'}).first().locator('.feature-caption').click();await expect(page.locator('.catalog-row')).toHaveCount(2);await expect(page.getByRole('columnheader',{name:'生命骰',exact:true})).toHaveCount(0);await dragWiki(page,'奇术使',0);await page.locator('.choice-slot-entry').hover();await tooltipOnTop(page,'奥秘');await page.screenshot({path:'evidence/cleric-wiki-choice-tooltip.png'});await exitChoice(page);await expect(page.locator('.feature-caption').filter({hasText:'圣职：奇术使'})).toBeVisible();await page.locator('.paper').screenshot({path:'evidence/cleric-selected-card.png'});
 await page.getByRole('button',{name:'起始装备 0/1',exact:true}).click();await workspace(page,'起始装备').getByRole('button',{name:'方案 A',exact:true}).click();await workspace(page,'起始装备').getByRole('button',{name:'领取装备',exact:true}).click();await page.getByRole('tab',{name:'背包',exact:true}).click();await expect(page.getByRole('button',{name:'金币数量',exact:true})).toHaveText('x7');
});
async function resourceWidget(page:Page,name:string){
 await page.getByRole('tab',{name:'主要',exact:true}).click();const row=page.locator(`.resource-widget[data-resource-name="${name}"]`);for(let i=0;i<30;i++){if(await row.count())return row;const next=page.getByRole('button',{name:'下一页资源',exact:true});if(await next.isDisabled())break;await next.click();}throw Error(`Resource ${name} absent`);
}
async function editResource(page:Page,name:string){const row=await resourceWidget(page,name);await row.locator('.resource-widget-face').click();const editor=page.locator('dialog[open]').filter({has:page.getByRole('spinbutton',{name:'资源上限',exact:true})});await expect(editor).toBeVisible();return editor;}

test('real 2024 fighter progression updates one resource while preserving consumed uses',async({page})=>{
 test.skip(!externalDirectory,'Requires an external, unpublished rule snapshot');const data=JSON.parse(readFileSync(`${externalDirectory}/data_class_class-fighter.json`,'utf8').replace(/^\uFEFF/,''));await ready(page,data);let widget=await resourceWidget(page,'回气');await expect(widget.locator('.resource-formula')).toHaveText('1d10 + 1');
 let row=await editResource(page,'回气');await row.getByRole('spinbutton',{name:'资源剩余',exact:true}).fill('1');await row.getByRole('button',{name:'保存',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('spinbutton',{name:'战士等级',exact:true}).fill('4');await page.getByRole('spinbutton',{name:'战士等级',exact:true}).press('Tab');
 widget=await resourceWidget(page,'回气');await expect(widget.locator('.resource-formula')).toHaveText('1d10 + 4');row=await editResource(page,'回气');await expect(row.getByRole('spinbutton',{name:'资源上限',exact:true})).toHaveValue('3');await expect(row.getByRole('spinbutton',{name:'资源剩余',exact:true})).toHaveValue('2');await page.keyboard.press('Escape');await page.getByRole('tab',{name:'特性',exact:true}).click();await expect(page.locator('.feature-group h4').getByRole('button',{name:'职业 战士 Lv.4',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'起始装备 0/1',exact:true})).toHaveCount(0);await page.screenshot({path:'evidence/fighter-real-desktop.png'});
});
test('resources keep presentation and manual maximum, rest and feature removal follow saved lifecycle',async({page})=>{
 await ready(page);let widget=await resourceWidget(page,'回气');await expect(widget.locator('.resource-formula')).toHaveText('1d10 + 1');let row=await editResource(page,'回气');await row.getByRole('spinbutton',{name:'资源剩余',exact:true}).fill('0');await row.getByRole('spinbutton',{name:'资源上限',exact:true}).fill('5');await expect(row.getByRole('button',{name:'进度条',exact:true})).toHaveCount(0);await row.getByRole('button',{name:'保存',exact:true}).click();await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:/短休|长休/})).toHaveCount(0);await page.keyboard.press('Escape');await page.getByRole('tab',{name:'特性',exact:true}).click();await page.locator('[data-feature-id]').filter({hasText:'测试回气'}).locator('.feature-caption').click({button:'right'});await page.getByRole('menuitem',{name:'移除',exact:true}).click();await page.getByRole('tab',{name:'主要',exact:true}).click();await expect(page.locator('.resource-widget[data-resource-name="回气"]')).toHaveCount(0);
});
test('a multi-group equipment package claims every selected group and its fixed items together',async({page})=>{
 const data=JSON.parse(JSON.stringify(raw));data.class[0].startingEquipment.defaultData=[{a:[{item:'测试剑|XPHB'}],b:[{value:500}]},{a:[{special:'选择装备'}],b:[{special:'另一装备'}]},{_:[{special:'固定装备'}]}];await ready(page,data);await page.getByRole('tab',{name:'特性',exact:true}).click();await expect(page.getByRole('button',{name:'起始装备 0/1',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'起始装备 0/1',exact:true}).click();
 const popup=page.getByRole('region',{name:'选择起始装备',exact:true});await popup.getByRole('button',{name:'领取装备',exact:true}).click();await expect(popup.getByRole('alert')).toContainText('第 1 组');await popup.locator('.choice-options').filter({has:page.getByText('装备选择 1', {exact:true})}).getByRole('button',{name:'方案 a',exact:true}).click();await popup.locator('.choice-options').filter({has:page.getByText('装备选择 2',{exact:true})}).getByRole('button',{name:'方案 b',exact:true}).click();await popup.getByRole('button',{name:'领取装备',exact:true}).click();await page.getByRole('tab',{name:'背包',exact:true}).click();await expect(page.locator('.stock-item').filter({hasText:'测试剑'})).toHaveCount(1);await expect(page.locator('.stock-item').filter({hasText:'另一装备'})).toHaveCount(1);await expect(page.locator('.stock-item').filter({hasText:'固定装备'})).toHaveCount(1);
});
test('trace input stays over the original field and edits update final result at A4 scale',async({page})=>{
 await ready(page);const input=page.getByRole('spinbutton',{name:'力量基础值',exact:true});await input.scrollIntoViewIfNeeded();const before=await input.boundingBox();await input.click();const overlay=page.getByRole('spinbutton',{name:'力量追溯输入',exact:true});await expect(overlay).toBeVisible();const after=await overlay.boundingBox();for(const key of ['x','y','width','height'] as const)expect(Math.abs(before![key]-after![key])).toBeLessThan(1.1);await overlay.fill('16');await overlay.press('Enter');await expect(input).toHaveValue('16');await page.getByRole('button',{name:'护甲等级数据追溯',exact:true}).click();await expect(page.getByRole('dialog',{name:'护甲等级数据追溯'})).toContainText('最终结果');await page.locator('.choice-popup,.value-trace-panel').evaluateAll(async els=>{await Promise.all(els.flatMap(el=>el.getAnimations().map(a=>a.finished)));});await page.screenshot({path:'evidence/trace-desktop.png'});await page.keyboard.press('Escape');
});
test('title menu reclaims equipment once, life dice omit rest entries and reload retains equipment',async({page},testInfo)=>{
 const pageErrors:string[]=[];
 const recordError=(error:Error)=>{if(pageErrors.length<30)pageErrors.push(error.message);};
 page.on('pageerror',recordError);
 // Observe only discrete input events, not pointer movement, and bound the log.
 await page.addInitScript(()=>{
  const events:unknown[]=[];
  const describe=(element:Element|null)=>{
   if(!element)return null;
   const bounds=element.getBoundingClientRect();
   return {tag:element.tagName,role:element.getAttribute('role'),label:element.getAttribute('aria-label'),text:element.textContent?.slice(0,160),bounds:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height}};
  };
  const snapshot=()=>({
   editing:document.querySelector('[role="switch"][aria-label="编辑模式"]')?.getAttribute('aria-checked'),
   chip:describe(document.querySelector('.sheet-choice-chip[data-choice-id="class-owner:equipment:0"]')),
   banner:describe(document.querySelector('.class-compatibility-banner')),
   workspace:describe(document.querySelector('.choice-workspace')),
   saveStatus:document.querySelector('.save-status')?.textContent,
   importDialogOpen:!!document.querySelector('dialog[open] [data-testid="character-file"]')
  });
  for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,event=>{
   const pointer=event as MouseEvent,target=event.target instanceof Element?event.target:null;
   events.push({type,at:performance.now(),x:pointer.clientX,y:pointer.clientY,button:pointer.button,target:describe(target),buttonTarget:describe(target?.closest('button')||null),...snapshot()});
   if(events.length>60)events.shift();
  },true);
  (window as any).__equipmentOpenDiagnostics=()=>({events,snapshot:snapshot()});
 });
 let stage='setup';
 try{
 await ready(page);await page.getByRole('tab',{name:'特性',exact:true}).click();stage='open first equipment workspace';await page.getByRole('button',{name:'起始装备 0/1',exact:true}).click();const equipmentWorkspace=workspace(page,'起始装备');await expect(equipmentWorkspace).toBeVisible();stage='claim first equipment package';await equipmentWorkspace.getByRole('button',{name:'方案 A',exact:true}).click();await equipmentWorkspace.getByRole('button',{name:'领取装备',exact:true}).click();await expect(page.getByRole('button',{name:'起始装备 1/1',exact:true})).toBeVisible();stage='reopen and reclaim equipment';
 await page.locator('.feature-group h4').getByRole('button',{name:'职业 测试职业 Lv.1',exact:true}).click({button:'right'});await expect(page.getByRole('menuitem')).toHaveCount(1);await page.getByRole('menuitem',{name:'隐藏自带选项',exact:true}).click();await page.locator('.feature-group h4').getByRole('button',{name:'职业 测试职业 Lv.1',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'显示自带选项',exact:true}).click();await page.getByRole('button',{name:'起始装备 1/1',exact:true}).click();await expect(equipmentWorkspace).toBeVisible();await equipmentWorkspace.getByRole('button',{name:'领取装备',exact:true}).click();await page.getByRole('tab',{name:'背包',exact:true}).click();await expect(page.locator('.stock-item').filter({hasText:'测试剑'})).toHaveCount(2);
 stage='life dice and reload persistence';await page.getByRole('tab',{name:'主要',exact:true}).click();await page.locator('.hit-dice-groups .hit-die').first().click();const dice=page.getByRole('dialog',{name:'生命骰',exact:true});await expect(dice.getByRole('button',{name:/短休|长休/})).toHaveCount(0);await page.keyboard.press('Escape');await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('tab',{name:'背包',exact:true}).click();await expect(page.locator('.stock-item').filter({hasText:'测试剑'})).toHaveCount(2);
 }catch(error){
  const browser=await page.evaluate(()=>(window as any).__equipmentOpenDiagnostics?.()||{unavailable:'Diagnostics were not installed in this document.'}).catch(captureError=>({unavailable:String(captureError)}));
  await testInfo.attach('equipment-open-diagnostics.json',{body:JSON.stringify({stage,pageErrors,error:error instanceof Error?error.message:String(error),browser},null,2),contentType:'application/json'}).catch(()=>{});
  throw error;
 }finally{page.off('pageerror',recordError);}
});
function spellData(name:string){
 const data=JSON.parse(readFileSync(`${externalDirectory}/data_class_class-${name}.json`,'utf8').replace(/^\uFEFF/,'')),owner=data.class.find((c:any)=>c.source==='XPHB');
 data.spell=Array.from({length:14},(_,i)=>({name:i<5?`原创戏法${i+1}`:`原创法术${i-4}`,ENG_name:`Authored Spell ${i+1}`,source:'XPHB',level:i<5?0:1,classes:{fromClassList:[{name:owner.name,source:'XPHB'}]},entries:[`原创法术选择候选 ${i+1} 的完整概念，用于浏览器验证。`]}));return data;
}

test('real wizard drags cantrips, book and preparations into the shared spell workspace',async({page})=>{
 test.skip(!externalDirectory,'Requires external unpublished rules');await ready(page,spellData('wizard'));await page.getByRole('tab',{name:'特性',exact:true}).click();await page.locator('.paper').screenshot({path:'evidence/wizard-opening-card.png'});
 await page.getByRole('button',{name:'戏法 0/3',exact:true}).click();await expect(page.locator('.catalog-row')).toHaveCount(5);for(let i=1;i<=3;i++)await dragWiki(page,`原创戏法${i}`,i-1);await page.locator('.choice-slot-entry').first().hover();await tooltipOnTop(page,'候选 1 的完整概念');await page.screenshot({path:'evidence/wizard-wiki-spell-workspace.png'});await exitChoice(page);await expect(page.getByRole('button',{name:'戏法 3/3',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/^预备法术 \d+\/\d+$/})).toHaveCount(0);
 await page.getByRole('button',{name:'法术书 0/6',exact:true}).click();for(let i=1;i<=6;i++)await dragWiki(page,`原创法术${i}`,i-1);await dragWiki(page,'原创法术7',0);await workspace(page,'法术书').getByRole('button',{name:'移除原创法术7',exact:true}).click();await dragWiki(page,'原创法术1',0);await exitChoice(page);
 await expect(page.getByRole('button',{name:/^预备法术 \d+\/\d+$/})).toHaveCount(0);await page.getByRole('tab',{name:'法术',exact:true}).click();for(let i=1;i<=4;i++)await page.locator('.spell-library').getByRole('button',{name:`原创法术${i}`,exact:true}).click();
 await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(page.locator('[data-cantrip-group="class-owner"] .spell-stock-tile')).toHaveCount(3);await expect(page.locator('.ordinary-prepared-group .spell-stock-tile')).toHaveCount(4);await expect(page.locator('.spell-library [data-spell-level="1"] .spell-stock-tile')).toHaveCount(7);await page.screenshot({path:'evidence/wizard-selected-spells.png'});
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('tab',{name:'特性',exact:true}).click();await page.getByRole('button',{name:'法术书 6/6',exact:true}).click();await expect(page.locator('.choice-slot-entry')).toHaveCount(6);
});
test('learned caster full slots replace active allocation while keeping learned records',async({page})=>{
 test.skip(!externalDirectory,'Requires external unpublished rules');await ready(page,spellData('sorcerer'));await page.getByRole('tab',{name:'特性',exact:true}).click();await page.getByRole('button',{name:'职业法术 0/2',exact:true}).click();await dragWiki(page,'原创法术1',0);await dragWiki(page,'原创法术2',1);await dragWiki(page,'原创法术3',0);await exitChoice(page);await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(page.locator('.prepared-spell-groups .spell-stock-tile')).toHaveCount(2);await expect(page.locator('.prepared-spell-groups .spell-stock-tile').filter({hasText:'原创法术1'})).toHaveCount(0);
});
test('real cleric selected feature remains and extra cantrip changes drag quota',async({page})=>{
 test.skip(!externalDirectory,'Requires external unpublished rules');await ready(page,spellData('cleric'));await page.getByRole('tab',{name:'特性',exact:true}).click();await page.locator('[data-feature-id]').filter({hasText:'圣职'}).first().locator('.feature-caption').click();await dragWiki(page,'奇术使',0);await exitChoice(page);await expect(page.locator('.feature-caption').filter({hasText:'圣职：奇术使'})).toBeVisible();await page.getByRole('button',{name:'戏法 0/4',exact:true}).click();await expect(page.locator('.choice-slot')).toHaveCount(4);await exitChoice(page);
 await expect(page.getByRole('button',{name:/^预备法术 \d+\/\d+$/})).toHaveCount(0);await page.getByRole('tab',{name:'法术',exact:true}).click();for(let i=1;i<=4;i++)await page.locator('.spell-library').getByRole('button',{name:`原创法术${i}`,exact:true}).click();await expect(page.locator('.ordinary-prepared-group .spell-stock-tile')).toHaveCount(4);
});
test('narrow Wiki drag reveals left slots, returns to Wiki, and preserves trace alignment',async({page})=>{
 await page.setViewportSize({width:430,height:900});await ready(page);await page.getByRole('tab',{name:'特性',exact:true}).click();await page.getByRole('button',{name:'起始熟练项 0/2',exact:true}).click();await dragWiki(page,'运动',0);await expect(page.locator('.wiki-pane')).toBeVisible();await page.getByRole('button',{name:'查看选择',exact:true}).click();await expect(page.locator('.choice-slot').first()).toContainText('运动');await page.locator('.choice-slot-entry').hover();await tooltipOnTop(page,'原创运动技能概念');await page.screenshot({path:'evidence/wiki-choice-narrow.png'});await exitChoice(page);await page.getByRole('tab',{name:'主要',exact:true}).click();const input=page.getByRole('spinbutton',{name:'力量基础值',exact:true});await input.scrollIntoViewIfNeeded();const before=await input.boundingBox();await input.click();const overlay=page.getByRole('spinbutton',{name:'力量追溯输入',exact:true}),after=await overlay.boundingBox();expect(Math.abs(before!.x-after!.x)).toBeLessThan(1.1);expect(Math.abs(before!.y-after!.y)).toBeLessThan(1.1);await overlay.fill('13');await page.getByRole('button',{name:'关闭数据追溯',exact:true}).click();await expect(input).toHaveValue('13');
});
test('closing selection restores the previous Wiki category search and filters',async({page})=>{
 await ready(page);await page.getByRole('tab',{name:'特性',exact:true}).click();await page.getByRole('button',{name:'起始熟练项 0/2',exact:true}).click();await expect(page.locator('.wiki-choice-notice')).toBeVisible();await page.getByRole('searchbox',{name:'术语汇编分类搜索',exact:true}).fill('历史');await expect(page.locator('.catalog-row')).toHaveCount(1);await page.getByRole('button',{name:'退出选择',exact:true}).click();await expect(page.locator('.wiki-choice-notice')).toHaveCount(0);await expect(page.getByRole('searchbox',{name:'职业分类搜索',exact:true})).toHaveValue('');
});
test('custom action choices show every option with a tooltip and can be adjusted after completion',async({page})=>{
 const data=structuredClone(raw) as any;data.class[0].choices=[{id:'macro',label:'宏选择',count:1,options:['custom-action','custom-dice'],optionLabels:{'custom-action':'动作宏','custom-dice':'骰子宏'}}];await ready(page,data);await page.getByRole('tab',{name:'特性',exact:true}).click();await page.getByRole('button',{name:'宏选择 0/1',exact:true}).click();await expect(workspace(page,'宏选择').locator('.choice-option')).toHaveCount(2);await expect(page.locator('.choice-slot')).toHaveCount(0);await workspace(page,'宏选择').getByRole('button',{name:/^(?:✓\s*)?骰子宏$/}).hover();await tooltipOnTop(page,'宏选择');await workspace(page,'宏选择').getByRole('button',{name:/^(?:✓\s*)?骰子宏$/}).click();await exitChoice(page);await page.getByRole('button',{name:'宏选择 1/1',exact:true}).click();await expect(workspace(page,'宏选择').getByRole('button',{name:/^(?:✓\s*)?骰子宏$/})).toHaveAttribute('aria-pressed','true');await workspace(page,'宏选择').getByRole('button',{name:/^(?:✓\s*)?动作宏$/}).click();await exitChoice(page);await page.getByRole('button',{name:'宏选择 1/1',exact:true}).click();await expect(workspace(page,'宏选择').getByRole('button',{name:/^(?:✓\s*)?动作宏$/})).toHaveAttribute('aria-pressed','true');
});

test('opening choices omit preparation while ordinary spell-page clicks and drag slots survive reload',async({page})=>{
 const data=structuredClone(raw) as Record<string,any[]>;Object.assign(data.class[0],{casterProgression:'full',spellcastingAbility:'int',cantripProgression:[3],spellsKnownProgressionFixed:[6],preparedSpellsProgression:[4]});
 data.spell=Array.from({length:10},(_,i)=>({name:`原创独立法术${i}`,ENG_name:`Independent Spell ${i}`,source:'XPHB',level:i<4?0:1,classes:{fromClassList:[{name:'Fixture Class',source:'XPHB'}]},entries:['原创准备操作验收。']}));
 await ready(page,data);await page.getByRole('tab',{name:'特性',exact:true}).click();
 await expect(page.getByRole('button',{name:/^预备法术 \d+\/\d+$/})).toHaveCount(0);await expect(page.locator('.sheet-choice-chip')).toHaveCount(4);
 await page.getByRole('button',{name:'法术书 0/6',exact:true}).click();await dragWiki(page,'原创独立法术4',0);await dragWiki(page,'原创独立法术5',1);await exitChoice(page);await page.getByRole('tab',{name:'法术',exact:true}).click();
 await expect(page.locator('.spell-library [data-spell-level="0"] .spell-stock-level').first()).toHaveText('0');await expect(page.locator('.spell-library [data-spell-level="0"] .spell-stock-level').first()).toHaveAttribute('aria-label','戏法');
 const stock=(name:string)=>page.locator('.spell-library').getByRole('button',{name,exact:true});
 await stock('原创独立法术4').click();await expect(page.locator('.ordinary-prepared-group .spell-stock-tile')).toHaveCount(1);
 const from=await stock('原创独立法术5').boundingBox(),target=page.locator('[data-prepared-slot="2"]'),to=await target.boundingBox();expect(from).toBeTruthy();expect(to).toBeTruthy();
 await page.mouse.move(from!.x+from!.width/2,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:16});await page.mouse.up();await expect(target).toContainText('原创独立法术5');await expect(page.locator('.ordinary-prepared-group .spell-stock-tile')).toHaveCount(2);
 await page.getByRole('tab',{name:'特性',exact:true}).click();await expect(page.getByRole('button',{name:/^预备法术 \d+\/\d+$/})).toHaveCount(0);await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(page.locator('.ordinary-prepared-group .spell-stock-tile')).toHaveCount(2);await expect(page.locator('[data-prepared-slot="2"]')).toContainText('原创独立法术5');await expect(page.locator('.spell-library [data-spell-level="1"] .spell-stock-tile')).toHaveCount(2);
});

test('weapon proficiency chips use translated catalog entities and keep exact source-qualified references',async({page})=>{
 const data=structuredClone(raw) as Record<string,any[]>;const weapons=[['battleaxe','战斧'],['handaxe','手斧'],['light hammer','轻锤'],['warhammer','战锤'],['dagger','匕首']];
 data.class[0].startingProficiencies.weapons=weapons.map(([english])=>`${english}|PHB`);
 data.item=weapons.map(([english,name])=>({name,ENG_name:english,source:'PHB',type:'M',entries:['原创熟练标签与来源检验。']}));
 await ready(page,data);const chips=page.locator('.training-row').filter({has:page.locator('dt').filter({hasText:/^武器$/})});
 for(const [english,name] of weapons){const chip=chips.getByRole('button',{name,exact:true});await expect(chip).toBeVisible();await expect(chip).toHaveAttribute('data-reference',`item:${english}|PHB`);}
 await expect(chips).not.toContainText('|PHB');await chips.getByRole('button',{name:'战斧',exact:true}).hover();const preview=page.locator('.wiki-pane .entry-detail.is-sheet-preview');await expect(preview).toContainText('原创熟练标签与来源检验');await expect(preview.locator('.detail-title')).toContainText('战斧');await expect(preview.locator('.detail-heading')).toContainText('PHB');await expect(page.getByRole('tooltip')).toHaveCount(0);await chips.getByRole('button',{name:'手斧',exact:true}).hover();await expect(preview.locator('.detail-title')).toContainText('手斧');await expect(preview.locator('.detail-title')).not.toContainText('战斧');await page.mouse.move(1,1);await expect(page.locator('.entry-detail.is-sheet-preview')).toHaveCount(0);
 await page.reload({waitUntil:'domcontentloaded'});for(const [,name] of weapons)await expect(chips.getByRole('button',{name,exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.locator('.brand').click();await expect(page.locator('.wiki-pane')).toBeHidden();await chips.getByRole('button',{name:'战斧',exact:true}).hover();const tooltip=page.getByRole('tooltip').last();await expect(tooltip).toContainText('战斧');await expect(tooltip).toContainText('原创熟练标签与来源检验');
});

test('book rituals remain separate from ordinary preparation and survive a no-slot cast and reload',async({page})=>{
 const data=structuredClone(raw) as Record<string,any[]>;Object.assign(data.class[0],{casterProgression:'full',spellcastingAbility:'int',spellsKnownProgressionFixed:[6],preparedSpellsProgression:[4]});
 data.class[0].classFeatures.push('原创书中仪式|测试职业|XPHB|1|XPHB');data.classFeature.push({name:'原创书中仪式',ENG_name:'Original Book Privilege',source:'XPHB',className:'测试职业',classSource:'XPHB',level:1,entries:['你可以施展自己法术书里标记为仪式的法术。这个仪式用法不需要准备该法术。']});
 data.spell=[{name:'原创书内仪式',ENG_name:'Original Book Ritual',source:'XPHB',level:1,meta:{ritual:true},classes:{fromClassList:[{name:'Fixture Class',source:'XPHB'}]},entries:['原创仪式法术验收。']},{name:'原创普通法术',ENG_name:'Original Ordinary Spell',source:'XPHB',level:1,classes:{fromClassList:[{name:'Fixture Class',source:'XPHB'}]},entries:['原创普通法术验收。']}];
 await ready(page,data);await page.getByRole('tab',{name:'特性',exact:true}).click();await page.getByRole('button',{name:'法术书 0/6',exact:true}).click();await dragWiki(page,'原创书内仪式',0);await dragWiki(page,'原创普通法术',1);await exitChoice(page);await page.getByRole('tab',{name:'法术',exact:true}).click();
 const rituals=page.getByRole('region',{name:'书内仪式',exact:true});await expect(rituals).toBeVisible();await expect(rituals.locator('[data-ritual-spell-id]')).toHaveCount(1);await expect(rituals).not.toContainText('原创普通法术');await expect(rituals).toContainText('10 分钟');await expect(page.locator('.ordinary-prepared-group .spell-stock-tile')).toHaveCount(0);
 await rituals.getByRole('button',{name:'原创书内仪式仪式施法',exact:true}).click();await expect(rituals.getByRole('status')).toContainText('已记录仪式施法');await expect(page.locator('.ordinary-prepared-group .spell-stock-tile')).toHaveCount(0);await expect(page.locator('.spell-library [data-spell-level="1"] .spell-stock-tile')).toHaveCount(2);
 await page.locator('.spell-library').getByRole('button',{name:'原创普通法术',exact:true}).click();await expect(page.locator('.ordinary-prepared-group .spell-stock-tile')).toHaveCount(1);await expect(rituals.locator('[data-ritual-spell-id]')).toHaveCount(1);await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(rituals.locator('[data-ritual-spell-id]')).toHaveCount(1);await expect(page.locator('.ordinary-prepared-group .spell-stock-tile')).toHaveCount(1);await expect(page.locator('.spell-library [data-spell-level="1"] .spell-stock-tile')).toHaveCount(2);
});
