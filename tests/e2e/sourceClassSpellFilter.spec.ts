import {test,expect,type Page} from '@playwright/test';
import {newCharacter,type Edition,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';
import {specialSpellResource} from '../../src/core/specialSpells';
import {mockSource,suppressAnnouncement,selectSheetPage,waitForCatalog,expandSourceBook} from './fixtures';
import {savedCharacter,storedWorkspace} from './reviewedRuleBrowserState';

// All content is authored. These scenarios do not use publisher prose or player cards.
function fixture(edition:Edition,independentClass=false){
 const source=edition==='2024'?'XPHB':'PHB',other=edition==='2024'?'PHB':'XPHB',classSource=independentClass?'LLMC':source;
 const className=independentClass?'Authored caster':'Wizard',query=independentClass?'Authored caster (LLMag)':'Wizard';
 const spell=(name:string,english:string,ownerSource:string,ownerName=className,school='A')=>({name,ENG_name:english,source,level:1,school,classes:{fromClassList:[{name:ownerName,source:ownerSource}]},entries:[]});
 const spells=[spell('原创候选法术','Authored wanted spell',classSource),spell('异版法表法术','Authored other-edition spell',other),spell('其他职业法术','Authored other-class spell',classSource,'Sorcerer'),spell('其他学派法术','Authored other-school spell',classSource,className,'I')];
 const classes=[{name:className,ENG_name:className,source:classSource,edition:edition==='2024'?'one':'classic',classFeatures:[]},{name:'Wizard',ENG_name:'Wizard',source:other,classFeatures:[]},{name:'Sorcerer',ENG_name:'Sorcerer',source:classSource,classFeatures:[]}];
 const owner:Entry={id:'authored-query-owner:'+edition+':'+classSource,kind:'race',name:'原创法表来源',english:'Authored Class Query Owner',source,edition,packId:'authored-query',revision:'1',entries:[],raw:{name:'原创法表来源',ENG_name:'Authored Class Query Owner',source,_category:'race',additionalSpells:[{ability:'wis',innate:{'_':{daily:{'1e':[{choose:'level=1|class='+query+'|school=A',count:1}]}}}}]}};
 const c=newCharacter(edition);c.name='法表筛选验收 '+edition+(independentClass?' 独立来源':'');c.automation=newAutomationState();c.profile.optional.legacy=false;c.profile.enabledSources=['PHB','XPHB',...(independentClass?['LLMC']:[])];c.notes='保留手工笔记';c.runtime.resources.manual={name:'手工次数',max:9,current:2};c.selections=[{id:'authored-query-owner',entry:owner,quantity:1,level:3,equipped:false}];
 return {c,owner,spells,classes,source,classSource};
}
async function sources(page:Page,f:ReturnType<typeof fixture>){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);const context=page.context(),headers={'access-control-allow-origin':'*',etag:'authored-class-query-1'};
 await context.route('**/api/**',route=>route.fulfill({status:401,json:{error:'authored isolated class query'}}));
 await context.route('**/data/class/index.json',route=>route.fulfill({json:{authored:'class-authored-query.json'},headers}));
 await context.route('**/data/class/class-authored-query.json',route=>route.fulfill({json:{class:f.classes},headers}));
 await context.route('**/data/spells/index.json',route=>route.fulfill({json:{AUTHORED:'spells-authored-query.json'},headers}));
 await context.route('**/data/spells/spells-authored-query.json',route=>route.fulfill({json:{spell:f.spells},headers}));
 await context.route('**/data/generated/gendata-spell-source-lookup.json',route=>route.fulfill({json:{},headers}));
 await context.route('**/data/races.json',route=>route.fulfill({json:{race:[f.owner.raw]},headers}));
}
async function importFixture(page:Page,f:ReturnType<typeof fixture>){
 await page.goto('/card/?intro=0');await waitForCatalog(page);await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 await page.getByTestId('character-file').setInputFiles({name:'authored-class-query.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(f.c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true}),imported=page.getByRole('tab',{name:f.c.name+'（导入）',exact:true});await expect(review.or(imported)).toBeVisible();
 if(await review.isVisible())await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();await expect(imported).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');
 const edit=page.getByRole('switch',{name:'编辑模式',exact:true});if(await edit.getAttribute('aria-checked')!=='true')await edit.click();
}
async function chooseAndCast(page:Page,f:ReturnType<typeof fixture>){
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();const choice=page.getByRole('group',{name:'原创法表来源的赠送法术',exact:true});await expect(choice).toHaveCount(1);
 await expect(choice.getByRole('checkbox')).toHaveCount(1);await choice.getByRole('checkbox',{name:/原创候选法术/}).check();
 await expect.poll(async()=>Object.values((await savedCharacter(page)).automation!.spellChoices||{}).flat()).toEqual(['Authored wanted spell|'+f.source]);
 const selected=await savedCharacter(page);expect(selected.selections.some(row=>row.entry.kind==='class')).toBe(false);
 const records=Object.values(selected.sourceSpellChoiceContexts!.records!);expect(records).toHaveLength(1);expect(records[0].entries).toHaveLength(1);expect(records[0].entries[0]).toMatchObject({kind:'class',source:f.classSource});
 await page.screenshot({path:test.info().outputPath('class-query-choice.png')});await page.keyboard.press('Escape');
 const menu=page.getByRole('button',{name:'功能页',exact:true});if(await menu.isVisible())await menu.click();await selectSheetPage(page,'法术');
 await page.getByRole('button',{name:'原创候选法术施放详情',exact:true}).click();const detail=page.getByRole('dialog',{name:'原创候选法术施放详情',exact:true});await detail.getByRole('button',{name:'使用',exact:true}).click();await expect(detail.getByRole('spinbutton',{name:'原创候选法术剩余次数',exact:true})).toHaveValue('0');await page.keyboard.press('Escape');
 await expect.poll(async()=>{const c=await savedCharacter(page),row=c.selections.find(row=>row.entry.english==='Authored wanted spell'&&row.grantKey?.startsWith('source-spell:'));return row?c.runtime.resources[specialSpellResource(row.id,c)]?.current:undefined;}).toBe(0);
 return savedCharacter(page);
}

for(const edition of ['2014','2024'] as const)test('actual App saves the '+edition+' class identity, casts after reopening and rejects a damaged context import',async({page})=>{
 const f=fixture(edition),errors:string[]=[];page.on('pageerror',()=>errors.push('page-error'));await sources(page,f);await importFixture(page,f);const spent=await chooseAndCast(page,f);await page.reload();await waitForCatalog(page);
 const reopened=await savedCharacter(page);expect(reopened.sourceSpellChoiceContexts).toEqual(spent.sourceSpellChoiceContexts);expect(reopened.runtime.resources).toEqual(spent.runtime.resources);expect(reopened.notes).toBe(f.c.notes);expect(reopened.selections.some(row=>row.entry.kind==='class')).toBe(false);
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();const choice=page.getByRole('group',{name:'原创法表来源的赠送法术',exact:true});await expect(choice.getByRole('checkbox',{name:/原创候选法术/})).toBeChecked();await expect(choice.getByRole('checkbox')).toHaveCount(1);await page.keyboard.press('Escape');
 const before=await storedWorkspace(page),damaged=structuredClone(reopened);Object.values(damaged.sourceSpellChoiceContexts!.records!)[0].entries[0].raw.classSpells=['Authored injected spell|'+f.source];
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'authored-damaged-query.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(damaged)))});
 await expect(page.getByRole('alert').filter({hasText:'法表来源记录'})).toBeVisible();expect(await storedWorkspace(page)).toEqual(before);expect(errors).toEqual([]);
});

test('actual App preserves a spent gift while its independent class-list source is disabled and restored',async({page})=>{
 const f=fixture('2014',true);await sources(page,f);await importFixture(page,f);const spent=await chooseAndCast(page,f),row=spent.selections.find(row=>row.entry.english==='Authored wanted spell')!,resource=specialSpellResource(row.id,spent);
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,'LLMC');const book=page.locator('.source-book').filter({has:page.locator('button[aria-label="设置来源 LLMC"]')});await book.locator('input[type=checkbox]').first().uncheck();await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await expect.poll(async()=>(await savedCharacter(page)).spellSettings?.special?.[row.id]?.sourceGrant?.active).toBe(false);await page.reload();await waitForCatalog(page);const suspended=await savedCharacter(page);expect(suspended.sourceSpellChoiceContexts).toEqual(spent.sourceSpellChoiceContexts);expect(suspended.automation!.spellChoices).toEqual(spent.automation!.spellChoices);expect(suspended.runtime.resources[resource].current).toBe(0);
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,'LLMC');await book.locator('input[type=checkbox]').first().check();await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await expect.poll(async()=>(await savedCharacter(page)).spellSettings?.special?.[row.id]?.sourceGrant?.active).toBe(true);const restored=await savedCharacter(page);expect(restored.runtime.resources[resource].current).toBe(0);expect(restored.runtime.resources.manual).toEqual(f.c.runtime.resources.manual);expect(restored.sourceSpellChoiceContexts).toEqual(spent.sourceSpellChoiceContexts);
});

