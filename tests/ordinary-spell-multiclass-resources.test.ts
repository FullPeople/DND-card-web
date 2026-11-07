import {expect,it as privateSourceIt} from 'vitest';
import {multiclassSlotEntries,multiclassSpellEntries,runMulticlassSourceCheck} from './helpers/multiclassSlotSources';
import {newCharacter,type Character,type Entry,type Selection} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {syncAutoResources,setResource} from '../src/core/resources';
import {readCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
import {ordinaryCastingRule} from '../src/core/automation/ordinaryCastingIdentity';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {prepareSpellEntry} from '../src/core/spells';
import {learnActiveSpell} from '../src/core/spellWorkspace';
import {casterProfiles} from '../src/core/spellcastingRules';
import {syncFeatures} from '../src/core/sheet';

let index=0;
function it(name:string,run:()=>unknown){const i=++index;return privateSourceIt(name,()=>runMulticlassSourceCheck(i,run));}
const entries=multiclassSlotEntries(),specs=[{main:'Paladin'},{main:'Ranger'},{main:'Fighter',sub:'Eldritch Knight'},{main:'Rogue',sub:'Arcane Trickster'}];
function entry(kind:Entry['kind'],name:string,edition:'2014'|'2024'){
 const source=edition==='2014'?'PHB':'XPHB',rows=entries.filter(e=>e.kind===kind&&e.english===name&&e.source===source&&(kind!=='subclass'||String(e.raw.classSource||'PHB').toUpperCase()===source));
 if(rows.length!==1)throw Error('Unique exact edition and parent class required');return structuredClone(rows[0]);
}
const selection=(entry:Entry,id:string,level:number,parentId?:string):Selection=>({id,entry,level,quantity:1,equipped:false,...(parentId?{parentId}:{})});
function build(edition:'2014'|'2024',spec:typeof specs[number],level:number,companion:'none'|'noncaster'|'pact'|'wizard'){
 const c=newCharacter(edition);c.automation=newAutomationState();c.profile.enabledSources=[edition==='2014'?'PHB':'XPHB'];c.profile.optional.multiclass=companion!=='none';
 for(const key of ['str','dex','con','int','wis','cha'] as const)c.abilities[key]=16;
 c.notes='Authored multiclass note';c.runtime.resources.manual={name:'Authored retained manual balance',max:9,current:2,locked:true};
 const main=selection(entry('class',spec.main,edition),'capacity-main',level);c.selections=[main];
 if(spec.sub&&level>=3)c.selections.push(selection(entry('subclass',spec.sub,edition),'capacity-subclass',level,main.id));
 const other=companion==='none'?undefined:selection(entry('class',companion==='pact'?'Warlock':companion==='wizard'?'Wizard':spec.main==='Fighter'?'Rogue':'Fighter',edition),'capacity-companion',companion==='noncaster'?1:3);
 if(other)c.selections.push(other);return {c,main,other};
}
function ownSlots(spec:typeof specs[number],level:number,edition:'2014'|'2024'){
 if(spec.sub&&level<3)return [];
 const owner=entry('class',spec.main,edition),sub=spec.sub?entry('subclass',spec.sub,edition):undefined;
 const row=[...(owner.raw.classTableGroups||[]),...(sub?.raw.subclassTableGroups||[])].map(g=>g.rowsSpellProgression?.[level-1]).find(r=>Array.isArray(r)&&r.every(n=>typeof n==='number'));
 if(!row)throw Error('Actual source numeric spell-slot row required');return row as number[];
}
const capacities=(c:Character)=>Array.from({length:9},(_,i)=>c.runtime.resources[`spell-slot:${i+1}`]?.max||0);
const padded=(row:number[])=>Array.from({length:9},(_,i)=>row[i]||0);

it('actual primary class snapshots and all twenty source rows retain separate edition and subclass-parent identities',()=>{
 for(const edition of ['2014','2024'] as const)for(const spec of specs){expect(ordinaryCastingRule(entry('class',spec.main,edition))).toBeDefined();for(let level=1;level<=20;level++)expect(ownSlots(spec,level,edition).every(n=>Number.isSafeInteger(n)&&n>=0)).toBe(true);}
});
for(const edition of ['2014','2024'] as const)for(const spec of specs)for(const companion of ['noncaster','pact'] as const)it(`${edition} ${spec.sub||spec.main} retains its declared table with a ${companion} companion and all class hit dice`,()=>{
 const companionLevel=companion==='noncaster'?1:3;
 for(let level=1;level<=20-companionLevel;level++){
  const {c}=build(edition,spec,level,companion);syncAutoResources(c);
  expect(capacities(c)).toEqual(padded(ownSlots(spec,level,edition)));
  expect(Object.entries(c.runtime.resources).filter(([id])=>id.startsWith('hit-die:')).reduce((sum,[,r])=>sum+r.max,0)).toBe(level+companionLevel);
  expect(c.runtime.resources.manual.current).toBe(2);
 }
});
it('two actual Spellcasting classes retain edition-specific multiclass rounding rather than one source table',()=>{
 for(const [edition,expected] of [['2014',[4,3,2]],['2024',[4,3,3]]] as const){const {c}=build(edition,{main:'Paladin'},5,'wizard');syncAutoResources(c);expect(capacities(c)).toEqual(padded([...expected]));}
 const {c}=build('2014',{main:'Fighter',sub:'Eldritch Knight'},4,'wizard');syncAutoResources(c);expect(capacities(c)).toEqual(padded([4,3]));
});
it('one-level half casters without Spellcasting do not reduce a wizard source table or unlock slots of their own',()=>{
 for(const spec of [{main:'Paladin'},{main:'Ranger'}]){const {c}=build('2014',spec,1,'wizard');syncAutoResources(c);expect(capacities(c)).toEqual(padded([4,2]));}
});
it('level changes preserve used ordinary and pact slots, every hit die and manual balances through native reopen',()=>{
 const {c,main}=build('2014',{main:'Paladin'},5,'pact');syncAutoResources(c);expect(capacities(c)).toEqual(padded([4,2]));
 setResource(c,'spell-slot:1',2);setResource(c,'spell-slot:2',1);setResource(c,'pact-slot:2',1);setResource(c,'hit-die:10',3);
 const manual=structuredClone(c.runtime.resources.manual),pact=structuredClone(c.runtime.resources['pact-slot:2']);
 main.level=7;syncAutoResources(c);expect(capacities(c)).toEqual(padded([4,3]));
 expect(c.runtime.resources['spell-slot:1'].current).toBe(2);expect(c.runtime.resources['spell-slot:2'].current).toBe(2);
 expect(c.runtime.resources['hit-die:10']).toMatchObject({max:7,current:5});expect(c.runtime.resources['hit-die:8'].max).toBe(3);
 expect(c.runtime.resources['pact-slot:2']).toEqual(pact);expect(c.runtime.resources.manual).toEqual(manual);
 const restored=readCharacter(exportCharacter(c)).character;syncAutoResources(restored);
 expect(restored.runtime.resources['spell-slot:2'].current).toBe(2);expect(restored.runtime.resources['pact-slot:2']).toEqual(pact);
 expect(restored.notes).toBe(c.notes);expect(restored.runtime.resources.manual).toEqual(manual);
});
for(const edition of ['2014','2024'] as const)for(const mainName of ['Paladin','Ranger'])it(`actual ${edition} ${mainName} acquisition pays the restored second-level slot once and survives reopening and readonly denial`,()=>{
 const {c,main}=build(edition,{main:mainName},5,'noncaster'),spells=multiclassSpellEntries(edition);
 syncFeatures(c,[...entries,...spells]);syncAutoResources(c);
 const matches=spells.filter(e=>e.kind==='spell'&&e.english==='Cure Wounds'&&e.source===(edition==='2014'?'PHB':'XPHB'));
 expect(matches.length).toBe(1);expect(ordinaryCastingRule(matches[0])).toBeDefined();
 const profile=casterProfiles(c).find(p=>p.owner.id===main.id)!;expect(profile).toBeDefined();
 const id=profile.mode==='prepared'?prepareSpellEntry(c,matches[0],undefined,main.id):learnActiveSpell(c,matches[0],main.id).id;
 expect(id).toBeDefined();expect(c.spellSettings!.classSpells![main.id]).toContain(id);
 const before=structuredClone(c),payment=spellPayments(c,id!).options.find(p=>p.id==='ordinary:spell-slot:2');
 expect(c).toEqual(before);expect(payment?.available).toBe(true);
 const q=spellActionRequest(c,id!,payment!.id,'actual-fractional-cast','cast',main.id);
 expect(performSpellAction(c,q,{canEdit:false,gm:true}).status).toBe('rejected');expect(c).toEqual(before);
 expect(performSpellAction(c,q,{canEdit:true}).status).toBe('applied');expect(c.runtime.resources['spell-slot:2']).toMatchObject({max:2,current:1});
 expect(performSpellAction(c,q,{canEdit:true}).status).toBe('duplicate');expect(c.runtime.resources['spell-slot:2'].current).toBe(1);
 const restored=readCharacter(exportCharacter(c)).character;syncFeatures(restored,[...entries,...spells]);syncAutoResources(restored);
 expect(restored.runtime.resources['spell-slot:2']).toMatchObject({max:2,current:1});expect(restored.spellSettings!.slots['2']).toEqual({max:2,used:1});
 expect(restored.runtime.resources.manual).toEqual(before.runtime.resources.manual);expect(restored.notes).toBe(before.notes);
 expect(spellPayments(restored,id!).options.some(p=>p.id==='ordinary:spell-slot:2'&&p.available)).toBe(true);
});
