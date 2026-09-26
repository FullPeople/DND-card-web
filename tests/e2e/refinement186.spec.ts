import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter,type Character,type Entry} from '../../src/core/model';
const entry=(kind:Entry['kind'],name:string,raw:Entry['raw']={}):Entry=>({id:`refine186:${kind}:${name}`,kind,name,english:name,source:'XPHB',edition:'2024',packId:'test',revision:'1',raw,entries:['原创验收正文。']});
const add=(c:Character,e:Entry,level=1)=>c.selections.push({id:e.id,entry:e,quantity:1,level,equipped:false});
async function load(page:Page,c:Character){await mockSource(page);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗'}).click();}

test('hit dice keep their existing resource state through repeated clicks, type changes, undo and reload',async({page})=>{
 const c=newCharacter();c.name='生命骰操作验收';add(c,entry('class','奥术旅人',{hd:{faces:6}}),6);add(c,entry('class','持盾者',{hd:{faces:10}}),4);
 c.runtime.resources={'hit-die:6':{name:'生命骰 d6',current:2,max:6,automatic:true,type:'count'},'hit-die:10':{name:'生命骰 d10',current:4,max:4,automatic:true,type:'count'}};
 await load(page,c);await expect(page.locator('.hit-die')).toHaveCount(10);await expect(page.locator('.hit-die.available')).toHaveCount(6);await expect(page.locator('.quickbar-resources')).not.toContainText('生命骰');
 await page.getByRole('button',{name:'d6 生命骰 1，可用',exact:true}).click();const panel=page.getByRole('dialog',{name:'生命骰',exact:true});await expect(panel).toBeVisible();
 await panel.getByRole('button',{name:'生命骰 d6 2',exact:true}).click();await panel.getByRole('button',{name:'生命骰 d6 1',exact:true}).click();await panel.getByRole('button',{name:'生命骰 d6 1',exact:true}).click();
 await expect(page.getByRole('group',{name:'d6：1 / 6',exact:true}).locator('.available')).toHaveCount(1);
 await panel.getByRole('tab',{name:'d10 4/4',exact:true}).click();await panel.getByRole('button',{name:'生命骰 d10 4',exact:true}).click();await expect(page.getByRole('group',{name:'d10：3 / 4',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results-186/hit-dice-open.png'});await page.locator('.brand').click();await expect(panel).toHaveCount(0);
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(page.getByRole('group',{name:'d10：4 / 4',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('group',{name:'d6：1 / 6',exact:true})).toBeVisible();await expect(page.getByRole('group',{name:'d10：4 / 4',exact:true})).toBeVisible();
 const bounds=await page.locator('.dice-cell .cell-content').evaluate(el=>{const outer=el.getBoundingClientRect();return [...el.querySelectorAll('.hit-die svg')].map(d=>{const r=d.getBoundingClientRect();return r.right-outer.right;});});expect(Math.max(...bounds)).toBeLessThanOrEqual(1);
 await page.getByRole('switch',{name:'编辑模式'}).click();await page.getByRole('button',{name:'管理资源',exact:true}).click();await expect(page.locator('.resource-management-item')).toHaveCount(0);
});

test('concentration sigil stays beside the tier and both click and drag smoothly close the departing spell gap',async({page})=>{
 const c=newCharacter();c.name='法阵与法术移动';add(c,entry('class','法师',{hd:{faces:6},casterProgression:'full',preparedSpellsChange:'restLong',preparedSpellsProgression:[4,5,6],spellsKnownProgressionFixed:[6,2,2]}),3);
 for(let i=0;i<7;i++)add(c,entry('spell',`法术 ${i}`,{level:1,duration:[{concentration:i===0}],meta:{ritual:i===1}}));
 await load(page,c);await page.getByRole('tab',{name:'法术',exact:true}).click();
 const focus=page.locator('.spell-concentration');await expect(focus.locator('.spell-concentration-mark')).toBeVisible();await expect(focus.locator('.spell-tile-frame')).toHaveCSS('stroke-dasharray','none');
 const marks=await focus.evaluate(el=>{const a=el.querySelector('.spell-concentration-mark')!.getBoundingClientRect(),b=el.querySelector('.spell-stock-level')!.getBoundingClientRect();return {gap:b.left-a.right,animation:getComputedStyle(el.querySelector('.spell-concentration-mark')!).animationName};});expect(marks.gap).toBeGreaterThanOrEqual(0);expect(marks.animation).toBe('spell-concentration-turn');
 await page.evaluate(()=>{(window as any).reflows=[];const native=Element.prototype.animate;Element.prototype.animate=function(frames:any,options:any){if(Array.isArray(frames)&&frames[0]?.translate)(window as any).reflows.push({id:(this as HTMLElement).dataset.spellId,frames});return native.call(this,frames,options);};});
 await page.getByRole('switch',{name:'编辑模式'}).click();await focus.click();await expect(page.locator('.prepared-cell .spell-stock-tile')).toHaveCount(1);expect(await page.evaluate(()=>(window as any).reflows.filter((v:any)=>v.id).length)).toBeGreaterThanOrEqual(6);
 await page.locator('.prepared-cell .spell-stock-tile').click();await expect(page.locator('.spell-library .spell-stock-tile')).toHaveCount(7);
 await page.evaluate(()=>(window as any).reflows=[]);await page.locator('.spell-library .spell-stock-tile').first().dragTo(page.getByRole('button',{name:'预备空位2',exact:true}));await expect(page.locator('[data-prepared-slot="1"] .spell-stock-tile')).toHaveCount(1);expect(await page.evaluate(()=>(window as any).reflows.filter((v:any)=>v.id).length)).toBeGreaterThan(0);
 await expect(page.locator('.pointer-ghost')).toHaveCount(0);await page.mouse.move(2,2);await page.screenshot({path:'test-results-186/spell-sigil.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.spell-concentration-mark')).toHaveCSS('animation-name','none');
 await page.evaluate(()=>(window as any).reflows=[]);await page.locator('.prepared-cell .spell-stock-tile').click();expect(await page.evaluate(()=>(window as any).reflows.length)).toBe(0);
});

test('crowded multiclass hit dice stay inside their box',async({page})=>{
 const c=newCharacter();for(const faces of [6,8,10,12])add(c,entry('class','职业'+faces,{hd:{faces}}),5);await load(page,c);await expect(page.locator('.hit-die')).toHaveCount(20);
 const clipped=await page.locator('.dice-cell .cell-content').evaluate(el=>{const b=el.getBoundingClientRect();return [...el.querySelectorAll('.hit-die svg')].map(e=>({right:e.getBoundingClientRect().right,edge:b.right})).filter(r=>r.right>r.edge+1);});expect(clipped).toEqual([]);
 await page.screenshot({path:'test-results-186/hit-dice-stacked.png'});
});

test('player overview hides automatic hit dice while retaining ordinary resources',async({page})=>{
 await page.route('**/resources186-harness',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"></head><body><div id="test-root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/tests/e2e/resources179.harness.jsx"></script></body></html>`}));
 await page.goto('/resources186-harness#suite=resources179&bridge='+encodeURIComponent(test.info().project.use.baseURL as string));
 await expect(page.locator('[data-resource-target="hero0"]')).toBeVisible();
 await page.evaluate(()=>{(window as any).cards[0].resources.push({id:'hit-die:6',name:'生命骰 d6',current:3,max:4,type:'count',automatic:true});(window as any).refresh('PLAYER');});
 const card=page.locator('[data-resource-target="hero0"]');await expect(card.locator('.resource179-flow')).not.toContainText('生命骰 d6');await expect(card.locator('.resource179-flow')).toContainText('旅途补给');
});
