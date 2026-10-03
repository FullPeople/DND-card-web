import {beforeEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createIdentity} from '../src/data/automation/identity';
import {importAutomationData,automationHash,loadAutomationData} from '../src/data/automationOverlay';
import {normalizeData} from '../src/data/catalog';
import type {AutomationEnvelope} from '../src/data/automation/protocol';
import shared from '../src/data/automation/shared-files.json';
import fixture from '../src/data/automation/identity.fixture.json';
const cache=vi.hoisted(()=>new Map<string,unknown>());
vi.mock('../src/platform/storage',()=>({readCache:vi.fn(async(key:string)=>cache.get(key)),writeCache:vi.fn(async(key:string,value:unknown)=>{cache.set(key,value);})}));
const envelope=():AutomationEnvelope=>({schemaVersion:1,protocol:3,versionLock:{kiweeChangelogVersion:'synthetic-1',kiweeChangelogDate:'2026-10-03',fetchedAt:'2026-10-03T00:00:00Z',foundryMigrationVersion:[3],toolVersion:'synthetic',inputs:[{url:'https://example.org/input.json',path:'input.json',namespace:'synthetic',role:'catalog',sha256:'a'.repeat(64),bytes:1}]},records:[{identity:createIdentity({kind:'baseitem',source:'XPHB',engName:'Synthetic Armor'}),entryIds:['legacy-armor'],edition:'2024',verdict:'automated',provenance:[{layer:'structured',ref:'synthetic'}],mechanics:{equipmentModel:{category:'heavyArmor',ac:16}},unsupported:[]}]});
const source=async(text:string)=>({url:'https://example.org/automation.json',sha256:await automationHash(text),kiweeVersion:'synthetic-1',toolVersion:'synthetic'});
beforeEach(()=>{cache.clear();vi.unstubAllGlobals();});
it('shared identity and validators have exact reviewed file hashes and identical cross-repository fixture semantics',()=>{
 for(const [file,hash]of Object.entries(shared.files))expect(createHash('sha256').update(readFileSync(`src/data/automation/${file}`)).digest('hex')).toBe(hash);
 for(const [a,b]of fixture.same)expect(createIdentity(a as any).key).toBe(createIdentity(b as any).key);
 for(const [a,b]of fixture.different)expect(createIdentity(a as any).key).not.toBe(createIdentity(b as any).key);
 for(const input of fixture.invalid)expect(()=>createIdentity(input as any)).toThrow();
 expect(readFileSync('src/data/automation/schema-validation.js','utf8')).not.toMatch(/from ["']ajv|require\(["']ajv/);
});
it('binds canonical identities before legacy ids and never mutates the catalogue snapshot',async()=>{
 const raw={baseitem:[{name:'原创护甲',ENG_name:'Synthetic Armor',source:'XPHB',type:'HA',ac:99}]},entries=normalizeData(raw,'synthetic'),before=structuredClone(entries),text=JSON.stringify(envelope()),data=await importAutomationData(text,await source(text));
 const bound=data.bind(entries);expect(bound[0].automation?.mechanics?.equipmentModel?.ac).toBe(16);expect(bound[0].raw.ac).toBe(99);expect(bound[0].automationVersion).toBe(await automationHash(text));expect(entries).toEqual(before);
 const absent=data.bind([{...entries[0],id:'absent',english:'Missing',raw:{ENG_name:'Missing',_category:'baseitem',ac:18}}]);expect(absent[0].automation).toBeUndefined();
});
it('checks SHA and version lock before exposing a usable dataset',async()=>{
 const text=JSON.stringify(envelope()),config=await source(text);
 await expect(importAutomationData(text,{...config,sha256:'b'.repeat(64)})).rejects.toThrow(/哈希/);
 await expect(importAutomationData(text,{...config,kiweeVersion:'another-version'})).rejects.toThrow(/版本/);
 await expect(importAutomationData(text,{...config,toolVersion:'another-tool'})).rejects.toThrow(/版本/);
 const invalid:any=envelope();invalid.records[0].mechanics.entries=['Synthetic body'];const malformed=JSON.stringify(invalid);
 await expect(importAutomationData(malformed,await source(malformed))).rejects.toThrow();
});
it('accepts owned option labels while preventing metadata from adding or changing a signed option reference',async()=>{
 const e=envelope(),target=e.records[0];target.mechanics={grants:[{type:'feature',key:'custom:menu',origin:'rulePackChoice:option',choose:{count:1,from:['menu-a']}}]};const text=JSON.stringify(e),data=await importAutomationData(text,await source(text));const [entry]=normalizeData({baseitem:[{name:'原创条目',ENG_name:'Synthetic Armor',source:'XPHB'}]},'synthetic');entry.automationOptions={'custom:menu':{label:'自创显示标签',options:{'menu-a':{label:'自创选项',reference:'foreign-target'},'menu-b':{label:'伪造候选',reference:'foreign-target'}}}};const bound=data.bind([entry])[0];expect(bound.automationOptions!['custom:menu']).toEqual({label:'自创显示标签',options:{'menu-a':{label:'自创选项',reference:'menu-a'}}});expect(bound.automation!.mechanics!.grants![0].choose!.from).toEqual(['menu-a']);
});
it('rejects forged identities, unsafe formulas, cross-edition references and unreviewed complete verdicts',async()=>{
 for(const modify of [(e:any)=>e.records[0].identity.key='forged',(e:any)=>e.records[0].mechanics.resources=[{key:'unsafe',max:{formula:'@actor.hp'},recovery:[]}],(e:any)=>e.records[0].mechanics.actions=[{type:'cast',activation:'action',target:'other',spell:'missing'}],(e:any)=>e.records[0].unsupported=[{code:'unknown',family:'unknown'}]]){
  const invalid=envelope();modify(invalid);const text=JSON.stringify(invalid);await expect(importAutomationData(text,await source(text))).rejects.toThrow();
 }
});
it('reuses only the same hash-locked offline dataset and fails visibly for invalid network data',async()=>{
 const text=JSON.stringify(envelope()),config=await source(text),fetcher=vi.fn(async()=>new Response(text));vi.stubGlobal('fetch',fetcher);
 expect((await loadAutomationData(config)).status).toBe('ready');expect(fetcher).toHaveBeenCalledTimes(1);
 vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('offline');}));const offline=await loadAutomationData(config);expect(offline.status).toBe('ready');expect(offline.status==='ready'&&offline.cached).toBe(true);
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}')));expect((await loadAutomationData(config,undefined,true)).status).toBe('missing');
 expect((await loadAutomationData({...config,sha256:'b'.repeat(64)})).status).toBe('missing');
});
it('an aborted load cannot publish a dataset or cache a result',async()=>{
 const text=JSON.stringify(envelope()),config=await source(text),controller=new AbortController();controller.abort();vi.stubGlobal('fetch',vi.fn(async()=>new Response(text)));
 expect((await loadAutomationData(config,controller.signal)).status).toBe('missing');expect(cache.size).toBe(0);
});
it('the real versioned artifact validates and carries all core denominators without a complete-coverage claim',async()=>{
 const config=JSON.parse(readFileSync('src/data/automation/default-source.json','utf8')),text=readFileSync(`public/${config.path}`,'utf8'),data=await importAutomationData(text,{sha256:config.sha256,kiweeVersion:config.kiweeVersion,toolVersion:config.toolVersion});
 expect(data.envelope.records).toHaveLength(18789);expect(data.envelope.records.filter(r=>['PHB','XPHB','DMG','XDMG'].includes(r.identity.source)&&['class','subclass','classFeature','subclassFeature','race','subrace','background','feat','optionalfeature','spell','item','baseitem','magicvariant'].includes(r.identity.kind))).toHaveLength(6396);
 expect(data.envelope.records.every(r=>r.verdict==='needsAnnotation')).toBe(true);
},30000);
it('leaves both canonical and compatibility-id matches unbound when a published extension edition conflicts',async()=>{
 const e=envelope();e.records[0].identity=createIdentity({kind:'baseitem',source:'TCE',engName:'Synthetic Armor'});const text=JSON.stringify(e),data=await importAutomationData(text,await source(text));const [entry]=normalizeData({baseitem:[{name:'Original extension armor',ENG_name:'Synthetic Armor',source:'TCE',edition:'classic',type:'HA'}]},'synthetic');entry.edition='2014';expect(data.bind([entry])[0].automation).toBeUndefined();expect(data.bind([{...entry,id:'legacy-armor',english:'Unresolved',raw:{_category:'baseitem'}}])[0].automation).toBeUndefined();
});
