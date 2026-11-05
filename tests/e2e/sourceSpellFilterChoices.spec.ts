import {test,expect,type Page} from '@playwright/test';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';
import {specialSpellResource} from '../../src/core/specialSpells';
import {mockSource,suppressAnnouncement,selectSheetPage,waitForCatalog} from './fixtures';
import {savedCharacter} from './reviewedRuleBrowserState';

// Entirely authored source data; no publisher text, original cards or rooms.
function fixture(){
 const spells=Array.from({length:65},(_,i)=>({name:`原创法术${i}`,ENG_name:`AuthoredSpell${String(i).padStart(3,'0')}`,source:'PHB',level:1,school:'N',entries:[]}));
 const owner:Entry={id:'authored-filter-owner',kind:'race',name:'原创法术来源',english:'Authored Filter Owner',source:'PHB',edition:'2014',packId:'authored-filter',revision:'1',entries:[],raw:{name:'原创法术来源',ENG_name:'Authored Filter Owner',source:'PHB',_category:'race',additionalSpells:[{ability:'wis',innate:{'_':{daily:{'1e':[{choose:'level=1|school=N'},{choose:'level=1|school=N'}]}}}}]}};
 const c=newCharacter('2014');c.name='筛选法术完整界面验收';c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'authored-owner',entry:owner,quantity:1,level:1,equipped:false}];c.notes='保留手工备注';c.runtime.resources.manual={name:'手工次数',max:7,current:2};return {c,spells,owner};
}
async function sources(page:Page,f:ReturnType<typeof fixture>){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'authored isolated acceptance'}}));
 await page.route('**/data/class/index.json',route=>route.fulfill({json:{}}));
 await page.route('**/data/spells/index.json',route=>route.fulfill({json:{PHB:'spells-authored-filter.json'}}));
 await page.route('**/data/spells/spells-authored-filter.json',route=>route.fulfill({json:{spell:f.spells}}));
 await page.route('**/data/races.json',route=>route.fulfill({json:{race:[f.owner.raw]}}));
}
async function spellsPage(page:Page){const menu=page.getByRole('button',{name:'功能页',exact:true});if(await menu.isVisible())await menu.click();return selectSheetPage(page,'法术');}
async function spent(page:Page){return expect.poll(async()=>{const c=await savedCharacter(page),row=c.selections.find(row=>row.entry.english==='AuthoredSpell047'&&row.grantKey?.startsWith('source-spell:'));return row?c.runtime.resources[specialSpellResource(row.id,c)]?.current:undefined;}).toBe(0);}
test('actual App searches bounded choices, prevents duplicate slots, casts, saves, reopens and protects readonly viewing',async({page,context})=>{
 const f=fixture(),errors:string[]=[];page.on('pageerror',()=>errors.push('page-error'));await sources(page,f);await page.goto('/card/?intro=0');await waitForCatalog(page);
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'authored-filter.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(f.c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true}),imported=page.getByRole('tab',{name:/筛选法术完整界面验收（导入）/});await expect(review.or(imported)).toBeVisible();if(await review.isVisible())await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();await expect(imported).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');
 const edit=page.getByRole('switch',{name:'编辑模式',exact:true});if(await edit.getAttribute('aria-checked')!=='true')await edit.click();await page.getByRole('button',{name:'自动化设置',exact:true}).click();
 const groups=page.locator('.source-spell-choice').filter({has:page.getByRole('searchbox')}),first=groups.nth(0),second=groups.nth(1);await expect(groups).toHaveCount(2);await expect(first.getByRole('checkbox')).toHaveCount(40);
 await first.getByRole('button',{name:/显示更多法术/}).click();await expect(first.getByRole('checkbox')).toHaveCount(65);await first.getByRole('searchbox').fill('AuthoredSpell047');await first.getByRole('checkbox',{name:/原创法术47/}).check();
 await first.getByRole('searchbox').fill('没有这种法术');await expect(first.getByRole('checkbox',{name:/原创法术47/})).toBeChecked();await expect(first).toContainText('没有匹配的法术');
 await second.getByRole('searchbox').fill('AuthoredSpell047');await expect(second.getByRole('checkbox',{name:/原创法术47/})).toBeDisabled();await expect(second).toContainText('已在本组其他位置选择');await second.getByRole('searchbox').fill('AuthoredSpell050');await second.getByRole('checkbox',{name:/原创法术50/}).check();
 await expect.poll(async()=>Object.values((await savedCharacter(page)).automation!.spellChoices||{}).flat().sort()).toEqual(['AuthoredSpell047|PHB','AuthoredSpell050|PHB']);await page.screenshot({path:test.info().outputPath('filter-choices.png')});await page.keyboard.press('Escape');
 await spellsPage(page);await page.getByRole('button',{name:'原创法术47施放详情',exact:true}).click();const detail=page.getByRole('dialog',{name:'原创法术47施放详情',exact:true});await detail.getByRole('button',{name:'使用',exact:true}).click();await expect(detail.getByRole('spinbutton',{name:'原创法术47剩余次数',exact:true})).toHaveValue('0');await page.keyboard.press('Escape');await spent(page);
 await page.reload();await spent(page);await page.getByRole('button',{name:'自动化设置',exact:true}).click();await first.getByRole('searchbox').fill('AuthoredSpell047');await expect(first.getByRole('checkbox',{name:/原创法术47/})).toBeChecked();await page.getByRole('checkbox',{name:'启用自动计算',exact:true}).uncheck();await page.getByRole('checkbox',{name:'启用自动计算',exact:true}).check();await page.keyboard.press('Escape');await spent(page);
 const other=await context.newPage();await sources(other,f);await other.goto('/card/?intro=0');await expect(other.locator('.card-permission-banner')).toContainText('另一标签页正在编辑');await expect(other.getByRole('switch',{name:'编辑模式',exact:true})).toBeDisabled();await other.getByRole('button',{name:'自动化设置',exact:true}).click();await expect(other.locator('.source-spell-choice').first().getByRole('checkbox').first()).toBeDisabled();await spent(other);await other.close();
 const saved=await savedCharacter(page);expect(saved.notes).toBe(f.c.notes);expect(saved.runtime.resources.manual).toEqual(f.c.runtime.resources.manual);expect(errors).toEqual([]);
});
test('actual App preserves two explicitly declared casting levels beside a filtered choice',async({page})=>{
 const f=fixture();f.owner.raw.additionalSpells[0].innate['_'].daily['1e']=[{choose:{from:['AuthoredSpell047|PHB#1','AuthoredSpell047|PHB#2'],count:2}},{choose:'level=1|school=N'}];await sources(page,f);await page.goto('/card/?intro=0');await waitForCatalog(page);
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'authored-casting-variants.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(f.c)))});const review=page.getByRole('dialog',{name:'导入前核对',exact:true}),imported=page.getByRole('tab',{name:/筛选法术完整界面验收（导入）/});await expect(review.or(imported)).toBeVisible();if(await review.isVisible())await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();await expect(imported).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');
 const edit=page.getByRole('switch',{name:'编辑模式',exact:true});if(await edit.getAttribute('aria-checked')!=='true')await edit.click();await page.getByRole('button',{name:'自动化设置',exact:true}).click();const variants=page.locator('.source-spell-choice').filter({hasNot:page.getByRole('searchbox')});await variants.getByRole('checkbox',{name:/按 1 环施放/}).check();await variants.getByRole('checkbox',{name:/按 2 环施放/}).check();const filtered=page.locator('.source-spell-choice').filter({has:page.getByRole('searchbox')});await filtered.getByRole('searchbox').fill('AuthoredSpell050');await filtered.getByRole('checkbox',{name:/原创法术50/}).check();await page.keyboard.press('Escape');
 const projection=async()=>{const c=await savedCharacter(page),rows=c.selections.filter(row=>row.entry.english==='AuthoredSpell047'&&row.grantKey?.startsWith('source-spell:'));return rows.map(row=>({level:c.spellSettings?.special?.[row.id]?.sourceGrant?.castLevel,active:c.spellSettings?.special?.[row.id]?.sourceGrant?.active,current:c.runtime.resources[specialSpellResource(row.id,c)]?.current})).sort((a,b)=>(a.level||0)-(b.level||0));};
 const expected=[{level:1,active:true,current:1},{level:2,active:true,current:1}];await expect.poll(projection).toEqual(expected);await page.reload();await expect.poll(projection).toEqual(expected);const saved=await savedCharacter(page);expect(saved.runtime.resources.manual).toEqual(f.c.runtime.resources.manual);expect(saved.notes).toBe(f.c.notes);
});
