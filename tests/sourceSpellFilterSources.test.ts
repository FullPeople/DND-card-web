import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute} from 'node:path';
import {normalizeData} from '../src/data/catalog';
import {sourceSpellFilter} from '../src/core/automation/sourceSpellFilter';
import {entryEdition,newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {planSourceSpells} from '../src/core/automation/sourceSpells';

const frozen=process.env.SOURCE_SPELL_FILTER_FROZEN_DIR||process.env.ORDINARY_CASTING_FROZEN_DIR;
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
it.skipIf(!frozen)('checks all frozen input pins and every positive filter declaration without claiming whole-rule acceptance',{timeout:60000},()=>{
 // The existing report supplies immutable input pins only. Its old consumer
 // execution receipt cannot qualify these new modules; a new replay is required.
 const bytes=readFileSync('docs/data/automation-runtime-coverage.json'),lock=JSON.parse(readFileSync('docs/data/automation-runtime-coverage.lock.json','utf8')),report=JSON.parse(bytes.toString());expect(hash(bytes)).toBe(lock.sha256);
 const root=resolve(frozen!),index=JSON.parse(readFileSync(resolve(root,'index.json'),'utf8')),spells=new Map<string,Entry>(),declarations:{owner:Entry;filter:string;path:string;block:number}[]=[];
 expect(report.inputs).toHaveLength(229);let declared=0;
 for(const pin of report.inputs){
  const row=index.rows.find((value:any)=>value.url===pin.url);expect(row,`input pin ${pin.url}`).toBeDefined();expect(row.sha256).toBe(pin.sha256);
  const path=resolve(root,row.path),inside=relative(root,path);expect(isAbsolute(inside)||inside==='..'||inside.startsWith('..\\')||inside.startsWith('../')).toBe(false);
  const content=readFileSync(path);expect(hash(content),`input bytes ${pin.url}`).toBe(pin.sha256);const data=JSON.parse(content.toString()),pack=pin.url.includes('homebrew.')?'kiwee-homebrew':'kiwee';
  for(const entry of normalizeData({spell:data.spell||[]},pin.sha256,pack))spells.set(entry.id,entry);
  for(const [category,items] of Object.entries(data))if(Array.isArray(items))for(const raw of items){
   if(!raw||typeof raw!=='object'||!Array.isArray(raw.additionalSpells))continue;
   const owner=normalizeData({[category]:[raw]},pin.sha256,pack)[0];
   const walk=(value:any,path:string,block:number)=>{
    if(Array.isArray(value)){value.forEach((child,i)=>walk(child,`${path}/${i}`,block));return;}
    if(!value||typeof value!=='object')return;
    if(typeof value.choose==='string'){
     declared++;
     if(owner&&value.choose&&value.choose.split('|').every((clause:string)=>['level','school','subschool','components & miscellaneous','spell attack'].includes(clause.split('=')[0].trim().toLowerCase())))declarations.push({owner,filter:value.choose,path,block});
    }
    for(const [key,child] of Object.entries(value))walk(child,`${path}/${key}`,block);
   };
   raw.additionalSpells.forEach((block:any,i:number)=>walk(block,`additionalSpells/${i}`,i));
  }
 }
 expect(declared).toBe(253);expect(declarations).toHaveLength(58);expect(declarations.filter(row=>row.filter.startsWith('Components'))).toHaveLength(1);expect(new Set(declarations.map(row=>row.owner.source)).size).toBe(11);expect(spells.size).toBeGreaterThan(1000);
 const entries=[...spells.values()];let projected=0,explicitUsageChoices=0;
 for(const declaration of declarations){
  const edition=entryEdition(declaration.owner)==='2024'?'2024':'2014',result=sourceSpellFilter(declaration.filter,entries,edition);
  expect(result.supported,`${declaration.owner.source}/${declaration.path}`).toBe(true);
  const c=newCharacter(edition);c.automation=newAutomationState();c.profile.enabledSources=[...new Set([declaration.owner.source,...entries.map(entry=>entry.source)])];c.selections=[{id:'frozen-filter-owner',entry:declaration.owner,level:20,quantity:1,equipped:false}];c.automation.spellSets={'frozen-filter-owner':declaration.block};
  let plan=planSourceSpells(c,entries);const [,block,kind,gate,...segments]=declaration.path.split('/'),node=segments.pop(),listPath=segments.length?segments.join('/'):'_',expectedKey=JSON.stringify([JSON.stringify(['frozen-filter-owner']),`source-spell:${block}/${kind}/${gate}/${listPath}/choose:${node}`]);
  if(!plan.choices.some(choice=>choice.key===expectedKey&&choice.spells)&&plan.choices.some(choice=>choice.usageModes)){
   // Preserve the existing explicit pool-ownership question. The fixture is a
   // player's chosen shared mode, not a claim that the source implies it.
   expect(c.automation.spellUsageModes).toBeUndefined();c.automation.spellUsageModes=Object.fromEntries(plan.choices.filter(choice=>choice.usageModes).map(choice=>[choice.key,'shared' as const]));explicitUsageChoices++;plan=planSourceSpells(c,entries);
  }
  const target=plan.choices.find(choice=>choice.key===expectedKey&&choice.spells);
  expect(target,`${declaration.owner.source}/${declaration.path}; ${plan.issues.slice(0,3).map(issue=>issue.message).join('; ')}`).toBeDefined();if(target)projected++;
  expect(c.automation.spellChoices).toBeUndefined();expect(c.runtime.resources).toEqual({});
 }
 // This count is visibility of explicit selection controls, never a grant,
 // verified spell effect, accepted feature, or completed book count.
 expect(projected).toBe(58);expect(explicitUsageChoices).toBe(1);
});
