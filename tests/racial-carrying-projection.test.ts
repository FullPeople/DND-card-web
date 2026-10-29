import {beforeAll,expect,it} from 'vitest';
import type {Entry,Size} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {carrying,capacityFormula} from '../src/core/carrying';
import ordinary from '../src/core/automation/ordinarySpellCastingEvidence.json';
import {projectRacialCarrying,racialCarryingRule} from '../src/core/automation/racialCarrying';
import {racialCarryingFixture} from './helpers/racialCarryingFlowFixture';
import {racialCarryingSpecs,racialCarryingSourceEvidence,racialCarryingSnapshot as snapshot} from './helpers/racialCarryingSourceFixture';

beforeAll(()=>{racialCarryingSourceEvidence();},30000);
type Fixture=ReturnType<typeof racialCarryingFixture>;
const factors:Record<Size,number>={T:7.5,S:15,M:15,L:30,H:60,G:120};
function legacy(f:Fixture){const d=evaluate(f.c),base=d.abilities.str*(factors[f.c.size||'M']||15);return{d,base,max:capacityFormula(f.c.inventory?.capacityAdjustment||'',base,d.abilities.str)};}
function held(f:Fixture){const before=snapshot(f.c),old=legacy(f),value=carrying(f.c,old.d);expect(value.base).toBe(old.base);expect(value.max).toBe(old.max);expect(value.strength).toBe(old.d.abilities.str);expect(value.sourceNotes.length).toBeGreaterThan(0);expect(projectRacialCarrying(f.c).grants.length).toBe(0);expect(snapshot(f.c)).toBe(before);}
function positive(f:Fixture){const before=snapshot(f.c),d=evaluate(f.c),p=projectRacialCarrying(f.c),value=carrying(f.c,d);expect(d.abilities.str).toBe(10);expect(p.effectiveSize).toBe('L');expect(p.grants.length).toBe(1);expect(p.grants[0].selectionId).toBe(f.owner.id);expect(p.grants[0].entryId).toBe(f.rule.id);expect(value.base).toBe(300);expect(value.max).toBe(300);expect(value.sourceNotes.some(note=>note.includes(f.entry.name))).toBe(true);expect(snapshot(f.c)).toBe(before);}
function freeze(value:unknown):void{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}}

