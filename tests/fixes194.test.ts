import {describe,it,expect} from 'vitest';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {candidateReason,evaluate} from '../src/core/engine';
import {inlineLabel} from '../src/core/inlineTags';
import {plainText,exportCharacter,exportOwlbear} from '../src/core/export';
import {validateCharacter,importOwlbear} from '../src/core/validation';
import {hydrateImportedCasting} from '../src/core/castingSnapshot';
import {spellState} from '../src/core/characterDetails';
import {setPreparedSpell} from '../src/core/spells';
import {reviewImport} from '../src/core/importReview';
import {createCustomEntry} from '../src/core/customEntries';
const entry=(kind:Entry['kind'],name:string,raw:Entry['raw']={}):Entry=>({id:`fixture:${kind}:${name}`,kind,name,english:name,raw,source:'PHB',edition:'2014',packId:'fixture',revision:'1',entries:['软件验收自制正文。']});
function add(c:Character,e:Entry,level=1){const s={id:e.id,entry:e,level,quantity:1,equipped:false};c.selections.push(s);return s;}
describe('194 reported regressions',()=>{
 it('does not export every known spell as prepared when an old backup has no spellSettings',()=>{
  const c=newCharacter('2014');add(c,entry('spell','尚未预备',{level:1}));const external=exportOwlbear(c,evaluate(c));
  expect(external.spellcasting.prepared).toHaveLength(0);expect(external.spellcasting.always_known.map(s=>s.name)).toEqual(['尚未预备']);
 });

 it('uses quickref display argument in the card, exported text and plain quick references',()=>{
  expect(inlineLabel('quickref','掩护||3||全身掩护')).toBe('全身掩护');expect(inlineLabel('quickref','掩护||3')).toBe('掩护');
  expect(plainText('仍处于{@quickref 掩护||3||全身掩护}状态。')).toBe('仍处于全身掩护状态。');
  expect(inlineLabel('spell','测试|PHB|别名')).toBe('别名');expect(inlineLabel('dice','1d6|测试骰')).toBe('测试骰');
 });
 it('enforces multiclass only on new additions, retaining existing class levels',()=>{
  const c=newCharacter('2014');add(c,entry('class','甲',{hd:{faces:8}}),8);const b=entry('class','乙',{hd:{faces:6}});
  expect(candidateReason(c,b)).toContain('兼职');c.profile.optional.multiclass=true;expect(candidateReason(c,b)).toBeUndefined();add(c,b,3);c.profile.optional.multiclass=false;expect(evaluate(c).level).toBe(11);
 });
 it('retains rolled HP per class/level through changes, exports, and Constitution changes',()=>{
  const c=newCharacter('2014'),a=add(c,entry('class','甲',{hd:{faces:8}}),3),b=add(c,entry('class','乙',{hd:{faces:6}}),2);c.abilities.con=14;
  expect(evaluate(c).maxHp).toBe(36);c.hpProgression={mode:'rolled',rolls:{[a.id]:[null,2,7],[b.id]:[1,6]}};
  expect(evaluate(c).maxHp).toBe(34);const restored=validateCharacter(exportCharacter(c));expect(evaluate(restored).maxHp).toBe(34);
  restored.abilities.con=16;expect(evaluate(restored).maxHp).toBe(39);restored.baseHp=50;expect(evaluate(restored).maxHp).toBe(50);
  restored.baseHp=0;restored.hpProgression!.mode='average';expect(evaluate(restored).maxHp).toBe(41);
 });
 it('restores imported spellbook casting declarations without forcing custom classes or duplicates',()=>{
  const legacy={schema_version:'0.3',meta:{ruleset:'2014'},identity:{character_name:'导入法术书'},abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(a=>[a,{total:a==='int'?16:10}])),classes:[{name:'测试书法师',level:4}],spellcasting:{prepared:[],always_known:[{name:'一环测试',level:1}]}};
  const c=importOwlbear(legacy),book=entry('class','测试书法师',{casterProgression:'full',spellcastingAbility:'int',preparedSpells:'<$level$> + <$int_mod$>',spellsKnownProgressionFixed:[6,2,2,2]});
  expect(c.spellSettings?.mode).toBe('known');expect(hydrateImportedCasting(c,[book])).toBe(true);expect(spellState(c).mode).toBe('prepared');expect(spellState(c).capacity).toBe(7);
  const spell=c.selections.find(s=>s.entry.kind==='spell')!;expect(setPreparedSpell(c,spell.id,true)).toBe(true);expect(setPreparedSpell(c,spell.id,false)).toBe(true);expect(c.selections.filter(s=>s.entry.kind==='spell')).toHaveLength(1);
  expect(hydrateImportedCasting(c,[book])).toBe(false);
  const ambiguous=importOwlbear(legacy);expect(hydrateImportedCasting(ambiguous,[book,{...book,id:'second'}])).toBe(false);
 });
 it('reports disabled classes before import, without discarding their levels or proficiencies',()=>{
  const c=newCharacter('2014');add(c,entry('class','保留职业'),8);c.proficiencies={history:true};const effective={...c,edition:'2024' as const,profile:{...c.profile,enabledSources:['XPHB']}};
  const review=reviewImport(c,effective,'2024');expect(review).toMatchObject({editionMismatch:true,editionChanged:true,totalLevel:8,effectiveLevel:0});expect(review.disabled).toHaveLength(1);expect(c.proficiencies.history).toBe(true);
 });
 it('permits personal custom content without enabling a room-wide source or bypassing explicit bans',()=>{
  const c=newCharacter();const e=createCustomEntry({name:'自定义职业',type:'class',body:'正文'});delete e.raw._workbenchCustom;
  expect(candidateReason(c,e)).toBeUndefined();c.profile.disabledEntries=[e.id];expect(candidateReason(c,e)).toContain('禁用');
 });
});
