import {createHash} from 'node:crypto';
import {expect,type Page} from '@playwright/test';
import type {Character,Entry} from '../../src/core/model';
import {createIdentity,type Identity} from '../../src/data/automation/identity';
import type {AutomationEnvelope,AutomationRecord} from '../../src/data/automation/protocol';
import {validateAutomation} from '../../src/data/automation/validate';
import {irFixture,normalizeFixtureData} from '../helpers/irFixture';
import {reviewCoreSamples} from '../helpers/reviewedCoreSamples';
const authoredByPage=new WeakMap<Page,Entry[]>();

/** Authored browser fixtures pass the same SHA, worker and full-envelope checks
 * as published data. No imported embedded IR is trusted by this helper. */
export function browserFixtureEnvelope(entries:Entry[]):AutomationEnvelope{
 const distinct=[...new Map(entries.map(entry=>[entry.id,entry])).values()];
 const authored=distinct.map(entry=>entry.automationVersion==='fixture-ir-1'?entry:irFixture(entry,undefined,distinct));
 const packs=new Map(authored.map((entry,i)=>[entry.automation!.identity.packId,distinct[i].packId]));
 const identities=new Map<string,Identity>();
 for(const entry of authored){const {key,...input}=entry.automation!.identity;identities.set(key,createIdentity({...input,packId:packs.get(input.packId)||input.packId}));}
 const identity=(key:string):Identity=>{
  const known=identities.get(key);if(known)return known;
  const [pack,kind,source,engName,classSource,classEngName,subclassSource,subclassEngShortName,level,raceSource,raceEngName,extra]=key.split(':').map(decodeURIComponent);
  const category=({classfeature:'classFeature',subclassfeature:'subclassFeature'} as Record<string,string>)[kind]||kind;
  const result=createIdentity({packId:packs.get(pack)||pack,kind:category,source,engName,...(classSource?{classSource,classEngName}:{}),...(subclassSource?{subclassSource,subclassEngShortName}:{}),...(level?{level:Number(level)}:{}),...(raceSource?{raceSource,raceEngName}:{}),...(extra?{extra}:{})});
  identities.set(key,result);return result;
 };
 const rewrite=(value:any):any=>typeof value==='string'&&value.split(':').length===12?identity(value).key:Array.isArray(value)?value.map(rewrite):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key.split(':').length===12?identity(key).key:key,rewrite(item)])):value;
 const records:AutomationRecord[]=authored.map((entry,i)=>({...entry.automation!,identity:identity(entry.automation!.identity.key),entryIds:[distinct[i].id],...(entry.automation!.mechanics?{mechanics:rewrite(entry.automation!.mechanics)}:{})}));
 // Missing bodies remain narrative identity placeholders, never fabricated
 // numerical rules. Tests needing their mechanics must author the target.
 const keys=new Set(records.map(record=>record.identity.key));
 for(const target of identities.values())if(!keys.has(target.key)){keys.add(target.key);records.push({identity:target,edition:['PHB','DMG'].includes(target.source)?'2014':['XPHB','XDMG'].includes(target.source)?'2024':'both',verdict:'noMechanics',reasonCode:'narrative',provenance:[{layer:'structured',ref:'authored-reference-placeholder'}],unsupported:[]});}
 const envelope:AutomationEnvelope={schemaVersion:1,protocol:3,versionLock:{kiweeChangelogVersion:'authored-browser-1',kiweeChangelogDate:'2026-10-03',fetchedAt:'2026-10-03T00:00:00Z',foundryMigrationVersion:[3],toolVersion:'authored-browser',inputs:[{url:'https://example.org/authored.json',path:'authored.json',namespace:'authored',role:'catalog',sha256:'a'.repeat(64),bytes:1}]},records};
 validateAutomation(envelope);return envelope;
}
export async function installBrowserAutomation(page:Page,entries:Entry[],reload=true){
 const all=[...new Map([...(authoredByPage.get(page)||[]),...entries].map(entry=>[entry.id,entry])).values()];authoredByPage.set(page,all);
 const body=JSON.stringify(browserFixtureEnvelope(all)),sha256=createHash('sha256').update(body).digest('hex'),source={url:`https://example.org/automation/${sha256}.json`,sha256,kiweeVersion:'authored-browser-1',toolVersion:'authored-browser'};
 await page.route(source.url,route=>route.fulfill({body,contentType:'application/json',headers:{'access-control-allow-origin':'*'}}));
 await page.addInitScript(config=>localStorage.setItem('dnd-card:automation-source',JSON.stringify(config)),source);
 if(reload&&/^https?:/.test(page.url())){
  await page.evaluate(config=>localStorage.setItem('dnd-card:automation-source',JSON.stringify(config)),source);await page.reload();
  await page.getByRole('button',{name:'自动化设置',exact:true}).click();await expect(page.getByTestId('automation-data-status')).toContainText(/已读取|已缓存/);await page.keyboard.press('Escape');
 }
 return {source,body};
}
export async function installCardAutomation(page:Page,c:Character,extras:Entry[]=[],reload=true){return installBrowserAutomation(page,[...c.selections.map(row=>row.entry),...extras],reload);}
export function authorBrowserCatalogue(input:Record<string,any>,revision='fixture-1',reviewedCore=false){
 const normalized=normalizeFixtureData(input,revision),entries=reviewedCore?reviewCoreSamples(normalized):normalized,body:Record<string,any[]>={};
 for(const entry of entries){const raw=(input[entry.raw._category||entry.kind]||[]).find((row:any)=>row.name===entry.name&&row.source===entry.source);if(raw?.choices||raw?._authoredMechanics){entry.choices=raw.choices;Object.assign(entry,irFixture(entry,{...entry.automation!.mechanics,...raw._authoredMechanics},entries));}}
 const inlineKeys=new Set(entries.filter(entry=>entry.id.includes('#option:')).map(entry=>entry.automation!.identity.key));
 for(const entry of entries)for(const grant of entry.automation?.mechanics?.grants||[])if(grant.key?.startsWith('text-option:')&&grant.choose?.from?.every(key=>inlineKeys.has(key)))grant.origin='inlineChoice';
 for(const entry of entries){const kind=entry.raw._category||entry.kind;(body[kind]||=[]).push({...entry.raw,name:entry.name,ENG_name:entry.automation!.identity.engName,source:entry.source,entries:entry.raw.entries||entry.entries});}
 return {entries,body};
}
