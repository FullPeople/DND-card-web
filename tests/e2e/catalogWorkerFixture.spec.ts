import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

test('fixed source overrides reach the actual catalog worker and the rendered App',async({page,context})=>{
 await mockSource(page);await suppressAnnouncement(page);
 let workerStarted=false,served=0,normalizerProbe:Promise<unknown>|undefined;
 let finishProbe:()=>void=()=>{};const probeReady=new Promise<void>(resolve=>{finishProbe=resolve;});
 page.on('worker',worker=>{if(worker.url().includes('catalogReader.worker')){
  workerStarted=true;
  // Browser context request events omit nested worker scripts. Observe the
  // actual constructor in the real reader realm and forward every call.
  normalizerProbe=worker.evaluate(async()=>{
   const Original=globalThis.Worker;let nested=0,fallbacks=0;
   globalThis.Worker=new Proxy(Original,{construct(target,args,newTarget){nested++;return Reflect.construct(target,args,newTarget);}});
   try{
    const path='/card/src/data/catalogNormalizer.ts',{catalogNormalizer}=await import(path);
    const normalizer=catalogNormalizer(new AbortController().signal,()=>{fallbacks++;return [{id:'authored-worker-normalizer'}];});
    try{const entries=await normalizer.normalize({},'authored');return {offThread:typeof window==='undefined',nested,fallbacks,ids:entries.map((entry:{id:string})=>entry.id)};}finally{normalizer.dispose();}
   }finally{globalThis.Worker=Original;}
  }).then(value=>({ok:true,value}),error=>({ok:false,error:String(error)}));void normalizerProbe.then(finishProbe);
 }});
 await context.route('**/data/class/class-test.json',async route=>{
  // Keep the real reader alive until its independent realm probe finishes.
  await probeReady;
  served++;
  await route.fulfill({json:{class:[{name:'Worker fixture sentinel',ENG_name:'Worker fixture sentinel',source:'XPHB',hd:{faces:6},classFeatures:[]}]},headers:{'access-control-allow-origin':'*'}});
 });
 await page.goto('/card/?intro=0');
 await expect(page.getByRole('button',{name:'更新资料',exact:true,includeHidden:true})).toBeEnabled();
 expect(workerStarted).toBe(true);expect(served).toBeGreaterThan(0);expect(normalizerProbe).toBeDefined();expect(await normalizerProbe).toEqual({ok:true,value:{offThread:true,nested:0,fallbacks:1,ids:['authored-worker-normalizer']}});
 if((page.viewportSize()?.width||0)<=760)await page.getByRole('button',{name:'Wiki',exact:true}).click();
 await expect(page.locator('.catalog-row').filter({hasText:'Worker fixture sentinel'})).toHaveCount(1);
 await expect(page.locator('.catalog-row').filter({hasText:'测试法师'})).toHaveCount(0);
});
