import {expect,it} from 'vitest';
import type {Character,Entry,Selection} from '../src/core/model';
import {casterProfiles} from '../src/core/spellcastingRules';
import {classSpellGroups,learnActiveSpell} from '../src/core/spellWorkspace';
import {prepareSpellEntry} from '../src/core/spells';
import {spellState} from '../src/core/characterDetails';
import {classSpellChoices,setClassSpellSlot} from '../src/core/automation/classSpellChoices';
import {ordinaryDirectBaseClassList} from '../src/core/automation/ordinarySpellCasting';
import {optionalClassSpellListAccess,setOptionalClassListIntent} from '../src/core/automation/optionalClassSpellLists';
import {optionalClassListFlowFixture,optionalClassListManual} from './helpers/optionalClassListFlowFixture';
import {optionalClassListDigest,optionalClassListFind} from './helpers/optionalClassListSourceFixture';

const authority={canEdit:true,gm:false},intent={confirmedDmDiscussedInclusion:true,confirmedPlayerOptIn:true} as const;
const secondaryId='authored-other-cleric';
function fixture(english:'Bard'|'Druid'='Bard',active=true){
 const primary=optionalClassListFind('class',english),f=optionalClassListFlowFixture(primary.id);
 f.entry=structuredClone(optionalClassListFind('spell',english==='Druid'?'Augury':'Aid'));
 const other:Selection={id:secondaryId,entry:structuredClone(optionalClassListFind('class','Cleric')),level:9,quantity:1,equipped:false};
 f.c.selections.push(other);
 if(active)setOptionalClassListIntent(f.c,f.owner.id,intent,f.entries,authority);
 const profiles=casterProfiles(f.c),selected=profiles.find(profile=>profile.owner.id===f.owner.id)!,secondary=profiles.find(profile=>profile.owner.id===other.id)!;
 expect(selected).toBeDefined();expect(secondary).toBeDefined();
 expect(selected.mode).toBe(english==='Bard'?'known':'prepared');
 expect(ordinaryDirectBaseClassList(f.entry,selected)).toBe(false);
 expect(ordinaryDirectBaseClassList(f.entry,secondary)).toBe(true);
 expect(optionalClassSpellListAccess(f.c,f.entry,f.owner.id)).toBe(active);
 return{...f,other};
}
const ids=(c:Character,ownerId:string)=>classSpellGroups(c).find(group=>group.profile.owner.id===ownerId)!.ids;
const protectedState=(c:Character)=>optionalClassListDigest([optionalClassListManual(c),c.runtime,c.automation,c.inventory]);
const rowFor=(c:Character,entry:Entry)=>c.selections.filter(row=>row.entry.kind==='spell'&&row.entry.id===entry.id&&!c.spellSettings?.special?.[row.id]);

it('new explicitly chosen optional known spell belongs only to the intended actual class, not another base-list owner',()=>{
 const f=fixture(),before=protectedState(f.c),choice=classSpellChoices(f.c,f.entries).find(row=>row.ownerId===f.owner.id&&row.spellKind==='learned')!;
 expect(choice).toBeDefined();expect(choice.options.some(option=>option.entry.id===f.entry.id)).toBe(true);
 expect(ids(f.c,f.owner.id)).toEqual([]);expect(ids(f.c,f.other.id)).toEqual([]);
 setClassSpellSlot(f.c,choice,0,f.entry);
 const rows=rowFor(f.c,f.entry);expect(rows).toHaveLength(1);
 expect(f.c.spellSettings?.classSpells?.[f.owner.id]).toContain(rows[0].id);
 expect(f.c.spellSettings?.classSpells?.[f.other.id]||[]).not.toContain(rows[0].id);
 expect(ids(f.c,f.other.id)).not.toContain(rows[0].id);
 expect(protectedState(f.c)).toBe(before);
});

