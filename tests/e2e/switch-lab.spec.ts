import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';

async function ready(page:Page){await expect(page.locator('#lab-stage')).toHaveAttribute('data-ready','true');await expect(page.locator('#lab-run')).toBeEnabled();}
async function report(page:Page){const download=page.waitForEvent('download');await page.locator('#lab-export').click();const file=await (await download).path();const result=JSON.parse(await readFile(file!,'utf8'));await writeFile(test.info().outputPath(`measurements-${result.mode}-${result.legacyFade?'fade':'opaque'}.json`),JSON.stringify(result,null,2));return result;}
async function run(page:Page){await page.locator('#lab-run').click();await expect(page.locator('#lab-status')).toHaveText('三轮完成 · 原角色内容完整相同');const result=await report(page);expect(result.samples).toHaveLength(12);expect(result.unchanged).toBe(true);expect(result.samples.every((row:any)=>row.blankFrames===0&&row.wrongCardFrames===0)).toBe(true);return result;}

test('minimal page loads no React, rules or production style; retained native contents never rebuild',async({page},info)=>{
 const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
 await page.addInitScript(()=>{localStorage.setItem('dnd-source-display','{"protected":true}');localStorage.setItem('dnd-sheet-display','a4');});
 await page.goto('./');await ready(page);const result=await run(page);
 expect(requests.some(url=>/\/api\/|wiki|realCard-|client-|validation-|CardDecoration-|bard-|cleric-/.test(url))).toBe(false);
 expect(result.samples.every((row:any)=>Object.values(row.counts).every(value=>value===0))).toBe(true);
 expect(await page.evaluate(()=>({...localStorage}))).toEqual({'dnd-source-display':'{"protected":true}','dnd-sheet-display':'a4'});
 await info.attach('native-report',{body:JSON.stringify(result,null,2),contentType:'application/json'});
});

for(const mode of ['react','compute','cached','retained'])test(`${mode}: compare the actual layer with unchanged character contents`,async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.goto('./');await ready(page);await page.locator('#lab-mode').selectOption(mode);await ready(page);
 const result=await run(page);expect(errors).toEqual([]);
 if(mode==='retained')expect(result.samples.every((row:any)=>Object.values(row.counts).every(value=>value===0))).toBe(true);
 if(mode==='compute')expect(result.samples.every((row:any)=>row.counts.evaluations===1&&row.counts.choices===1&&row.counts.commits>0)).toBe(true);
 if(mode==='cached')expect(result.samples.every((row:any)=>row.counts.evaluations===0&&row.counts.choices===0&&row.counts.commits>0)).toBe(true);
 if(mode==='react')expect(result.samples.every((row:any)=>row.counts.evaluations===0&&row.counts.commits>0)).toBe(true);
 expect(result.samples.every((row:any)=>row.opacity===1)).toBe(true);
 await info.attach(`${mode}-report`,{body:JSON.stringify(result,null,2),contentType:'application/json'});
 if(mode==='retained')await page.screenshot({path:info.outputPath('retained-real-card.png')});
});

test('legacy fade is visible in the same frame; revised retained cards stay opaque in A4 and with original decoration',async({page},info)=>{
 await page.goto('./');await ready(page);await page.locator('#lab-mode').selectOption('retained');await ready(page);
 await page.locator('#lab-display').selectOption('a4');await ready(page);await page.locator('#lab-decoration').check();await ready(page);
 const revised=await run(page);expect(revised.samples.every((row:any)=>row.opacity===1)).toBe(true);
 await page.locator('#lab-legacy-fade').check();await page.locator('#lab-clear').click();const legacy=await run(page);
 expect(legacy.samples.some((row:any)=>row.opacity<.99)).toBe(true);
 await info.attach('fade-comparison',{body:JSON.stringify({revised,legacy},null,2),contentType:'application/json'});
});

test('invalid import is atomic; local imported cards never leave memory or enter the metric report',async({page},info)=>{
 const {authoredCards}=await import('../../switch-lab/cards');const cards=authoredCards(12);cards[0].name='PRIVATE_NAME_NOT_IN_REPORT';
 const body=JSON.stringify({characters:cards}),requests:string[]=[];page.on('request',request=>requests.push(request.url()));
 await page.goto('./');await ready(page);
 await page.locator('#lab-import').setInputFiles({name:'private.json',mimeType:'application/json',buffer:Buffer.from(body)});await expect(page.locator('#lab-tabs button').first()).toHaveText(cards[0].name);await ready(page);
 await page.locator('#lab-mode').selectOption('retained');await ready(page);const result=await run(page);
 const text=JSON.stringify(result);expect(text).not.toContain(cards[0].name);expect(text).not.toContain(cards[0].id);
 await page.locator('#lab-import').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"characters":[{"bad":true}]}')});await expect(page.locator('#lab-status')).not.toHaveText('三轮完成 · 原角色内容完整相同');expect(await page.locator('#lab-tabs button').first().textContent()).toBe(cards[0].name);
 expect(requests.some(url=>/\/api\/|\.json(?:\?|$)/.test(url))).toBe(false);
 await page.reload();await ready(page);await expect(page.locator('#lab-tabs button').first()).not.toHaveText(cards[0].name);
 await info.attach('private-import-metrics',{body:JSON.stringify(result,null,2),contentType:'application/json'});
});

test('private local corpus: compare cached rendering with retained surfaces without modifying originals',async({page},info)=>{
 test.skip(!process.env.DND_SWITCH_LAB_PRIVATE,'Private existing card corpus is opt-in and never committed.');
 const body=await readFile(process.env.DND_SWITCH_LAB_PRIVATE!);await page.goto('./');await ready(page);
 await page.locator('#lab-import').setInputFiles({name:'private-local-corpus.json',mimeType:'application/json',buffer:body});await ready(page);
 const runs=[];for(const mode of ['cached','retained','retained','cached']){
  await page.locator('#lab-mode').selectOption(mode);await ready(page);const result=await run(page);runs.push(result);
  if(mode==='retained')expect(result.samples.every((row:any)=>Object.values(row.counts).every(value=>value===0)&&row.opacity===1)).toBe(true);
 }
 await writeFile(info.outputPath('private-corpus-metrics-only.json'),JSON.stringify(runs,null,2));
});
