import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {installCardAutomation} from './automationFixtures';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';
import {APP_VERSION,ANNOUNCEMENT_KEY} from '../../src/platform/announcement';

const feedbackUrl='https://github.com/FullPeople/DND-card/issues';
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


test('temporarily hides language options and ignores an old English preference without changing the character',async({page})=>{
 await page.addInitScript(key=>localStorage.setItem(key,'en'),languageKey);await ready(page);
 await expect(page.getByTestId('ui-language')).toHaveCount(0);await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');await expect(page.getByRole('tab',{name:'主要',exact:true})).toBeVisible();
 const c=card();await installCardAutomation(page,c);
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'language-card.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});await expect(page.getByRole('tab',{name:'语言验收角色（导入）',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('.save-status')).toContainText('已保存到本机');const imported=page.getByRole('dialog',{name:'导入与导出',exact:true});await imported.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect(imported).toHaveCount(0);
 const before=await workspace(page),attack=page.locator('[data-quick-id="auto-weapon:language-selection-0:main"]');await expect(attack).toContainText('1d6+4');const formula=await attack.textContent();
 await page.reload();await expect(page.getByTestId('ui-language')).toHaveCount(0);await expect(page.getByRole('tab',{name:'主要',exact:true})).toBeVisible();expect(await workspace(page)).toEqual(before);expect(await attack.textContent()).toBe(formula);
});
test('feedback appears only in announcements with the requested Issues, email and acknowledgement',async({page})=>{
 await mockSource(page);await page.goto('/');const notice=page.locator('.announcement'),feedback=notice.locator('[data-feedback="announcement"]');await expect(notice).toBeVisible();await expect(feedback.getByRole('heading',{name:'问题反馈',exact:true})).toBeVisible();await checkFeedback(feedback.getByRole('link',{name:'GitHub Issues',exact:true}));
 await expect(feedback).toContainText('如果遇到bug或者反馈，请附带使用版本，复现步骤，截图以及描述，提交到以下地方！');await expect(feedback.getByRole('link',{name:'1763086701psw@gmail.com'})).toHaveAttribute('href','mailto:1763086701psw@gmail.com');await expect(page.getByTestId('ui-language')).toHaveCount(0);await expect(page.locator('[data-feedback="card"]')).toHaveCount(0);
 await notice.getByRole('checkbox',{name:'下次版本更新之前不再弹出'}).check();await notice.getByRole('button',{name:'我知道了',exact:true}).click();await expect(notice).toHaveCount(0);expect(await page.evaluate(key=>localStorage.getItem(key),ANNOUNCEMENT_KEY)).toBe(APP_VERSION);
 await page.reload();await expect(page.locator('.paper')).toBeVisible();await expect(notice).toHaveCount(0);await page.getByRole('button',{name:'公告',exact:true}).click();await expect(notice).toBeVisible();await checkFeedback(feedback.getByRole('link',{name:'GitHub Issues',exact:true}));
});
for(const width of [1512,390])test(`Chinese navigation and announcement feedback remain usable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:982});await ready(page);
 for(const name of [/角色簿/,'规则与扩展','导入 / 导出','公告'])await expect(page.locator('.app-header').getByRole('button',{name,exact:typeof name==='string'})).toBeInViewport();
 await expect(page.getByTestId('ui-language')).toHaveCount(0);await expect(page.getByRole('tab',{name:'主要',exact:true})).toBeInViewport();await expect(page.locator('[data-feedback="card"]')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.getByRole('button',{name:'公告',exact:true}).click();await expect(page.locator('.announcement').getByRole('link',{name:'GitHub Issues',exact:true})).toBeInViewport();await page.screenshot({path:test.info().outputPath(`feedback-${width}.png`)});
});
test('legacy reader keeps Chinese navigation, read-only data, refresh and retry with language options removed',async({page,baseURL})=>{
 const c=card();let fetches=0,fail=false;await page.addInitScript(key=>localStorage.setItem(key,'en'),languageKey);
 await page.route('**/language-viewer.json',async route=>{fetches++;await route.fulfill(fail?{status:503,body:'unavailable'}:{json:{dnd_card_web:c}});});
 const wiki:string[]=[];page.on('request',request=>{if(request.url().includes('kiwee.top'))wiki.push(request.url());});
 await page.goto('/?legacyViewer=1&data_url='+encodeURIComponent(new URL('/language-viewer.json',baseURL).href));await expect(page.getByText('2024 · 只读角色卡',{exact:true})).toBeVisible();await expect(page.getByTestId('ui-language')).toHaveCount(0);await expect(page.locator('[data-feedback="card"]')).toHaveCount(0);
 await expect(page.getByLabel('当前生命值',{exact:true})).toBeDisabled();await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('9');expect(fetches).toBe(1);
 fail=true;await page.getByRole('button',{name:'刷新资料',exact:true}).click();await expect(page.getByRole('alert')).toContainText('HTTP 503');await expect(page.getByRole('button',{name:'重试',exact:true})).toBeVisible();expect(fetches).toBe(2);
 fail=false;await page.getByRole('button',{name:'重试',exact:true}).click();await expect(page.getByText('2024 · 只读角色卡')).toBeVisible();await page.reload();await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('9');expect(wiki).toEqual([]);await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'刷新资料',exact:true})).toBeInViewport();await page.screenshot({path:test.info().outputPath('reader-mobile.png')});
});