test('actual App fills the complete two-spell class query and keeps each explicitly separate use after reopening',async({page})=>{
 const f=fixture('2014');f.owner.raw.additionalSpells[0].innate['_'].daily['1e'][0].count=2;
 f.spells.push({...structuredClone(f.spells[0]),name:'原创第二法术',ENG_name:'Authored second wanted spell'});await sources(page,f);await importFixture(page,f);
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();const choice=page.getByRole('group',{name:'原创法表来源的赠送法术',exact:true});await expect(choice).toHaveCount(1);await expect(choice.getByRole('checkbox')).toHaveCount(2);
 await choice.getByRole('checkbox',{name:/原创候选法术/}).check();await choice.getByRole('checkbox',{name:/原创第二法术/}).check();
 await expect.poll(async()=>Object.values((await savedCharacter(page)).automation!.spellChoices||{}).flat().sort()).toEqual(['Authored second wanted spell|PHB','Authored wanted spell|PHB']);
 const selected=await savedCharacter(page);expect(Object.values(selected.sourceSpellChoiceContexts!.records!)).toHaveLength(1);expect(selected.selections.filter(row=>row.entry.kind==='spell')).toHaveLength(2);expect(selected.selections.some(row=>row.entry.kind==='class')).toBe(false);await page.keyboard.press('Escape');
 const menu=page.getByRole('button',{name:'功能页',exact:true});if(await menu.isVisible())await menu.click();await selectSheetPage(page,'法术');await page.getByRole('button',{name:'原创候选法术施放详情',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'原创候选法术施放详情',exact:true});await detail.getByRole('button',{name:'使用',exact:true}).click();await expect(detail.getByRole('spinbutton',{name:'原创候选法术剩余次数',exact:true})).toHaveValue('0');await page.keyboard.press('Escape');
 const balances=async()=>{const c=await savedCharacter(page);return c.selections.filter(row=>row.entry.kind==='spell').map(row=>({name:row.entry.english,current:c.runtime.resources[specialSpellResource(row.id,c)]?.current})).sort((a,b)=>a.name.localeCompare(b.name));};
 const expected=[{name:'Authored second wanted spell',current:1},{name:'Authored wanted spell',current:0}];await expect.poll(balances).toEqual(expected);await page.reload();await waitForCatalog(page);await expect.poll(balances).toEqual(expected);
 const reopened=await savedCharacter(page);expect(reopened.sourceSpellChoiceContexts).toEqual(selected.sourceSpellChoiceContexts);expect(reopened.runtime.resources.manual).toEqual(f.c.runtime.resources.manual);expect(reopened.notes).toBe(f.c.notes);
});
