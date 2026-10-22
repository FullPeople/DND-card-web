import {writeFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Entry} from '../../src/core/model';
import {exportCharacter} from '../../src/core/export';

const rows=120;
async function frames(page:Page){await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));}
async function ready(page:Page){
  await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await expect(page.locator('.save-status')).toContainText('已保存到本机');
  for(const name of ['甲','乙']){
    const c=newCharacter();c.name=`原创布局测量${name}`;c.selections=Array.from({length:rows},(_,index)=>{
      const entry:Entry={id:`motion:${name}:${index}`,kind:'feature',name:`原创${name}特性${String(index+1).padStart(3,'0')}`,english:'',source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:['原创特性正文，用于验证实际展开和布局过渡。'],raw:{}};
      return {id:`motion-${name}-${index}`,entry,level:1,quantity:1,equipped:false};
    });
    await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:`motion-${name}.json`,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
    await expect(page.getByRole('tab',{name:`原创布局测量${name}（导入）`,exact:true})).toHaveAttribute('aria-selected','true');
    await page.getByRole('dialog',{name:/^导入与导出/}).getByRole('button',{name:'关闭弹窗',exact:true}).click();
  }
  await page.getByRole('tab',{name:'特性',exact:true}).click();await expect(page.getByRole('tab',{name:'特性',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.features-page-grid [data-feature-id]')).toHaveCount(rows);await frames(page);
}
async function instrument(page:Page){await page.evaluate(()=>{
  const meter:any={samples:[],current:undefined,animations:[],reads:[]};(window as any).__featureMotion=meter;
  const hit=(node:Element)=>node instanceof HTMLElement&&node.matches('[data-feature-id]');
  const record=(node:Element,kind:string,started:number)=>{
    if(!hit(node))return;const current=meter.current,row={kind,milliseconds:performance.now()-started,id:(node as HTMLElement).dataset.featureId,character:node.closest<HTMLElement>('.paper')?.dataset.characterId,activeCharacter:document.querySelector<HTMLElement>('.paper')?.dataset.characterId,connected:node.isConnected,phase:current?.painted?'after-paint':'commit'};
    meter.reads.push(row);current?.reads.push(row);
  };
  const rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){const started=performance.now(),result=rect.call(this);record(this,'rect',started);return result;};
  const width=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'offsetWidth')!;
  Object.defineProperty(HTMLElement.prototype,'offsetWidth',{...width,get(){const started=performance.now(),result=width.get!.call(this);record(this,'width',started);return result;}});
  const animate=Element.prototype.animate;Element.prototype.animate=function(keyframes,options){if(hit(this))meter.animations.push({id:(this as HTMLElement).dataset.featureId,keyframes,options});return animate.call(this,keyframes,options);};
  document.addEventListener('click',event=>{
    const button=(event.target as Element)?.closest('.character-tabs [role="tab"]');if(!button||button.getAttribute('aria-selected')==='true')return;
    const current={name:button.textContent,reads:[],painted:false,started:performance.now()};meter.samples.push(current);meter.current=current;
    requestAnimationFrame(()=>requestAnimationFrame(()=>current.painted=true));
  },true);
});}

test('records feature layout reads before first paint during real card switches',async({page},info)=>{
  await ready(page);await instrument(page);
  for(let index=0;index<6;index++){
    const name=index%2?'乙':'甲',tab=page.getByRole('tab',{name:`原创布局测量${name}（导入）`,exact:true});
    await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');await expect(page.locator('.features-page-grid [data-feature-id]').first()).toHaveAttribute('data-feature-id',`motion-${name}-0`);
    await expect.poll(()=>page.locator('.character-tabs').getAttribute('data-switch-paint-ms')).not.toBeNull();await frames(page);
    await page.evaluate(()=>{const meter=(window as any).__featureMotion;meter.current.commitMs=Number(document.querySelector<HTMLElement>('.character-tabs')!.dataset.switchCommitMs);meter.current.paintMs=Number(document.querySelector<HTMLElement>('.character-tabs')!.dataset.switchPaintMs);});
  }
  const samples=await page.evaluate(()=>(window as any).__featureMotion.samples);
  const report=samples.map((sample:any)=>({name:sample.name,commitMs:sample.commitMs,paintMs:sample.paintMs,commitRects:sample.reads.filter((row:any)=>row.phase==='commit'&&row.kind==='rect').length,commitWidths:sample.reads.filter((row:any)=>row.phase==='commit'&&row.kind==='width').length,deferredRects:sample.reads.filter((row:any)=>row.phase==='after-paint'&&row.kind==='rect').length,readMs:sample.reads.reduce((sum:number,row:any)=>sum+row.milliseconds,0)}));
  writeFileSync(info.outputPath('feature-layout-reads.json'),JSON.stringify({scope:'authored 120-feature cards in the actual App; not player-card or room acceptance',report,samples},null,2));
  expect(report).toHaveLength(6);
  if(!process.env.FEATURE_MOTION_BASELINE)for(const sample of report){expect(sample.commitRects).toBe(0);expect(sample.commitWidths).toBe(0);expect(sample.deferredRects).toBe(rows);}
});

test('first edits still animate and rapid switching, unmounting and capture leave no stale baseline',async({page},info)=>{
  await ready(page);await instrument(page);await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
  const feature=page.locator('[data-feature-id="motion-乙-0"]');
  await feature.locator('.feature-caption').click();await expect(feature).toHaveClass(/is-expanded/);await expect(feature.locator('.feature-prose')).toContainText('原创特性正文');
  await expect.poll(()=>page.evaluate(()=>(window as any).__featureMotion.animations.filter((row:any)=>row.keyframes.some((frame:any)=>frame.transform)).length)).toBeGreaterThan(0);
  await page.evaluate(()=>(window as any).__featureMotion.animations=[]);
  await feature.locator('.feature-caption').focus();await page.keyboard.press('Alt+ArrowRight');
  await expect(page.locator('.feature-flow>[data-feature-id]').first()).toHaveAttribute('data-feature-id','motion-乙-1');
  await expect.poll(()=>page.evaluate(()=>(window as any).__featureMotion.animations.filter((row:any)=>row.keyframes.some((frame:any)=>frame.transform)).length)).toBeGreaterThan(0);
  await frames(page);
  await page.evaluate(async()=>{
    const meter=(window as any).__featureMotion;meter.animations=[];
    [...document.querySelectorAll<HTMLButtonElement>('.character-tabs [role="tab"]')].find(tab=>tab.textContent==='原创布局测量甲（导入）')!.click();
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    document.querySelector<HTMLButtonElement>('[data-feature-id="motion-甲-0"] .feature-caption')!.click();
  });
  const firstAlpha=page.locator('[data-feature-id="motion-甲-0"]');await expect(firstAlpha).toHaveClass(/is-expanded/);
  await expect.poll(()=>page.evaluate(()=>(window as any).__featureMotion.animations.filter((row:any)=>row.keyframes.some((frame:any)=>frame.transform)).length)).toBeGreaterThan(0);
  await firstAlpha.locator('.feature-caption').click();await expect(firstAlpha).not.toHaveClass(/is-expanded/);await frames(page);
  await page.evaluate(async()=>{
    const meter=(window as any).__featureMotion;meter.reads=[];
    const tabs=[...document.querySelectorAll<HTMLButtonElement>('.character-tabs [role="tab"]')].filter(tab=>tab.textContent?.startsWith('原创布局测量'));
    for(let index=0;index<8;index++){tabs[index%2].click();await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
    document.querySelector<HTMLButtonElement>('[data-sheet-tab="背景"]')!.click();
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  });
  await expect(page.getByRole('tab',{name:'背景',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('.features-page-grid .feature-groups')).toHaveCount(0);
  const raceReads=await page.evaluate(()=>(window as any).__featureMotion.reads);
  expect(raceReads.filter((row:any)=>!row.connected||row.character!==row.activeCharacter)).toEqual([]);
  writeFileSync(info.outputPath('rapid-transition-reads.json'),JSON.stringify(raceReads,null,2));
  await page.getByRole('tab',{name:'特性',exact:true}).click();await expect(page.locator('.features-page-grid')).toBeVisible();
  await page.evaluate(async()=>{const module='/src/platform/sheetImage.ts';(window as any).__motionCapture=await import(module);});
  const aborted=await page.evaluate(async()=>{
    const pending=(window as any).__motionCapture.captureSheet().then(()=>({ok:true,message:''}),(error:Error)=>({ok:false,message:error.message}));
    requestAnimationFrame(()=>[...document.querySelectorAll<HTMLButtonElement>('.character-tabs [role="tab"]')].find(tab=>tab.textContent==='原创布局测量甲（导入）')!.click());
    return pending;
  });
  expect(aborted.ok).toBe(false);expect(aborted.message).toMatch(/角色|页面|切换/);await expect(page.locator('.paper')).not.toHaveClass(/sheet-export/);
  const alpha=page.locator('[data-feature-id="motion-甲-0"]');await expect(alpha).toBeVisible();
  await alpha.locator('.feature-caption').click();await expect(alpha).toHaveClass(/is-expanded/);
  const capture=await page.evaluate(async()=>{const blob=await (window as any).__motionCapture.captureSheet(),image=await createImageBitmap(blob),result={width:image.width,height:image.height,size:blob.size};image.close();return result;});
  expect(capture.width).toBe(2480);expect(capture.height).toBe(3508);expect(capture.size).toBeGreaterThan(10000);
  await expect(alpha).toHaveClass(/is-expanded/);await expect(alpha.locator('.feature-prose')).toContainText('原创特性正文');await expect(page.locator('.paper')).not.toHaveClass(/sheet-export/);
  await page.screenshot({path:info.outputPath('feature-motion-restored.png')});
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{const meter=(window as any).__featureMotion;meter.reads=[];meter.animations=[];});
  await page.getByRole('tab',{name:'原创布局测量乙（导入）',exact:true}).click();await expect(page.locator('[data-feature-id="motion-乙-0"]')).toBeVisible();await frames(page);
  expect(await page.evaluate(()=>(window as any).__featureMotion.reads)).toEqual([]);
  const beta=page.locator('[data-feature-id="motion-乙-0"]');await beta.locator('.feature-caption').click();await expect(beta).not.toHaveClass(/is-expanded/);
  expect(await page.evaluate(()=>(window as any).__featureMotion.animations)).toEqual([]);
});
