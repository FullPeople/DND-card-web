import {describe,expect,it} from 'vitest';
import {newCharacter,type Character,type Entry,type Selection} from '../src/core/model';
import {syncAutoResources,setResource} from '../src/core/resources';
import {spellState} from '../src/core/characterDetails';
import {togglePreparedSpell} from '../src/core/spells';
import {featureOwner,selectionLevel} from '../src/core/featureOwnership';
import {syncFeatures} from '../src/core/sheet';
import {exportCharacter} from '../src/core/export';
import {validateCharacter} from '../src/core/validation';

const entry=(kind:Entry['kind'],name:string,raw:Entry['raw']={},source='XPHB'):Entry=>({id:`${source}:${kind}:${name}`,name,english:raw.ENG_name||name,kind,raw,source,edition:'both',packId:'test',revision:'1',entries:['规则正文']});
const add=(c:Character,e:Entry,level=1):Selection=>{const s={id:e.id,entry:e,level,quantity:1,equipped:false};c.selections.push(s);return s;};
describe('spell page state and source-qualified subclass ownership',()=>{
 it('initializes spell-page slots on the first caster edit and updates levels without restoring used slots',()=>{
  const c=newCharacter(),cls=add(c,entry('class','甲',{casterProgression:'full',spellcastingAbility:'wis',hd:{faces:8}}),3);
  expect(c.spellSettings).toBeUndefined();syncAutoResources(c);expect(spellState(c)).toMatchObject({ability:'wis',slots:{'1':{max:4,used:0},'2':{max:2,used:0}}});
  setResource(c,'spell-slot:1',2);const before=structuredClone(c);cls.level=5;syncAutoResources(c,before);
  expect(spellState(c).slots).toEqual({'1':{max:4,used:2},'2':{max:3,used:0},'3':{max:2,used:0}});expect(syncAutoResources(c)).toBe(false);
  cls.level=1;syncAutoResources(c);expect(Object.keys(spellState(c).slots)).toEqual(['1']);expect(c.runtime.resources['spell-slot:3']).toBeUndefined();
 });
 it('uses source slot tables immediately even without a casterProgression field, and removes their slots with the source class',()=>{
  const c=newCharacter();add(c,entry('class','自定义职业',{classTableGroups:[{rowsSpellProgression:[[1,0],[3,1],[4,2]]}]}),2);
  syncAutoResources(c);expect(spellState(c).slots).toEqual({'1':{max:3,used:0},'2':{max:1,used:0}});
  const before=structuredClone(c);c.selections=[];syncAutoResources(c,before);expect(spellState(c).slots).toEqual({});expect(c.runtime.resources['spell-slot:1']).toBeUndefined();
 });
 it('keeps manually configured spell pools stable when no automatic progression exists',()=>{
  const c=newCharacter();c.spellSettings={...spellState(c),slots:{'1':{max:3,used:1}}};syncAutoResources(c);expect(syncAutoResources(c)).toBe(false);expect(spellState(c).slots['1']).toEqual({max:3,used:1});
 });
 it('follows the subclass main class level, with declared feature attribution across class and source collisions',()=>{
  const c=newCharacter();c.profile.optional.legacy=true;
  const a=add(c,entry('class','甲',{ENG_name:'Alpha'}),7),b=add(c,entry('class','乙'),4);
  const sa=add(c,entry('subclass','甲的新学派',{shortName:'学派',className:'甲',classSource:'XPHB',subclassFeatures:['能力|Alpha|XPHB|学派|XPHB|6']}));sa.parentId=a.id;
  const sb=add(c,entry('subclass','乙的新学派',{shortName:'学派',className:'乙',classSource:'XPHB'}));sb.parentId=b.id;
  const old=add(c,entry('subclass','旧学派',{shortName:'学派',className:'甲',classSource:'PHB'},'PHB'));
  const f=entry('feature','能力',{className:'Alpha',classSource:'XPHB',subclassShortName:'学派',subclassSource:'XPHB',level:6});const child=add(c,f);syncFeatures(c,[f]);
  expect([sa.level,sb.level]).toEqual([7,4]);expect(featureOwner(c,child)?.id).toBe(sa.id);expect(child.parentId).toBe(sa.id);expect(selectionLevel(c,sa)).toBe(7);expect(featureOwner(c,child)?.id).not.toBe(old.id);
  a.level=8;syncFeatures(c,[f]);expect(selectionLevel(c,sa)).toBe(8);expect(sa.level).toBe(8);
 });
 it('subclass slot progression reads the parent level before legacy parent IDs have been repaired',()=>{
  const c=newCharacter();add(c,entry('class','甲'),3);add(c,entry('subclass','学派',{className:'甲',classSource:'XPHB',casterProgression:'third',subclassTableGroups:[{rowsSpellProgression:[[0],[0],[2]]}]}));
  syncAutoResources(c);expect(spellState(c).slots['1']).toEqual({max:2,used:0});
 });
 it('attributes nested inline sections using their reference owner and guards corrupt ownership cycles',()=>{
  const c=newCharacter(),cls=add(c,entry('class','甲'),5),sub=add(c,entry('subclass','学派',{shortName:'学派',className:'甲',classSource:'XPHB'}));sub.parentId=cls.id;
  const parent=add(c,entry('feature','多项能力',{className:'甲',classSource:'XPHB',subclassShortName:'学派',level:5}));
  const inline=add(c,entry('feature','选项',{_inlineOwner:parent.entry.id}));expect(featureOwner(c,inline)?.id).toBe(sub.id);syncFeatures(c,[]);expect(inline.parentId).toBe(sub.id);
  const invalid=add(c,entry('feature','循环'));invalid.entry.raw._inlineOwner=invalid.entry.id;expect(featureOwner(c,invalid)).toBeUndefined();
 });
 it('prepares and removes learned references, preserves empty positions through round trips, and respects explicit capacity',()=>{
  const c=newCharacter();const a=add(c,entry('spell','甲',{level:1})),b=add(c,entry('spell','乙',{level:2})),cantrip=add(c,entry('spell','戏法',{level:0}));
  c.spellSettings={...spellState(c),capacity:2};delete c.spellSettings.capacityAdjustment;expect(togglePreparedSpell(c,a.id,1)).toBe(true);expect(c.spellSettings.prepared).toEqual(['',a.id]);expect(togglePreparedSpell(c,b.id)).toBe(true);
  const third=add(c,entry('spell','丙',{level:3}));expect(togglePreparedSpell(c,third.id)).toBe(false);expect(togglePreparedSpell(c,cantrip.id)).toBe(false);
  expect(togglePreparedSpell(c,a.id)).toBe(true);expect(c.selections).toHaveLength(4);expect(validateCharacter(exportCharacter(c)).spellSettings?.prepared).toEqual([b.id,'']);
  c.spellSettings.capacity=0;expect(togglePreparedSpell(c,third.id)).toBe(true);expect(c.spellSettings.prepared).toEqual([b.id,third.id]);
 });
});
