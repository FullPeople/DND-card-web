import {it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {applyRuntimeCharacterEdit,runtimeValueEdit} from '../src/core/runtimeCharacterEdit';
import {syncFeatures} from '../src/core/sheet';
import {syncAutoResources} from '../src/core/resources';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {rememberSourceSpellUses} from '../src/core/automation/sourceSpellState';
import {createEntryMatcher} from '../src/core/search';
import {normalizeSearch} from '../src/core/searchText';
// Opt-in local CPU comparison. These authored fixtures are not player/device timings.
it.skipIf(!process.env.P0_PERFORMANCE_MEASURE)('records comparable edit and cached-search CPU samples',()=>{
 const c=newCharacter();c.automation=newAutomationState();
 const catalog:Entry[]=Array.from({length:200},(_,i)=>({id:'fixture:'+i,kind:'feature',name:'原创特性 '+i,english:'Authored feature '+i,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:Array.from({length:25},()=> 'Authored fixture text; no upstream or player data.'),raw:{}}));
 c.selections=catalog.map(entry=>({id:entry.id,entry,level:1,quantity:1,equipped:false}));syncFeatures(c,catalog);syncAutoResources(c);syncSourceSpells(c,catalog);
 function measure(run:()=>void){const samples=Array.from({length:20},()=>{const start=performance.now();run();return performance.now()-start;}).sort((a,b)=>a-b);return {medianMs:samples[10],p95Ms:samples[18]};}
 const previous=measure(()=>{const draft=structuredClone(c);rememberSourceSpellUses(draft);draft.runtime.hp=7;syncFeatures(draft,catalog);syncSourceSpells(draft,catalog);syncAutoResources(draft,c);});
 const optimized=measure(()=>{expect(applyRuntimeCharacterEdit(c,runtimeValueEdit('hp',7))!.runtime.hp).toBe(7);});
 const rows=Array.from({length:30000},(_,i)=>({name:'火球术 '+i,english:'Fireball '+i,source:'XPHB'})),query='火球 xphb';
 const legacySearch=measure(()=>{rows.filter(row=>{const text=normalizeSearch(`${row.name} ${row.english} ${row.source} 玩家手册`);return normalizeSearch(query).trim().split(/\s+/).filter(Boolean).every(term=>text.includes(term));});});
 const matcher=createEntryMatcher(query);rows.filter(row=>matcher(row,'玩家手册'));
 const cachedSearch=measure(()=>{rows.filter(row=>matcher(row,'玩家手册'));});
 mkdirSync('.local-evidence',{recursive:true});writeFileSync('.local-evidence/p0-cpu-samples.json',JSON.stringify({scope:'Node CPU only; authored 200-selection card and 30,000 search rows; not real device/room acceptance',previous,optimized,legacySearch,cachedSearch},null,2));
});
