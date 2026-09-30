import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';
import {APP_VERSION,ANNOUNCEMENT_KEY} from '../../src/platform/announcement';

const feedbackUrl='https://github.com/FullPeople/obr-suite/issues';
const languageKey='dnd-card:ui-language';
function card(){
 const c=newCharacter();c.name='语言验收角色';c.abilities.str=18;c.abilities.wis=16;c.baseHp=22;c.runtime.hp=9;c.automation=newAutomationState();c.training={weapons:'简易武器'};c.runtime.resources.fixture={name:'保持已用次数',max:3,current:1};
 const entry=(id:string,name:string,english:string,raw:Record<string,unknown>):Entry=>({id,kind:raw.type?'item':'feature',name,english,source:'XPHB',edition:'2024',packId:'fixture',revision:'unchanged-1',entries:['保留中文规则正文。 {@item 语言验收武器|XPHB} 与 {@item 未提供英文标题|XPHB}。'],raw});
 c.selections=[entry('language-weapon','语言验收武器','Language test weapon',{type:'M',weaponCategory:'simple',dmg1:'1d6',dmgType:'P',property:[],bonusWeapon:1}),entry('language-feature','双语条目','Bilingual entry',{}),entry('language-fallback','未提供英文标题','',{type:'W'})].map((entry,i)=>({id:'language-selection-'+i,entry,quantity:1,level:1,equipped:i===0,...(i===0?{weaponAbility:'wis' as const}:{})}));return c;
}
async function workspace(page:Page){return page.evaluate(async()=>{
 const request=indexedDB.open('dnd-card-standalone'),db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{return await new Promise<any>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}
});}
async function ready(page:Page){await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await expect(page.locator('.paper')).toBeVisible();await expect(page.locator('.save-status')).toContainText('已保存到本机');}
async function checkFeedback(link:ReturnType<Page['getByRole']>){await expect(link).toHaveAttribute('href',feedbackUrl);await expect(link).toHaveAttribute('target','_blank');await expect(link).toHaveAttribute('rel',/noopener/);}

test('language switch preserves the complete character, automation results and stored identities through refresh',async({page})=>{
 await ready(page);const select=page.locator('.app-header').getByTestId('ui-language');await expect(select).toHaveValue('zh');await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');await expect(page.getByRole('tab',{name:'主要',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'language-card.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(card())))});await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const before=await workspace(page),attack=page.locator('[data-quick-id="auto-weapon:language-selection-0:main"]');await expect(attack).toContainText('1d6+4');const formula=await attack.textContent();
 await select.selectOption('en');await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.getByRole('button',{name:/Characters/})).toBeVisible();await expect(page.getByRole('tab',{name:'Main',exact:true})).toBeVisible();expect(await workspace(page)).toEqual(before);expect(await attack.textContent()).toBe(formula);
 await page.reload();await expect(select).toHaveValue('en');await expect(page.getByRole('tab',{name:'Main',exact:true})).toBeVisible();expect(await workspace(page)).toEqual(before);expect(await attack.textContent()).toBe(formula);expect(await page.evaluate(key=>localStorage.getItem(key),languageKey)).toBe('en');
 await select.selectOption('zh');await expect(page.getByRole('button',{name:'导入 / 导出',exact:true})).toBeVisible();expect(await workspace(page)).toEqual(before);expect(await attack.textContent()).toBe(formula);
});

test('announcement localizes its controls and keeps the feedback first without changing version acknowledgement',async({page})=>{
 await mockSource(page);await page.goto('/');const notice=page.locator('.announcement');await expect(notice).toBeVisible();await expect(notice.getByRole('heading',{name:'问题反馈',exact:true})).toBeVisible();await checkFeedback(notice.getByRole('link',{name:'GitHub Issues',exact:true}));expect(await notice.locator('.announcement-body').evaluate(node=>node.firstElementChild?.getAttribute('data-feedback'))).toBe('announcement');
 await notice.getByTestId('ui-language').selectOption('en');await expect(notice.getByRole('heading',{name:'Report a problem',exact:true})).toBeVisible();await expect(notice).toContainText('version, steps to reproduce, and screenshots');await expect(notice.getByRole('heading',{name:'Basic automation',exact:true})).toBeVisible();await expect(notice.getByText('Can I create 2014 and 2024 characters?',{exact:true})).toBeVisible();expect(await page.evaluate(key=>localStorage.getItem(key),ANNOUNCEMENT_KEY)).toBeNull();
 await notice.getByRole('checkbox',{name:'Do not show again until the next version update'}).check();await notice.getByRole('button',{name:'Got it',exact:true}).click();await expect(notice).toHaveCount(0);expect(await page.evaluate(key=>localStorage.getItem(key),ANNOUNCEMENT_KEY)).toBe(APP_VERSION);
 await page.reload();await expect(page.locator('.paper')).toBeVisible();await expect(notice).toHaveCount(0);await page.locator('.app-header').getByTestId('ui-language').selectOption('zh');await page.locator('.app-header').getByTestId('ui-language').selectOption('en');await expect(notice).toHaveCount(0);
 await page.evaluate(key=>localStorage.setItem(key,'0.1.3'),ANNOUNCEMENT_KEY);await page.reload();await expect(notice.getByRole('button',{name:'Got it',exact:true})).toBeVisible();await page.screenshot({path:test.info().outputPath('english-announcement.png')});
});

