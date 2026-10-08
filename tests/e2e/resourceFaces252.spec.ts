import {test,expect,type Locator} from '@playwright/test';
// The size matrix fixture places every single-resource face at its smallest allowed
// footprint, a scaled one-row module and two dense groups. Text must stay inside
// each module box on both bands, in the quickbar and in the editor preview. Names and
// pool labels are allowed to ellipsize, so only numeric readouts are measured.
const fixture='/tests/fixtures/resource-dashboard220/index.html?scenario=sizes';
const TEXT='.rm-readout strong,.rm-readout small,.rm-inline-value,.rm-counter b,.rm-counter-max,.rm-fraction strong,.rm-fraction small,.rm-pool-current,.rm-pool-max,.rm-count-fallback,.rm-ready-count';
async function outside(scope:Locator){return scope.evaluate((el,selector)=>[...el.querySelectorAll('.resource-widget')].flatMap(widget=>{
 const outer=widget.getBoundingClientRect();
 return [...widget.querySelectorAll(selector)].flatMap(node=>{const range=document.createRange();range.selectNodeContents(node);const r=range.getBoundingClientRect();if(!r.width||!r.height)return [];return r.left<outer.left-1||r.right>outer.right+1||r.top<outer.top-1||r.bottom>outer.bottom+1?[`${widget.getAttribute('data-resource-id')}: ${node.className||node.tagName} ${node.textContent}`]:[];});
}),TEXT);}
for(const width of [1280,390])test(`252 ${width}: every face keeps its text inside its box across the size matrix`,async({page})=>{
 await page.setViewportSize({width,height:960});await page.goto(fixture);await page.evaluate(()=>localStorage.clear());await page.reload();
 const bar=page.locator('.fixture-quickbar'),scroll=bar.locator('.resource-widget-scroll');
 await expect(bar.locator('.resource-widget')).toHaveCount(15);
 await expect(bar.locator('[data-resource-id=segments] [data-resource-unit]')).toHaveCount(5);
 await expect(bar.locator('[data-resource-id=matrix] .rm-icon-unit')).toHaveCount(9);
 await expect(bar.locator('[data-resource-id=a] .rm-mini-rail')).toHaveCount(2);
 await expect(bar.locator('[data-resource-id=big] .rm-content .rm-counter')).toHaveText('123456');
 // Two-row and taller modules carry the title band; the one-row module collapses it.
 await expect(bar.locator('[data-resource-id=ring] .rm-head')).toHaveCSS('height','12px');
 await expect(bar.locator('[data-resource-id=half] .rm-head')).toHaveCSS('height','0px');
 expect(await outside(bar)).toEqual([]);
 await scroll.evaluate(el=>{el.scrollTop=el.clientHeight;});
 expect(await outside(bar)).toEqual([]);
 await page.getByTestId('dashboard-open').click();const dialog=page.getByRole('dialog',{name:'仪表盘',exact:true});await expect(dialog.locator('.resource-dashboard')).toBeVisible();
 const preview=dialog.locator('.dashboard-preview');await expect(preview.locator('.resource-widget')).toHaveCount(15);
 expect(await outside(preview)).toEqual([]);
 await preview.locator('.resource-widget-scroll').evaluate(el=>{el.scrollTop=el.clientHeight;});
 expect(await outside(preview)).toEqual([]);
 await expect(dialog.locator('.resource-dashboard')).toHaveAttribute('data-dirty','false');
});