it('authenticates every actual canonical and App full source form and projects only a carrying-table size increment',()=>{
 for(const form of ['canonical','app']as const)for(const spec of racialCarryingSpecs){const f=racialCarryingFixture(spec.key,form);expect(racialCarryingRule(f.entry)?.id).toBe(f.rule.id);positive(f);expect(f.c.size).toBe('M');expect(f.c.inventory?.capacityAdjustment).toBe('');}
});
it('uses the actual size table rather than a universal doubling and holds unknown or beyond-table sizes without repairing the card',()=>{
 for(const [size,effective,max]of [['T','S',150],['S','M',150],['M','L',300],['L','H',600],['H','G',1200]]as const){const f=racialCarryingFixture();f.c.size=size;const before=snapshot(f.c),p=projectRacialCarrying(f.c),value=carrying(f.c,evaluate(f.c));expect(p.effectiveSize).toBe(effective);expect(value.max).toBe(max);expect(f.c.size).toBe(size);expect(snapshot(f.c)).toBe(before);}
 const giant=racialCarryingFixture();giant.c.size='G';held(giant);expect(carrying(giant.c,evaluate(giant.c)).max).toBe(1200);
 for(const size of ['AUTHORED_UNKNOWN','',undefined]){const f=racialCarryingFixture();f.c.size=size as Size;held(f);expect(carrying(f.c,evaluate(f.c)).max).toBe(150);}
});
it('preserves every existing nonempty manual formula byte and exact old result instead of silently adding another size effect',()=>{
 for(const text of ['*2','  *2  ','+30','基础*2+力量','(基础+30)/2','0','150']){const f=racialCarryingFixture();f.c.inventory!.capacityAdjustment=text;held(f);const value=carrying(f.c,evaluate(f.c));expect(value.base).toBe(150);expect(value.max).toBe(capacityFormula(text,150,10));expect(f.c.inventory!.capacityAdjustment).toBe(text);expect(value.sourceNotes.some(note=>note.includes('手工'))).toBe(true);}
 for(const text of ['', '   ']){const f=racialCarryingFixture();f.c.inventory!.capacityAdjustment=text;positive(f);expect(f.c.inventory!.capacityAdjustment).toBe(text);}
 const f=racialCarryingFixture();f.c.inventory!.capacityAdjustment='*2';held(f);f.c.inventory!.capacityAdjustment='';positive(f);
});
it('honors coherent full-source aliases canonical and alias opt-outs reserved identities and saved source edition independent of display edition',()=>{
 for(const key of ['race/13','race/67']){const f=racialCarryingFixture(key),canonicalId=f.rule.id;f.entry.id='authored-racial-carrying-alias';f.entry.revision='authored-current-transport';expect(racialCarryingRule(f.entry)?.id).toBe(canonicalId);positive(f);for(const id of [canonicalId,f.entry.id]){f.c.profile.disabledEntries=[id];held(f);}delete f.c.profile.disabledEntries;f.c.edition=f.c.edition==='2014'?'2024':'2014';positive(f);f.entry.id=ordinary.canonicalIds.find(id=>id.startsWith('kiwee:spell:'))!;expect(racialCarryingRule(f.entry)===undefined).toBe(true);held(f);}
});
it('rejects edited complete payloads source packs headers editions and copied raw labels without changing the prior physical capacity calculation',()=>{
 const changes:((entry:Entry)=>void)[]=[e=>{e.raw.size=['L'];},e=>{e.raw.authoredExtra=true;},e=>{e.entries=[...e.entries,'Authored change'];},e=>{e.packId='authored-foreign';},e=>{e.source='AUTHORED';},e=>{e.edition=e.edition==='2024'?'2014':'2024';},e=>{e.name+=' Authored';},e=>{e.english+=' Authored';},e=>{e.page=(e.page??0)+1;},e=>{e.raw._copy={name:'Authored'};}];
 for(const change of changes){const f=racialCarryingFixture();change(f.entry);expect(racialCarryingRule(f.entry)===undefined).toBe(true);held(f);}
 const f=racialCarryingFixture();f.entry.kind='item';const old=legacy(f),value=carrying(f.c,old.d);expect(value.max).toBe(old.max);expect(projectRacialCarrying(f.c).grants.length).toBe(0);
});
it('requires one real current race root and source authority while treating quantity wearing attunement and class level as unrelated',()=>{
 const changes:((f:Fixture)=>void)[]=[f=>{f.c.automation!.enabled=false;},f=>{f.c.automation!.protocol=99;},f=>{f.c.automation!.rulesVersion='authored-future';},f=>{f.c.profile.enabledSources=[];},f=>{f.owner.parentId='authored-missing';},f=>{f.owner.grantKey='authored-generated';},f=>{f.owner.requirementId='authored-choice';},f=>{f.owner.id='';}];
 for(const change of changes){const f=racialCarryingFixture();change(f);held(f);}
 for(const mode of ['same-root','alias-root','cross-kind-id-collision']as const){const f=racialCarryingFixture(),copy=structuredClone(f.owner);if(mode!=='cross-kind-id-collision')copy.id='authored-second-race';if(mode==='alias-root')copy.entry.id='authored-second-coherent-alias';if(mode==='cross-kind-id-collision')copy.entry.kind='item';f.c.selections.push(copy);held(f);}
 for(const quantity of [0,2,1.5]){const f=racialCarryingFixture();f.owner.quantity=quantity;f.owner.equipped=false;f.owner.attuned=false;f.owner.level=0;positive(f);}
 const f=racialCarryingFixture();f.c.profile.enabledSources=[];f.c.profile.exceptions[f.entry.id]='Authored exception';held(f);
});
it('intersects supplied active rows with current genuine ownership and never authorizes copied rows or foreign manual same-name entries',()=>{
 const f=racialCarryingFixture();expect(projectRacialCarrying(f.c,[f.owner]).grants.length).toBe(1);expect(projectRacialCarrying(f.c,[]).grants.length).toBe(0);expect(projectRacialCarrying(f.c,[structuredClone(f.owner)]).grants.length).toBe(0);f.c.profile.enabledSources=[];expect(projectRacialCarrying(f.c,[f.owner]).grants.length).toBe(0);
 const foreign=racialCarryingFixture();foreign.entry.id='authored-manual-race';foreign.entry.packId='authored-foreign';foreign.entry.source='AUTHORED';foreign.entry.raw.source='AUTHORED';foreign.c.profile.enabledSources=['AUTHORED'];const before=snapshot(foreign.c),old=legacy(foreign),value=carrying(foreign.c,old.d);expect(value.max).toBe(old.max);expect(value.sourceNotes.length).toBe(0);expect(snapshot(foreign.c)).toBe(before);
});
it('keeps actual derived Strength prior formula validation max policy and locked frozen manual resources completely unchanged',()=>{
 const f=racialCarryingFixture();f.c.abilities.str+=10;const d=evaluate(f.c),before=snapshot(f.c),derived=snapshot(d);expect(d.abilities.str).toBe(20);freeze(f.c);expect(carrying(f.c,d).max).toBe(600);expect(snapshot(f.c)).toBe(before);expect(snapshot(d)).toBe(derived);expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.tempHp).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(1);
 for(const text of ['1/0','window.alert(1)','1000000001']){const invalid=racialCarryingFixture();invalid.c.inventory!.capacityAdjustment=text;const before=snapshot(invalid.c);expect(()=>carrying(invalid.c,evaluate(invalid.c))).toThrow();expect(snapshot(invalid.c)).toBe(before);}
});
