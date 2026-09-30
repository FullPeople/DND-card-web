// No source snapshots or player records are written. Run against a local Vite dev server.
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const out=process.env.DND_SOURCE_AUDIT_OUT;
if(!out)throw Error('Set DND_SOURCE_AUDIT_OUT to an evidence directory outside the repository');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();await page.route('**/source-audit.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>只读资料统计</title>'}));
 await page.goto('http://127.0.0.1:5183/source-audit.html');
 const result=await page.evaluate(async()=>{
  const {loadCatalog}=await import('/src/data/catalog.ts');
  const {sourceConflicts,sourceGroup,SOURCE_GROUPS}=await import('/src/core/sourceCatalog.ts');
  const {default:seed}=await import('/src/data/sourceRegistry.json');
  const registry={...seed},entries=new Map();let progress;const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),300000);
  try{await loadCatalog(batch=>{for(const e of batch)entries.set(e.id,e);},p=>{progress=p;},abort.signal,false,undefined,next=>{for(const [id,meta] of Object.entries(next))registry[id]={...registry[id],...meta,category:seed[id]?.category||(registry[id]?.category==='模组内容'?'模组内容':meta.category||registry[id]?.category)};});}finally{clearTimeout(timer);}
  const rows=[...entries.values()],sources=[...new Set(rows.map(e=>e.source))];
  const editions=Object.fromEntries(['2014','2024'].map(edition=>{const groups=sourceConflicts(rows,edition,registry);return [edition,{groups:groups.length,entries:groups.reduce((n,g)=>n+g.entries.length,0),uncertain:groups.filter(g=>g.uncertain).length,byKind:Object.fromEntries([...new Set(groups.map(g=>g.kind))].map(kind=>[kind,groups.filter(g=>g.kind===kind).length])),conflicts:groups.map(g=>({name:g.name,kind:g.kind,sources:g.entries.map(e=>({source:e.source,date:registry[e.source]?.date,selected:g.latest.includes(e.id)})),uncertain:g.uncertain}))}];}));
  return {at:new Date().toISOString(),complete:!abort.signal.aborted,progress,entryCount:rows.length,sourceCount:sources.length,categories:Object.fromEntries(SOURCE_GROUPS.map(group=>[group,sources.filter(id=>sourceGroup(id,registry,rows.filter(e=>e.source===id))===group).length])),editions};
 });
 writeFileSync(join(out,'source-conflicts.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,editions:Object.fromEntries(Object.entries(result.editions).map(([k,v])=>[k,{...v,conflicts:v.conflicts.filter(g=>g.kind==='class')}]))},null,2));
}finally{await browser.close();}