it('explicit sharing of an existing source spell preserves prior inferred or saved other-class and manual references',()=>{
 for(const allocation of ['legacy-inferred','saved-explicit'] as const){
  const f=fixture(),existing:Selection={id:'authored-existing-aid',entry:structuredClone(f.entry),quantity:1,level:1,equipped:false},manual:Selection={id:'authored-unrelated-manual-spell',entry:structuredClone(optionalClassListFind('spell','Magic Missile')),quantity:1,level:1,equipped:false};
  f.c.selections.push(existing,manual);f.c.spellSettings!.classSpells={manual:[manual.id,'']};
  if(allocation==='saved-explicit')f.c.spellSettings!.classSpells[f.other.id]=[existing.id,''];
  const otherBefore=[...ids(f.c,f.other.id)],manualBefore=optionalClassListDigest(f.c.spellSettings!.classSpells.manual),selectionBefore=optionalClassListDigest(f.c.selections),before=protectedState(f.c);
  expect(otherBefore).toContain(existing.id);expect(ids(f.c,f.owner.id)).not.toContain(existing.id);
  expect(learnActiveSpell(f.c,f.entry,f.owner.id)).toEqual({id:existing.id});
  expect(f.c.spellSettings?.classSpells?.[f.owner.id]).toContain(existing.id);
  expect(f.c.spellSettings?.classSpells?.[f.other.id]).toEqual(otherBefore);
  expect(optionalClassListDigest(f.c.spellSettings!.classSpells!.manual)).toBe(manualBefore);
  expect(optionalClassListDigest(f.c.selections)).toBe(selectionBefore);expect(protectedState(f.c)).toBe(before);
 }
});

it('new explicitly prepared optional spell belongs only to the intended actual prepared class without borrowing a base-list owner',()=>{
 const f=fixture('Druid'),before=protectedState(f.c);
 expect(ids(f.c,f.owner.id)).toEqual([]);expect(ids(f.c,f.other.id)).toEqual([]);
 expect(f.entry.english).toBe('Augury');expect(spellState(f.c).capacity).toBeGreaterThan(spellState(f.c).prepared.filter(Boolean).length);
 const id=prepareSpellEntry(f.c,f.entry,undefined,f.owner.id);expect(id).toBeTruthy();
 const rows=rowFor(f.c,f.entry);expect(rows).toHaveLength(1);expect(rows[0].id).toBe(id);
 expect(f.c.spellSettings?.prepared).toContain(id);
 expect(f.c.spellSettings?.classSpells?.[f.owner.id]).toContain(id);
 expect(f.c.spellSettings?.classSpells?.[f.other.id]||[]).not.toContain(id);
 expect(ids(f.c,f.other.id)).not.toContain(id);expect(protectedState(f.c)).toBe(before);
});

it('ordinary base and unscoped inference remain unchanged while ambiguous active optional ownership stays atomic',()=>{
 const base=fixture('Bard',false),healingWord=structuredClone(optionalClassListFind('spell','Healing Word')),before=protectedState(base.c),settingsBefore=optionalClassListDigest([base.c.spellSettings?.classSpells]);
 const learned=learnActiveSpell(base.c,healingWord);expect(learned.error).toBeUndefined();expect(learned.id).toBeTruthy();
 expect(optionalClassListDigest([base.c.spellSettings?.classSpells])).toBe(settingsBefore);
 expect(ids(base.c,base.owner.id)).toContain(learned.id);expect(ids(base.c,base.other.id)).not.toContain(learned.id);expect(protectedState(base.c)).toBe(before);
 const disabled=fixture('Bard',false),baseResult=learnActiveSpell(disabled.c,disabled.entry);expect(baseResult.error).toBeUndefined();expect(ids(disabled.c,disabled.other.id)).toContain(baseResult.id);expect(ids(disabled.c,disabled.owner.id)).not.toContain(baseResult.id);
 const ambiguous=fixture(),unchanged=optionalClassListDigest(ambiguous.c);expect(learnActiveSpell(ambiguous.c,ambiguous.entry).error).toBeTruthy();expect(optionalClassListDigest(ambiguous.c)).toBe(unchanged);
});
