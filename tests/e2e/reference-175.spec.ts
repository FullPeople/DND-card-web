import {test,expect} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter,type Entry} from '../../src/core/model';

test('one global query survives navigation and reload without filtering or resetting the catalog',async({page})=>{
 await mockSource(page);
 await page.addInitScript(()=>{if(!localStorage.getItem('dnd-library-v2'))localStorage.setItem('dnd-library-v2',JSON.stringify({active:'class',sortDefaults:2,tabs:{class:{query:'微光术'},race:{query:'过时的种族搜索'}}}));});
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 const search=page.getByRole('textbox',{name:'搜索规则资料'}),tabs=page.getByRole('navigation',{name:'资料分类'});
 await expect(search).toHaveValue('微光术');await expect(page.locator('.catalog-row')).toContainText('测试法师');
 await search.click();await expect(page.locator('.global-result')).toHaveCount(1);await page.getByRole('button',{name:'关闭搜索结果',exact:true}).click();
 await tabs.getByRole('button',{name:'种族',exact:true}).click();await expect(search).toHaveValue('微光术');await expect(page.locator('.catalog-row')).toContainText('测试旅人');
 await search.fill('完全不存在的搜索');await expect(page.locator('.global-results')).toContainText('没有匹配结果');await expect(page.locator('.catalog-row')).toContainText('测试旅人');
 await page.reload();await expect(search).toHaveValue('完全不存在的搜索');await expect(page.locator('.catalog-row')).toContainText('测试旅人');
 await search.fill('微光术');await page.locator('.global-result').click();await expect(page.locator('.detail-heading')).toContainText('微光术');await expect(search).toHaveValue('微光术');
 await tabs.getByRole('button',{name:'种族',exact:true}).click();await expect(search).toHaveValue('微光术');await expect(page.locator('.catalog-row')).toContainText('测试旅人');
});

test('subclasses wrap their full name with a smaller source on a separate line',async({page})=>{
 await mockSource(page);
 const name='来自遥远银月群岛的星光与秘法传承学派';
 await page.route('**/data/class/class-test.json',r=>r.fulfill({json:{class:[{name:'测试法师',source:'XPHB',entries:['职业正文。']}],subclass:Array.from({length:5},(_,i)=>({name:name+i,shortName:'学派'+i,className:'测试法师',classSource:'XPHB',source:'XPHB',entries:['子职正文。']}))}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.locator('.catalog-row').click();
 await page.getByRole('button',{name:'子职',exact:true}).click();const nav=page.locator('.class-subclasses');await expect(nav.locator('button')).toHaveCount(5);
 const layout=await nav.evaluate(node=>{const buttons=[...node.querySelectorAll('button')];return {overflow:node.scrollWidth>node.clientWidth+1,tops:buttons.map(b=>b.getBoundingClientRect().top),rows:buttons.map(b=>{const n=b.querySelector('.subclass-name')!,s=b.querySelector('small')!;return{fits:n.scrollWidth<=n.clientWidth+1,below:s.getBoundingClientRect().top>=n.getBoundingClientRect().bottom-.5,font:parseFloat(getComputedStyle(s).fontSize),main:parseFloat(getComputedStyle(n).fontSize)};})};});
 expect(layout.overflow).toBe(false);expect(new Set(layout.tops).size).toBeGreaterThan(1);expect(layout.rows.every(r=>r.fits&&r.below&&r.font<r.main)).toBe(true);
 await nav.locator('button').first().click();await expect(page.locator('.detail-heading')).toContainText(name+'0');await expect(nav.locator('button')).toHaveCount(5);
 await page.screenshot({path:'test-results/subclass-navigation-175.png'});
});

test('single-line identity labels shrink to fit without a wrapped row',async({page})=>{
 await mockSource(page);const c=newCharacter();
 for(const [kind,name] of [['race','精灵；高等精灵血系（银月群岛）'],['background','银月城皇家历史文献抄录与研究员']] as const){const entry:Entry={id:'fit:'+kind,name,english:name,kind,source:'XPHB',edition:'2024',packId:'test',revision:'1',entries:[],raw:{}};c.selections.push({id:entry.id,entry,quantity:1,level:1,equipped:false});}
 await page.goto('/');await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'fit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗'}).click();
 const labels=page.locator('.overview-identity .identity-title');await expect(labels).toHaveCount(2);
 await expect.poll(()=>labels.evaluateAll(nodes=>nodes.every(n=>{const s=getComputedStyle(n);return s.whiteSpace==='nowrap'&&n.scrollWidth<=n.clientWidth+1&&n.clientHeight<=parseFloat(s.lineHeight)+1;}))).toBe(true);
 expect(await labels.evaluateAll(nodes=>nodes.some(n=>parseFloat(getComputedStyle(n).fontSize)<14))).toBe(true);
 await page.setViewportSize({width:1200,height:850});await expect.poll(()=>labels.evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1))).toBe(true);
 await page.screenshot({path:'test-results/identity-fit-175.png'});
});
