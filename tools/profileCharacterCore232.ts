import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {syncSourceSpells as beforeSourceSpells} from 'direct232-baseline/src/core/automation/sourceSpells';
import {syncAutoResources as beforeResources} from 'direct232-baseline/src/core/resources';
import {hydrateImportedCasting as beforeCasting} from 'direct232-baseline/src/core/castingSnapshot';
import {rememberSourceSpellUses as beforeUses} from 'direct232-baseline/src/core/automation/sourceSpellState';
import {reconcileEquipping as beforeEquipping} from 'direct232-baseline/src/core/automation/equipment';
import {syncFeatures as beforeFeatures} from 'direct232-baseline/src/core/sheet';
import {syncFeatures} from '../src/core/sheet';
import {entryNameIndex} from '../src/core/entryNameIndex';
import {applyDisplayCharacterEdit,displayCharacterEdit} from '../src/core/displayCharacterEdit';
const summary=(values:number[])=>{values.sort((a,b)=>a-b);return {samples:values.length,p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],max:values.at(-1)}};
const results=[];
for(const catalogSize of [100,10000,30000])for(const selectionCount of [20,100]){
 const catalog=Array.from({length:catalogSize},(_,i)=>({id:'entry'+i,name:'Authored Entry '+i,english:'Authored Entry '+i,kind:'feature' as const,edition:'2024' as const,source:'XPHB',packId:'fixture',revision:'1',entries:['Authored fixture text.'],raw:{}})),c=newCharacter();c.automation=newAutomationState();c.selections=catalog.slice(0,selectionCount).map((entry,i)=>({id:'selection'+i,entry,quantity:1,equipped:false,level:1}));c.runtime.resources.manual={name:'Manual',current:2,max:7};const index=entryNameIndex(catalog);
 const before=(name:string)=>{const draft=structuredClone(c);beforeCasting(draft,catalog);beforeUses(draft);draft.name=name;beforeEquipping(c,draft);beforeFeatures(draft,catalog);beforeSourceSpells(draft,catalog);beforeResources(draft,c);const second=structuredClone(draft);beforeCasting(second,catalog);beforeFeatures(second,catalog);beforeResources(second);beforeSourceSpells(second,catalog);return draft;};
 const after=(name:string)=>applyDisplayCharacterEdit(c,displayCharacterEdit('name',name));
 for(const [label,fn] of [['name-before',before],['name-after',after],['grants-before',()=>beforeFeatures(structuredClone(c),catalog)],['grants-after',()=>syncFeatures(structuredClone(c),catalog,undefined,index)]] as const){for(let i=0;i<5;i++)fn('warmup');const timings=[];for(let i=0;i<30;i++){const start=performance.now();fn(i%2?'Short name':'Long character name for repeated display editing 0123456789');timings.push(performance.now()-start);}results.push({catalogSize,selectionCount,label,...summary(timings)});}
}
writeFileSync(process.env.DND_PERF_CORE_OUTPUT||'docs/evidence/direct232/core-performance.json',JSON.stringify({baselineSha:process.env.DND_PERF_BASELINE_SHA,scope:'Node core only; excludes React layout, IndexedDB save, drag events and browser long tasks.',results},null,2));console.log(JSON.stringify(results,null,2));
