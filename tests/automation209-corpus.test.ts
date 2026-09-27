import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {newCharacter,type Selection} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {evaluate} from '../src/core/engine';
import {newAutomationState} from '../src/core/automation/state';
import {automaticWeaponAttacks} from '../src/core/automation/weapons';
import {planSourceSpells,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {specialSpellResource,changeSpecialSpellUses} from '../src/core/specialSpells';

// Run against a separately held source snapshot; publisher data is never copied into the repository.
const path=process.env.DND_AUTOMATION_BASEITEMS;
const directory=process.env.DND_AUTOMATION_CORE_DATA;
it.skipIf(!path)('real base equipment in both editions follows the independently known armor and thrown-weapon examples',()=>{
 const raw=JSON.parse(readFileSync(path!,'utf8').replace(/^\uFEFF/,''));
 const entries=normalizeData(raw,'external-corpus');
 for(const [edition,source] of [['2014','PHB'],['2024','XPHB']] as const){
  const c=newCharacter(edition);c.automation=newAutomationState();c.training={armor:'轻甲、中甲、重甲、盾牌',weapons:'简易武器'};c.abilities.dex=30;
  const select=(type:string,ac:number)=>entries.find(e=>e.kind==='item'&&e.source===source&&String(e.raw.type).split('|')[0]===type&&e.raw.ac===ac)!;
  const row=(entry:Selection['entry'],id:string):Selection=>({id,entry,level:1,quantity:1,equipped:true});
  const heavy=select('HA',16),shield=select('S',2);expect(heavy).toBeDefined();expect(shield).toBeDefined();c.selections=[row(heavy,'armor'),row(shield,'shield')];expect(evaluate(c).ac).toBe(18);
  c.abilities.dex=6;c.selections[0].entry=select('MA',14);expect(evaluate(c).ac).toBe(14);
  c.abilities.str=14;c.abilities.dex=16;
  const dagger=entries.find(e=>e.kind==='item'&&e.source===source&&e.raw.dmg1==='1d4'&&['F','T'].every(p=>e.raw.property?.some((r:unknown)=>String(r).split('|')[0]===p)))!;expect(dagger).toBeDefined();c.selections=[row(dagger,'weapon')];c.selections[0].quantity=5;
  expect(automaticWeaponAttacks(c,evaluate(c)).attacks.map(a=>[a.modeLabel,a.attack_bonus,a.damage])).toEqual([['近战',5,'1d4+3'],['投掷',5,'1d4+3']]);
 }
});

const featsFile=process.env.DND_AUTOMATION_FEATS;
it.skipIf(!directory||!featsFile)('real multi-spell daily data requires clarification instead of mistaking per-spell grants for a shared pool',()=>{
 const feats=normalizeData(JSON.parse(readFileSync(featsFile!,'utf8').replace(/^\uFEFF/,'')),'external-corpus');
 const catalog=normalizeData(JSON.parse(readFileSync(`${directory}/data_spells_spells-xphb.json`,'utf8').replace(/^\uFEFF/,'')),'external-corpus');
 // This real snapshot's prose says each spell has a use, while its key omits "e".
 const feat=feats.find(e=>e.english==='Mark of Handling'&&e.raw.additionalSpells?.[0]?.prepared?._?.daily?.['1']?.length===2)!;expect(feat).toBeDefined();
 const c=newCharacter();c.automation=newAutomationState();c.profile.enabledSources.push(feat.source);c.selections=[{id:'feat',entry:feat,level:1,quantity:1,equipped:false}];
 const plan=planSourceSpells(c,catalog),choice=plan.choices.find(c=>c.usageModes);expect(choice).toBeDefined();syncSourceSpells(c,catalog);expect(c.selections.filter(s=>s.entry.kind==='spell')).toHaveLength(0);
 c.automation.spellUsageModes={[choice!.key]:'each'};syncSourceSpells(c,catalog);const granted=c.selections.filter(s=>s.entry.kind==='spell');expect(granted).toHaveLength(2);
 const keys=granted.map(s=>specialSpellResource(s.id,c));expect(new Set(keys).size).toBe(2);changeSpecialSpellUses(c,granted[0].id,0);expect(keys.map(k=>c.runtime.resources[k].current)).toEqual([0,1]);expect(c.spellSettings!.special![granted[0].id].recovery).toBe('long');
});

it.skipIf(!directory)('real 2014 and 2024 domain spell grants resolve translated UIDs to their own edition and remain source owned',()=>{
 const load=(name:string)=>normalizeData(JSON.parse(readFileSync(`${directory}/${name}`,'utf8').replace(/^\uFEFF/,'')),'external-corpus');
 const classes=load('data_class_class-cleric.json'),catalog=[...load('data_spells_spells-phb.json'),...load('data_spells_spells-xphb.json')];
 for(const [edition,source,expected] of [['2014','PHB',5],['2024','XPHB',4]] as const){
  const c=newCharacter(edition);c.automation=newAutomationState();
  const cls=classes.find(e=>e.kind==='class'&&e.source===source)!;
  const domain=classes.find(e=>e.kind==='subclass'&&e.source===source&&e.raw.classSource===source&&e.english==='Light Domain')!;expect(domain).toBeDefined();
  c.selections=[{id:'class',entry:cls,quantity:1,level:3,equipped:false},{id:'subclass',entry:domain,quantity:1,level:3,equipped:false,parentId:'class'}];
  expect(planSourceSpells(c,catalog).issues).toEqual([]);syncSourceSpells(c,catalog);
  const granted=c.selections.filter(s=>s.entry.kind==='spell');expect(granted).toHaveLength(expected);expect(granted.every(s=>s.entry.source===source&&s.parentId==='subclass')).toBe(true);expect(c.spellSettings!.prepared).toEqual([]);
  expect(Object.values(c.spellSettings!.special!).every(s=>s.sourceGrant?.ability==='wis')).toBe(true);expect(syncSourceSpells(c,catalog)).toBe(false);
 }
});
