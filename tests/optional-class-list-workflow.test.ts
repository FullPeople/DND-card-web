import {expect,it} from 'vitest';
import {setOptionalClassListIntent} from '../src/core/automation/optionalClassSpellLists';
import {classSpellChoices,setClassSpellSlot} from '../src/core/automation/classSpellChoices';
import {prepareSpellEntry} from '../src/core/spells';
import {ordinarySpellOffer} from '../src/core/automation/ordinarySpellCasting';
import {spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {optionalClassListFlowFixture,optionalClassListManual,optionalClassListOwnerIds} from './helpers/optionalClassListFlowFixture';

const authority={canEdit:true,gm:false};
for(const ownerId of optionalClassListOwnerIds)it(`actual optional class list owned choice and ordinary paid workflow ${ownerId}`,()=>{
 const f=optionalClassListFlowFixture(ownerId),manual=optionalClassListManual(f.c),beforeSelection=JSON.stringify(f.c.selections),beforeSettings=JSON.stringify(f.c.spellSettings),beforeResources=JSON.stringify(f.c.runtime.resources);
 setOptionalClassListIntent(f.c,f.owner.id,{confirmedDmDiscussedInclusion:true,confirmedPlayerOptIn:true},f.entries,authority);
 // Inclusion is list access only. It must not learn, prepare, grant capacity,
 // mint a source child, adopt a manual spell, or change any resource balance.
 expect(JSON.stringify(f.c.selections)).toBe(beforeSelection);expect(JSON.stringify(f.c.spellSettings)).toBe(beforeSettings);expect(JSON.stringify(f.c.runtime.resources)).toBe(beforeResources);
 const choice=classSpellChoices(f.c,f.entries).find(row=>row.ownerId===f.owner.id&&row.spellKind===(f.profile.pool==='book'?'book':'learned'));
 if(choice){expect(choice.options.some(row=>row.entry.id===f.entry.id)).toBe(true);setClassSpellSlot(f.c,choice,0,f.entry);}
 if(f.profile.mode==='prepared')expect(prepareSpellEntry(f.c,f.entry,undefined,f.owner.id)).toBeTruthy();
 const rows=f.c.selections.filter(row=>row.entry.kind==='spell'&&row.entry.id===f.entry.id&&!f.c.spellSettings?.special?.[row.id]);expect(rows).toHaveLength(1);const row=rows[0];expect(f.c.spellSettings?.classSpells?.[f.owner.id]).toContain(row.id);
 const offer=ordinarySpellOffer(f.c,row.id,f.owner.id,authority),payment=offer.options.find(option=>option.available&&option.cost===1&&!!option.resourceId);
 // The genuine baseline RED is here: source-qualified optional-only spells
 // already reach real class allocation, but no ordinary paid route exists.
 expect(payment,`${ownerId} selected ${f.entry.id} must have an owned ordinary payment`).toBeDefined();
 const key=payment!.resourceId!,balance=f.c.runtime.resources[key].current,request=spellActionRequest(f.c,row.id,payment!.id,'qualified-optional-paid','cast',f.owner.id);
 expect(performSpellAction(f.c,request,authority).status).toBe('applied');expect(f.c.runtime.resources[key].current).toBe(balance-1);expect(performSpellAction(f.c,request,authority).status).toBe('duplicate');expect(optionalClassListManual(f.c)).toBe(manual);
 const reopened=readCharacter(JSON.parse(JSON.stringify(exportCharacter(f.c)))).character;expect(optionalClassListManual(reopened)).toBe(manual);expect(reopened.spellSettings?.classSpells).toEqual(f.c.spellSettings?.classSpells);expect(reopened.runtime.resources[key].current).toBe(balance-1);
 const allocated=JSON.stringify(f.c.selections),settings=JSON.stringify(f.c.spellSettings),resources=JSON.stringify(f.c.runtime.resources);setOptionalClassListIntent(f.c,f.owner.id,null,f.entries,authority);expect(ordinarySpellOffer(f.c,row.id,f.owner.id,authority).options).toEqual([]);expect(JSON.stringify(f.c.selections)).toBe(allocated);expect(JSON.stringify(f.c.spellSettings)).toBe(settings);expect(JSON.stringify(f.c.runtime.resources)).toBe(resources);
});
