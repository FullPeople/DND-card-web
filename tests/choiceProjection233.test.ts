import {it,expect} from 'vitest';
import {newCharacter,type Character,type Entry,editionAllows,selectionAllowed} from '../src/core/model';
import {classSpellChoices} from '../src/core/automation/classSpellChoices';
import {sheetChoices} from '../src/core/automation/choices';
import {newAutomationState} from '../src/core/automation/state';
import {casterProfiles,spellOnClassList} from '../src/core/spellcastingRules';
import {classSpellGroups} from '../src/core/spellWorkspace';
import {choicesForSnapshot,type SheetChoicesSnapshot} from '../src/ui/SheetChoicesContext';
import {displayCharacterEdit,applyDisplayCharacterEdit} from '../src/core/displayCharacterEdit';
import {spellState} from '../src/core/characterDetails';
import {validateCharacter} from '../src/core/validation';
const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id,name:id,english:id,kind,raw,edition:'2024',source:'XPHB',packId:'authored',revision:'1',entries:['Original choice projection regression.']});
function fixture(){const c=newCharacter();c.automation=newAutomationState();c.runtime.resources.spent={name:'Spent',current:1,max:7};c.selections=[{id:'owner',entry:entry('Author caster','class',{casterProgression:'full',cantripProgression:[2,3,4],spellsKnownProgression:[2,3,4]}),level:1,quantity:1,equipped:false}];const catalog=Array.from({length:30},(_,i)=>entry(`Authored ${i}`,'spell',{level:i%10,classes:{fromClassList:[{name:'Author caster',source:'XPHB'}]}}));return {c,catalog};}
// The old evaluation ordering is retained independently as a differential oracle.
function oldOptions(c:Character,catalog:Entry[],choice:ReturnType<typeof classSpellChoices>[number]){
 const p=casterProfiles(c).find(p=>p.owner.id===choice.ownerId)!;
 const entries=[...new Map([...catalog,...c.selections.map(s=>s.entry)].filter(e=>e.kind==='spell').map(e=>[e.id,e])).values()];
 const ids=classSpellGroups(c).find(g=>g.profile.owner.id===p.owner.id)?.ids||[];
 return entries.filter(e=>editionAllows(e,c.edition)&&spellOnClassList(e,p)&&(choice.spellKind==='cantrips'?Number(e.raw.level)===0:Number(e.raw.level)>0&&Number(e.raw.level)<=p.maxLevel)).filter(e=>choice.spellKind!=='prepared'||p.pool!=='book'||ids.some(id=>c.selections.find(s=>s.id===id)?.entry.id===e.id)).sort((a,b)=>Number(a.raw.level)-Number(b.raw.level)||a.name.localeCompare(b.name,'zh-CN')).map(entry=>({value:entry.id,label:entry.name,entry,unavailable:selectionAllowed(c,entry)?undefined:'此法术来源尚未启用。'}));
}
it('returns no class spell choices without touching the catalog when there is no active caster',()=>{
 const {c}=fixture();c.selections=[];
 const catalog=new Proxy([] as Entry[],{get(){throw Error('catalog must remain untouched');}});
 expect(classSpellChoices(c,catalog)).toEqual([]);
 c.selections=[{id:'martial',entry:entry('Author martial','class',{}),level:1,quantity:1,equipped:false}];expect(classSpellChoices(c,catalog)).toEqual([]);
 c.selections[0].entry.raw.casterProgression='full';c.profile.enabledSources=[];expect(classSpellChoices(c,catalog)).toEqual([]);
});
it('level-first filtering matches old options across levels, editions, permissions, aliases, duplicates and mutable edits',()=>{
 const {c,catalog}=fixture();catalog.push({...catalog[0],id:'older',source:'PHB',edition:'2014'}, {...catalog[1],id:'expansion',source:'TCE'}, {...catalog[2],id:'wrong',raw:{level:1,classes:{fromClassList:[{name:'Other',source:'XPHB'}]}}});
 c.selections.push({id:'saved-spell',entry:{...catalog[0],name:'Saved snapshot wins'},level:1,quantity:1,equipped:false});
 for(const level of [1,2,3])for(const edition of ['2014','2024'] as const)for(const enabled of [true,false]){
  c.edition=edition;c.selections[0].level=level;c.profile.enabledSources=['PHB','XPHB',...(enabled?['TCE']:[])];c.profile.disabledEntries=enabled?[]:[catalog[1].id];
  for(const choice of classSpellChoices(c,catalog))expect(choice.options).toEqual(oldOptions(c,catalog,choice));
 }
 c.edition='2024';c.profile.enabledSources=['XPHB'];c.profile.disabledEntries=[];
 const before=classSpellChoices(c,catalog);catalog.push(entry('Added in place','spell',{level:0,_spellClasses:{XPHB:{'Author caster':true}}}));expect(classSpellChoices(c,catalog)[0].options).toHaveLength(before[0].options.length+1);
 c.selections[0].entry.raw._castingSource={name:'Different alias',source:'XPHB'};c.selections[0].entry.name='Different alias';c.selections[0].entry.english='Different alias';
 expect(classSpellChoices(c,catalog).every(choice=>choice.options.length===0)).toBe(true);
 c.selections[0].entry.raw._castingSource.name='Author caster';for(const choice of classSpellChoices(c,catalog))expect(choice.options).toEqual(oldOptions(c,catalog,choice));
});
it('immutable UI name/player snapshots share one projection; all mechanics/catalog transitions invalidate it',()=>{
 const {c,catalog}=fixture(),before=JSON.stringify(c),snapshot:SheetChoicesSnapshot={character:c,catalog,choices:sheetChoices(c,catalog)};
 const renamed=applyDisplayCharacterEdit(c,displayCharacterEdit('name','Next name'))!,player=applyDisplayCharacterEdit(renamed,displayCharacterEdit('player','Next player'))!;
 expect(choicesForSnapshot(snapshot,player,catalog)).toBe(snapshot.choices);
 for(const alter of [(x:Character)=>{x.selections[0].level=3;},(x:Character)=>{x.edition='2014';},(x:Character)=>{x.profile.enabledSources=[];},(x:Character)=>{x.automation!.enabled=false;},(x:Character)=>{x.selections=[];},(x:Character)=>{x.spellSettings={...spellState(x),modeOverride:true};}]){
  const next=structuredClone(c);alter(next);const projected=choicesForSnapshot(snapshot,next,catalog);expect(projected).not.toBe(snapshot.choices);expect(projected).toEqual(sheetChoices(next,catalog));
 }
 const nextCatalog=[...catalog,entry('New snapshot','spell',{level:0,_spellClasses:{XPHB:{'Author caster':true}}})];expect(choicesForSnapshot(snapshot,player,nextCatalog)).toEqual(sheetChoices(player,nextCatalog));expect(choicesForSnapshot(snapshot,player,nextCatalog)).not.toBe(snapshot.choices);
 expect(choicesForSnapshot(undefined,c,catalog)).toEqual(snapshot.choices);expect(choicesForSnapshot(snapshot,{...c,id:'other-character'},catalog)).not.toBe(snapshot.choices);
 // Undo/redo can reuse the original immutable snapshot without mutating it.
 expect(choicesForSnapshot(snapshot,c,catalog)).toBe(snapshot.choices);expect(choicesForSnapshot(snapshot,player,catalog)).toBe(snapshot.choices);
 const imported=validateCharacter(JSON.parse(JSON.stringify(player)));expect(choicesForSnapshot(snapshot,imported,catalog)).toEqual(sheetChoices(imported,catalog));expect(imported.runtime.resources.spent.current).toBe(1);expect(JSON.stringify(c)).toBe(before);
});