for(const width of [1512,390])test(`English navigation, language and card feedback remain visible at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:982});await ready(page);await page.locator('.app-header').getByTestId('ui-language').selectOption('en');
 for(const name of [/Characters/,'Rules & expansions','Import / Export','Announcements'])await expect(page.locator('.app-header').getByRole('button',{name,exact:typeof name==='string'})).toBeInViewport();
 await expect(page.locator('.app-header').getByTestId('ui-language')).toBeInViewport();await expect(page.getByRole('tab',{name:'Main',exact:true})).toBeInViewport();const feedback=page.locator('[data-feedback="card"]');await checkFeedback(feedback.getByRole('link',{name:'GitHub Issues',exact:true}));await expect(feedback).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:test.info().outputPath(`english-card-${width}.png`)});
});

test('legacy reader translates loading and HTTP errors without refetching on language changes, keeps titles and read-only data',async({page,baseURL})=>{
 const c=card();let fetches=0,fail=false;const release:{run?:()=>void}={};const waiting=new Promise<void>(resolve=>{release.run=resolve;});
 await page.route('**/language-viewer.json',async route=>{fetches++;if(fetches===1)await waiting;await route.fulfill(fail?{status:503,body:'unavailable'}:{json:{dnd_card_web:c}});});
 const wiki:string[]=[];page.on('request',request=>{if(request.url().includes('kiwee.top'))wiki.push(request.url());});
 await page.goto('/?legacyViewer=1&data_url='+encodeURIComponent(new URL('/language-viewer.json',baseURL).href));await expect(page.getByRole('status')).toContainText('正在读取角色资料');await page.getByTestId('ui-language').selectOption('en');await expect(page.getByRole('status')).toContainText('Loading character data');release.run!();await expect(page.getByText('2024 · Read-only character',{exact:true})).toBeVisible();
 await expect(page.getByLabel('当前生命值',{exact:true})).toBeDisabled();await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('9');await checkFeedback(page.locator('[data-feedback="card"]').getByRole('link',{name:'GitHub Issues',exact:true}));expect(fetches).toBe(1);
 await page.getByRole('tab',{name:'Features',exact:true}).click();const firstReference=page.locator('.paper').getByRole('button',{name:'语言验收武器',exact:true});if(!await firstReference.isVisible())await page.locator('.feature-caption').filter({hasText:'双语条目'}).click();await firstReference.click();await expect(page.getByRole('dialog',{name:'Character entry details'}).locator('header strong')).toHaveText('Language test weapon');await expect(page.getByRole('dialog',{name:'Character entry details'})).toContainText('保留中文规则正文');await page.getByRole('button',{name:'Close character entry',exact:true}).click();
 await page.locator('.paper').getByRole('button',{name:'未提供英文标题',exact:true}).click();await expect(page.getByRole('dialog',{name:'Character entry details'}).locator('header strong')).toHaveText('未提供英文标题');await page.getByRole('button',{name:'Close character entry',exact:true}).click();
 await page.getByTestId('ui-language').selectOption('zh');expect(fetches).toBe(1);await expect(page.getByText('2024 · 只读角色卡')).toBeVisible();await page.getByTestId('ui-language').selectOption('en');fail=true;await page.getByRole('button',{name:'Refresh data',exact:true}).click();await expect(page.getByRole('alert')).toContainText('HTTP 503');await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();await page.getByTestId('ui-language').selectOption('zh');await expect(page.getByRole('alert')).toContainText('角色读取失败');expect(fetches).toBe(2);
 fail=false;await page.getByTestId('ui-language').selectOption('en');await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByText('2024 · Read-only character')).toBeVisible();await page.reload();await expect(page.getByTestId('ui-language')).toHaveValue('en');await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('9');expect(wiki).toEqual([]);await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Refresh data',exact:true})).toBeInViewport();await page.screenshot({path:test.info().outputPath('english-reader-mobile.png')});
});
