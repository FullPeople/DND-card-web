import {describe,it,expect} from 'vitest';
import {numericExpression} from '../src/core/numericExpression';
import {characterReview} from '../src/core/characterReview';
import {newCharacter,type Entry} from '../src/core/model';
import {setMonsterNumber,parseMonsterDraft} from '../src/core/monsterEditing';
import {normalizeLegacyUpload} from '../src/platform/legacyPlayerBridge';

describe('health arithmetic',()=>{
 it('distinguishes relative changes, absolute inputs, precedence and explicit negative totals',()=>{
  expect(numericExpression('-5',20)).toEqual({value:15,relative:true});
  expect(numericExpression('+(3*2)',20).value).toBe(26);
  expect(numericExpression('/2',20).value).toBe(10);
  expect(numericExpression('30-4*2',20)).toEqual({value:22,relative:false});
  expect(numericExpression('=-5',20)).toEqual({value:-5,relative:false});
  expect(numericExpression('=20',5).value).toBe(20);
 });
 it('rejects execution, partial expressions, nonfinite and division by zero',()=>{
  for(const invalid of ['alert(1)','1;2','2**3','1/0','(1+2','1 2','NaN','Infinity',''])expect(()=>numericExpression(invalid,20)).toThrow();
 });
});
describe('monster editor structure',()=>{
 it('edits common values without discarding conditional AC, speed or unknown fields',()=>{
  const original={name:'测试守卫',ac:[{ac:14,from:['皮甲']},{ac:16,condition:'持盾时'}],hp:{average:20,formula:'3d8+6'},speed:{walk:30,fly:{number:40,condition:'仅变形时'}},customFlag:{keep:true}};
  const next=setMonsterNumber(setMonsterNumber(setMonsterNumber(original,'ac',15),'hp',22),'speed.fly',60);
  expect(next.ac).toEqual([{ac:15,from:['皮甲']},{ac:16,condition:'持盾时'}]);expect(next.hp).toEqual({average:22,formula:'3d8+6'});expect(next.speed.fly).toEqual({number:60,condition:'仅变形时'});expect(next.customFlag).toEqual({keep:true});expect(original.ac[0].ac).toBe(14);
 });
 it('rejects malformed JSON edits before mutation',()=>{
  for(const text of ['{"name":""}','{"name":"守卫","action":{}}','{"name":"守卫","constructor":{}}'])expect(()=>parseMonsterDraft(text)).toThrow();
 });
});
describe('legacy upload bridge',()=>{
 it('retains native entry identity in the server-compatible projection',()=>{
  const c=newCharacter();c.name='旧版阅读测试';const result=normalizeLegacyUpload({format:'dnd-card-web',version:1,character:c});
  expect(result.identity.character_name).toBe(c.name);expect(result.dnd_card_web).toEqual(c);expect(normalizeLegacyUpload(result).dnd_card_web).toEqual(c);
 });
 it('rejects arbitrary data rather than creating a default character',()=>{expect(()=>normalizeLegacyUpload({name:'invalid'})).toThrow();});
});
describe('DM review projection',()=>{
 it('keeps disabled class levels and inherited restrictions visible without changing the card',()=>{
  const c=newCharacter('2024');const entry:Entry={id:'class:phb',kind:'class',name:'职业',english:'Class',source:'PHB',edition:'2014',packId:'source',revision:'1',entries:[],raw:{hd:{faces:8}}};
  c.selections=[{id:'c',entry,level:4,quantity:1,equipped:false},{id:'f',parentId:'c',entry:{...entry,id:'feature:xphb',kind:'feature',source:'XPHB',edition:'2024'},level:1,quantity:1,equipped:false}];
  c.sheetBonuses={ac:2,speed:0};const original=JSON.stringify(c),review=characterReview(c);
  expect(review.recordedLevel).toBe(4);expect(review.d.level).toBe(0);expect(review.restricted.map(s=>s.id)).toEqual(['c','f']);expect(review.manual).toHaveLength(1);expect(JSON.stringify(c)).toBe(original);
  c.profile.optional.legacy=true;expect(characterReview(c).restricted).toHaveLength(0);
 });
});
