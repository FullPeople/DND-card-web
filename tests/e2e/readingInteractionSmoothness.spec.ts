import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';

const key='dnd-wiki-reading-progress-v1:book';
async function ready(page:Page){
  await mockSource(page);
  await page.route('**/data/books.json',route=>route.fulfill({json:{book:[{id:'SMOOTH',name:'原创阅读手册',contents:[{name:'第一章'},{name:'第二章'}]}]}}));
  await page.route('**/data/adventures.json',route=>route.fulfill({json:{adventure:[]}}));
  await page.route('**/data/book/book-smooth.json',route=>route.fulfill({json:{bookData:[{id:'SMOOTH',data:[0,1].map(chapter=>({type:'section',name:chapter?'第二章':'第一章',entries:Array.from({length:100},(_,index)=>`原创阅读内容 ${chapter+1}－${index+1}。用于核对滚动位置和章节切换。`)}))}]}}));
  await page.goto('/?reading=book&book=SMOOTH&chapter=0');
  await expect(page.getByRole('region',{name:'章节正文'})).toContainText('原创阅读内容 1－1');
  await expect(page.locator('.reading-volume-content')).toHaveAttribute('aria-busy','false');
}

test('reading search shortcut follows books and adventures without duplicating current-mode history',async({page})=>{
  await ready(page);const nav=page.getByRole('navigation',{name:'阅读内容'}),content=page.locator('.reading-volume-content');
  const before=await page.evaluate(()=>history.length);await nav.getByRole('button',{name:'书籍',exact:true}).click();expect(await page.evaluate(()=>history.length)).toBe(before);
  await content.focus();await page.keyboard.press('/');await expect(page.getByRole('textbox',{name:'搜索书籍'})).toBeFocused();
  await page.keyboard.type('/');await expect(page.getByRole('textbox',{name:'搜索书籍'})).toHaveValue('/');
  await nav.getByRole('button',{name:'冒险',exact:true}).click();await content.focus();await page.keyboard.press('/');await expect(page.getByRole('textbox',{name:'搜索冒险'})).toBeFocused();
});

test('reading scroll batches storage writes and flushes position on chapter, mode and page exit',async({page},info)=>{
  await ready(page);const content=page.locator('.reading-volume-content');
  await page.waitForTimeout(250);
  await page.evaluate(key=>{const original=Storage.prototype.setItem;(window as any).readingWrites=[];Storage.prototype.setItem=function(name,value){if(name===key)(window as any).readingWrites.push(JSON.parse(value));return original.call(this,name,value);};},key);
  const immediate=await content.evaluate(node=>{for(let i=1;i<=90;i++){node.scrollTop=100+i;node.dispatchEvent(new Event('scroll',{bubbles:true}));}return (window as any).readingWrites.length;});
  expect(immediate).toBe(0);await expect.poll(()=>page.evaluate(()=>(window as any).readingWrites.length)).toBe(1);
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).positions['SMOOTH:0'],key)).toBe(190);
  // Change chapters before the next debounce expires; the old chapter must retain its exact last position.
  await content.evaluate(node=>{node.scrollTop=260;node.dispatchEvent(new Event('scroll',{bubbles:true}));});
  await page.getByRole('button',{name:'下一章',exact:true}).click();await expect(page.getByRole('region',{name:'章节正文'})).toContainText('原创阅读内容 2－1');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).positions['SMOOTH:0'],key)).toBe(260);
  await page.getByRole('button',{name:'上一章',exact:true}).click();await expect.poll(()=>content.evaluate(node=>node.scrollTop)).toBe(260);
  await content.evaluate(node=>{node.scrollTop=320;node.dispatchEvent(new Event('scroll',{bubbles:true}));});
  await page.getByRole('navigation',{name:'阅读内容'}).getByRole('button',{name:'规则条目',exact:true}).click();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).positions['SMOOTH:0'],key)).toBe(320);
  await page.getByRole('navigation',{name:'阅读内容'}).getByRole('button',{name:'书籍',exact:true}).click();await expect.poll(()=>content.evaluate(node=>node.scrollTop)).toBe(320);
  await content.evaluate(node=>{node.scrollTop=380;node.dispatchEvent(new Event('scroll',{bubbles:true}));window.dispatchEvent(new PageTransitionEvent('pagehide'));});
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).positions['SMOOTH:0'],key)).toBe(380);
  await page.reload();await expect.poll(()=>content.evaluate(node=>node.scrollTop)).toBe(380);
  await info.attach('reading-scroll-writes.json',{body:JSON.stringify({scrollEvents:90,synchronousWrites:immediate,settledWrites:1,restoredPosition:380},null,2),contentType:'application/json'});
});
