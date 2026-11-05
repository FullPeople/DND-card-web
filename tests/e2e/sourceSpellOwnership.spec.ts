import {test,expect,type Page} from '@playwright/test';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {syncSourceSpells} from '../../src/core/automation/sourceSpells';
import {exportCharacter} from '../../src/core/export';
import {validateCharacter} from '../../src/core/validation';
import {mockSource,suppressAnnouncement,selectSheetPage,waitForCatalog} from './fixtures';
import {savedCharacter} from './reviewedRuleBrowserState';

// Authored collision states only; these cases do not certify any DND rule.
const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id,name:id,english:id,kind,source:'PHB',edition:'2014',packId:'authored-ownership',revision:'1',entries:[],raw:{name:id,ENG_name:id,source:'PHB',_category:kind,...raw}});
function fixture(future:boolean){
 const spell=entry('Authored owned spell','spell',{level:1}),owner=entry('Authored source owner','class',{spellcastingAbility:'wis',additionalSpells:[{prepared:{1:['Authored owned spell|PHB']}}]});
 const c=newCharacter('2014');c.name='手工法术保护验收';c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'authored-owner',entry:owner,level:1,quantity:1,equipped:false}];
 syncSourceSpells(c,[owner,spell]);const row=c.selections.find(s=>s.entry.kind==='spell');if(!row)throw Error('Authored grant setup did not resolve');
 if(future)(c.spellSettings!.special![row.id] as any).futureConfiguration={version:2,retained:['authored sentinel']};
 else {c.selections[c.selections.indexOf(row)]={id:row.id,entry:structuredClone(row.entry),level:1,quantity:1,equipped:false};c.spellSettings!.special![row.id]={mode:'uses',max:7,recovery:'manual',label:'手工保留次数'};}
 c.spellSettings!.prepared=[row.id];c.runtime.resources[`innate-spell:${row.id}`]={name:'手工保留次数',max:7,current:2,locked:true};c.runtime.hp=3;c.notes='保留手工法术、预备和已消耗次数';
 validateCharacter(c);return {c,owner,spell,id:row.id,expected:JSON.parse(JSON.stringify({row:c.selections.find(s=>s.id===row.id),config:c.spellSettings!.special![row.id],prepared:c.spellSettings!.prepared,resources:c.runtime.resources,hp:c.runtime.hp,notes:c.notes}))};
}
async function tab(page:Page,name:'主要'|'法术'){
 const mobile=page.getByRole('button',{name:'功能页',exact:true});if(await mobile.isVisible())await mobile.click();return selectSheetPage(page,name);
}
async function retained(page:Page,f:ReturnType<typeof fixture>){
 await expect.poll(async()=>{const c=await savedCharacter(page);return JSON.stringify({row:c.selections.find(s=>s.id===f.id),config:c.spellSettings?.special?.[f.id],prepared:c.spellSettings?.prepared,resources:c.runtime.resources,hp:c.runtime.hp,notes:c.notes});}).toBe(JSON.stringify(f.expected));
}
for(const future of [false,true])test(`actual App preserves ${future?'future-owned':'manual'} spell collision through unrelated edits, reopen and readonly viewing`,async({page,context})=>{
 test.setTimeout(120000);const f=fixture(future),errors:string[]=[];page.on('pageerror',()=>errors.push('page-error'));
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);await context.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated authored acceptance'}}));
 await context.route('**/data/class/index.json',route=>route.fulfill({json:{authored:'class-authored-ownership.json'}}));
 await context.route('**/data/class/class-authored-ownership.json',route=>route.fulfill({json:{class:[f.owner.raw]}}));
 await context.route('**/data/spells/index.json',route=>route.fulfill({json:{PHB:'spells-authored-ownership.json'}}));
 await context.route('**/data/spells/spells-authored-ownership.json',route=>route.fulfill({json:{spell:[f.spell.raw]}}));
 await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');await waitForCatalog(page);
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'authored-collision.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(f.c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true}),imported=page.getByRole('tab',{name:/手工法术保护验收（导入）/});await expect(review.or(imported)).toBeVisible();if(await review.isVisible())await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();await expect(imported).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');
 const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});if(await toggle.getAttribute('aria-checked')!=='true')await toggle.click();
 await retained(page,f);const panel=await tab(page,'主要');await panel.getByRole('spinbutton',{name:'力量基础值',exact:true}).click();const trace=page.getByRole('dialog',{name:'力量数据追溯',exact:true}),input=trace.getByRole('spinbutton',{name:'力量追溯输入',exact:true});await input.fill('13');await input.press('Enter');
 await expect.poll(async()=>(await savedCharacter(page)).abilities.str).toBe(13);await retained(page,f);await tab(page,'法术');await page.reload();await retained(page,f);
 const other=await context.newPage();await other.goto('/card/?intro=0');await expect(other.locator('.card-permission-banner')).toContainText('另一标签页正在编辑');await expect(other.getByRole('switch',{name:'编辑模式',exact:true})).toBeDisabled();await retained(other,f);await other.close();await retained(page,f);expect(errors).toEqual([]);
});
