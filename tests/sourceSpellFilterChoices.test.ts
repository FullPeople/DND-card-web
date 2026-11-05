import {expect,it} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {planSourceSpells,setSourceSpellChoices,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {performSpellAction,spellActionRequest} from '../src/core/automation/actions';
import {specialSpellResource} from '../src/core/specialSpells';
import {readCharacter} from '../src/core/validation';

const spell=(name:string,raw:Entry['raw'],source='PHB'):Entry=>({id:`authored:${source}:${name}`,kind:'spell',name,english:name,source,edition:source==='XPHB'?'2024':'2014',packId:'authored-filter',revision:'1',entries:[],raw});
const catalog=[spell('Ash',{level:1,school:'N',meta:{ritual:true}}),spell('Mist',{level:1,school:'I'}),spell('Ember',{level:2,school:'N',meta:{ritual:true}})];
function setup(filter='level=1|school=N;I',count=1){
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB','XPHB'];c.selections=[{id:'owner',quantity:1,level:3,equipped:false,entry:{id:'authored:owner',kind:'feat',name:'原创法术来源',english:'Authored source',source:'PHB',edition:'2014',packId:'authored-filter',revision:'1',entries:[],raw:{additionalSpells:[{ability:'wis',innate:{'_':{daily:{'1e':[{choose:filter,count}]}}}}]}}}];c.runtime.resources.manual={max:9,current:2};return c;
}
const choice=(c:ReturnType<typeof setup>,entries=catalog)=>planSourceSpells(c,entries).choices.find(q=>q.spells);
it('offers the complete conjunction with alternatives inside each filter and never chooses for the player',()=>{
 const c=setup(),before=JSON.stringify(c),entries=JSON.stringify(catalog),q=choice(c)!;
 expect(q?.spells).toEqual(['Ash|PHB','Mist|PHB']);expect(q.count).toBe(1);expect(planSourceSpells(c,catalog).grants).toEqual([]);expect(JSON.stringify(c)).toBe(before);expect(JSON.stringify(catalog)).toBe(entries);
 expect(()=>setSourceSpellChoices(c,q.key,['Ember|PHB'],catalog)).toThrow();expect(JSON.stringify(c)).toBe(before);
 setSourceSpellChoices(c,q.key,['Ash|PHB'],catalog);syncSourceSpells(c,catalog);expect(c.selections.filter(s=>s.entry.kind==='spell')).toHaveLength(1);expect(planSourceSpells(c,catalog).grants[0].config.sourceGrant?.active).toBe(true);
});
it('keeps PHB and XPHB identities separate, including an explicitly permitted legacy catalog',()=>{
 const entries=[spell('Twin',{level:1,school:'N'}),spell('Twin',{level:1,school:'N'},'XPHB')],c=setup('level=1');
 expect(choice(c,entries)?.spells).toEqual(['Twin|PHB']);c.edition='2024';expect(choice(c,entries)?.spells).toEqual(['Twin|XPHB']);c.profile.optional.legacy=true;expect(choice(c,entries)?.spells).toEqual(['Twin|PHB','Twin|XPHB']);
});
it('retains chosen snapshots, preparation and spent uses through switching, source disable, import and reopen',()=>{
 const c=setup(),q=choice(c)!;expect(q).toBeDefined();setSourceSpellChoices(c,q.key,['Ash|PHB'],catalog);syncSourceSpells(c,catalog);const row=c.selections.find(s=>s.entry.kind==='spell')!;
 expect(performSpellAction(c,spellActionRequest(c,row.id,'source','authored-filter-cast')).status).toBe('applied');const resource=specialSpellResource(row.id,c);expect(c.runtime.resources[resource].current).toBe(0);
 // Source-use spells do not occupy ordinary preparation slots. Preserve a
 // separate, legal manual spell rather than fabricating an innate preparation.
 c.selections.push({id:'manual-prepared',entry:spell('Handwritten',{level:3}),quantity:1,level:1,equipped:false});c.spellSettings!.prepared=['manual-prepared'];
 setSourceSpellChoices(c,q.key,['Mist|PHB'],catalog);syncSourceSpells(c,catalog);setSourceSpellChoices(c,q.key,['Ash|PHB'],catalog);syncSourceSpells(c,catalog);expect(c.runtime.resources[resource].current).toBe(0);
 const newer=catalog.map(e=>e.name==='Ash'?{...e,revision:'2',raw:{level:9,school:'E'}}:e);expect(choice(c,newer)?.spells).toContain('Ash|PHB');c.profile.enabledSources=[];syncSourceSpells(c,newer);expect(c.spellSettings!.special![row.id].sourceGrant!.active).toBe(false);expect(c.automation!.spellChoices![q.key]).toEqual(['Ash|PHB']);
 const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;restored.profile.enabledSources=['PHB'];syncSourceSpells(restored,newer);syncSourceSpells(restored,newer);expect(restored.spellSettings!.special![row.id].sourceGrant!.active).toBe(true);expect(restored.runtime.resources[resource].current).toBe(0);expect(restored.runtime.resources.manual).toEqual({max:9,current:2});expect(restored.spellSettings!.prepared).toEqual(['manual-prepared']);
});
it('uses declared ritual and subschool metadata, keeps partial choices and holds every unknown clause',()=>{
 const c=setup('level=1|components & miscellaneous=仪式',2),q=choice(c)!;expect(q?.spells).toEqual(['Ash|PHB']);expect(q.count).toBe(2);setSourceSpellChoices(c,q.key,['Ash|PHB'],catalog);expect(planSourceSpells(c,catalog).issues.some(i=>i.message.includes('尚有 1 项未选'))).toBe(true);
 const blood=[spell('Veil',{level:2,subschools:['原创子学派']})];expect(choice(setup('level=2|subschool=原创子学派'),blood)?.spells).toEqual(['Veil|PHB']);
 for(const filter of ['level=1|unknown=value','level=1|school=!N','level=[1;2]','level=1|level=2','', 'level=1|class=Unresolved class']){const other=setup(filter),before=JSON.stringify(other),plan=planSourceSpells(other,catalog);expect(plan.grants).toEqual([]);expect(plan.choices.filter(q=>q.spells)).toEqual([]);expect(plan.issues.length).toBeGreaterThan(0);expect(JSON.stringify(other)).toBe(before);}
});
it('keeps repeated filter slots distinct without blocking a separate source owner or erasing old duplicate intent',()=>{
 const c=setup();c.selections[0].entry.raw.additionalSpells[0].innate['_'].daily['1e'].push({choose:'level=1|school=N;I'});
 const choices=planSourceSpells(c,catalog).choices.filter(q=>q.spells);expect(choices).toHaveLength(2);setSourceSpellChoices(c,choices[0].key,['Ash|PHB'],catalog);const before=JSON.stringify(c);
 expect(()=>setSourceSpellChoices(c,choices[1].key,['Ash|PHB'],catalog)).toThrow();expect(JSON.stringify(c)).toBe(before);
 setSourceSpellChoices(c,choices[1].key,['Mist|PHB'],catalog);syncSourceSpells(c,catalog);expect(planSourceSpells(c,catalog).grants).toHaveLength(2);
 const other=setup().selections[0];other.id='other-owner';c.selections.push(other);const separate=planSourceSpells(c,catalog).choices.find(q=>q.ownerId===other.id&&q.spells)!;setSourceSpellChoices(c,separate.key,['Ash|PHB'],catalog);syncSourceSpells(c,catalog);expect(planSourceSpells(c,catalog).grants).toHaveLength(3);
 c.automation!.spellChoices![choices[1].key]=['Ash|PHB'];const old=JSON.stringify(c.automation!.spellChoices);syncSourceSpells(c,catalog);expect(planSourceSpells(c,catalog).grants.map(grant=>grant.owner.id)).toEqual(['other-owner']);expect(planSourceSpells(c,catalog).issues.some(issue=>issue.message.includes('重复'))).toBe(true);expect(JSON.stringify(c.automation!.spellChoices)).toBe(old);
});
it('rejects an alias of an already chosen spell, while ambiguous identities and missing metadata never become candidates',()=>{
 const ash={...catalog[0],name:'原创灰烬'},entries=[ash,catalog[1]],c=setup();c.selections[0].entry.raw.additionalSpells[0].innate['_'].daily['1e'].push({choose:{from:['原创灰烬|PHB','Mist|PHB'],count:2}});
 const choices=planSourceSpells(c,entries).choices.filter(q=>q.spells);setSourceSpellChoices(c,choices[0].key,['Ash|PHB'],entries);const before=JSON.stringify(c);expect(()=>setSourceSpellChoices(c,choices[1].key,['原创灰烬|PHB'],entries)).toThrow();expect(JSON.stringify(c)).toBe(before);
 const duplicate={...ash,id:'different-source-identity'},empty=planSourceSpells(setup('level=1|school=N'),[ash,duplicate,spell('No school',{level:1})]);expect(empty.choices.find(q=>q.spells)?.spells).toEqual([]);expect(empty.grants).toEqual([]);expect(empty.issues.some(issue=>issue.message.includes('多个身份'))).toBe(true);
});
it('uses the declared filtered count for shared PB ownership and never replenishes on choice changes or refresh',()=>{
 const c=setup('level=1|school=N;I',2);c.selections[0].entry.raw.additionalSpells[0].innate['_'].daily={pb:[{choose:'level=1|school=N;I',count:2}]};
 const pending=planSourceSpells(c,catalog),usage=pending.choices.find(q=>q.usageModes)!;expect(usage).toBeDefined();expect(pending.grants).toEqual([]);c.automation!.spellUsageModes={[usage.key]:'shared'};
 const q=choice(c)!;setSourceSpellChoices(c,q.key,['Ash|PHB','Mist|PHB'],catalog);syncSourceSpells(c,catalog);const rows=c.selections.filter(row=>row.entry.kind==='spell'),resource=specialSpellResource(rows[0].id,c);expect(specialSpellResource(rows[1].id,c)).toBe(resource);expect(c.runtime.resources[resource].current).toBe(2);
 for(const [i,row] of rows.entries())expect(performSpellAction(c,spellActionRequest(c,row.id,'source',`shared-filter-${i}`)).status).toBe('applied');expect(c.runtime.resources[resource].current).toBe(0);
 setSourceSpellChoices(c,q.key,[],catalog);syncSourceSpells(c,catalog);setSourceSpellChoices(c,q.key,['Ash|PHB','Mist|PHB'],catalog);syncSourceSpells(c,catalog);syncSourceSpells(c,catalog);expect(c.runtime.resources[resource].current).toBe(0);expect(c.runtime.resources.manual).toEqual({max:9,current:2});
});
it('holds a retained choice after a declaration changes and restores its exhausted grant without changing manual data',()=>{
 const c=setup(),q=choice(c)!;setSourceSpellChoices(c,q.key,['Ash|PHB'],catalog);syncSourceSpells(c,catalog);const row=c.selections.find(row=>row.entry.kind==='spell')!,resource=specialSpellResource(row.id,c);performSpellAction(c,spellActionRequest(c,row.id,'source','changed-filter'));expect(c.runtime.resources[resource].current).toBe(0);
 c.selections[0].entry.raw.additionalSpells[0].innate['_'].daily['1e'][0].choose='level=1|school=I';syncSourceSpells(c,catalog);expect(c.automation!.spellChoices![q.key]).toEqual(['Ash|PHB']);expect(c.spellSettings!.special![row.id].sourceGrant!.active).toBe(false);expect(planSourceSpells(c,catalog).issues.some(issue=>issue.message.includes('当前声明不符'))).toBe(true);
 const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;restored.selections[0].entry.raw.additionalSpells[0].innate['_'].daily['1e'][0].choose='level=1|school=N;I';syncSourceSpells(restored,catalog);expect(restored.spellSettings!.special![row.id].sourceGrant!.active).toBe(true);expect(restored.runtime.resources[resource].current).toBe(0);expect(restored.runtime.resources.manual).toEqual({max:9,current:2});
});
