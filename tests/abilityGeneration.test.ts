import {it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {abilityRoll,rollAbilityScores,d6FromRandomByte,assignedAbilityValues,pointBuyCost,pointBuySpent,pointBuyValues,replaceBaseAbilities} from '../src/core/abilityGeneration';

const high={str:15,dex:15,con:15,int:8,wis:8,cha:8};
it('charges nonlinear high scores and rejects unfinished, overspent or out-of-range previews',()=>{
 expect(pointBuySpent(high)).toBe(27);expect(pointBuyValues(high)).toEqual(high);
 expect(pointBuySpent({str:13,dex:13,con:13,int:12,wis:12,cha:12})).toBe(27);
 expect(pointBuyCost(14)-pointBuyCost(13)).toBe(2);expect(pointBuyCost(15)-pointBuyCost(14)).toBe(2);
 for(const values of [{...high,str:14},{...high,int:9}])expect(()=>pointBuyValues(values)).toThrow('27');
 for(const value of [7,16,9.5,NaN,Infinity])expect(()=>pointBuySpent({...high,str:value})).toThrow('8 至 15');
});
it('drops exactly one lowest die even for ties and retains the original four-die evidence',()=>{
 const dice=Object.freeze([1,1,1,6]);expect(abilityRoll(dice)).toEqual({dice:[1,1,1,6],dropped:0,score:8});expect(dice).toEqual([1,1,1,6]);
 expect(abilityRoll([6,6,6,6])).toMatchObject({dropped:0,score:18});
 for(const invalid of [[1,2,3],[1,2,3,7],[1,2,3,0],[1,2,3,2.5]])expect(()=>abilityRoll(invalid)).toThrow('四枚');
 let calls=0;const rolls=rollAbilityScores(()=>{calls++;return 4;});expect(calls).toBe(24);expect(rolls.map(roll=>roll.score)).toEqual([12,12,12,12,12,12]);
});
it('rejects the biased byte tail and invalid entropy instead of inventing a die result',()=>{
 const bytes=[255,252,5];expect(d6FromRandomByte(()=>bytes.shift()!)).toBe(6);expect(bytes).toEqual([]);
 for(const value of [-1,256,1.5,NaN])expect(()=>d6FromRandomByte(()=>value)).toThrow('随机数来源');
 expect(()=>rollAbilityScores(()=>7)).toThrow('d6');
});
it('assigns each roll once, preserving separate identities for equal scores',()=>{
 const rolls=rollAbilityScores(()=>4);rolls[0]=abilityRoll([6,6,6,1]);const before=structuredClone(rolls);
 expect(assignedAbilityValues(rolls,[1,0,2,3,4,5])).toEqual({str:12,dex:18,con:12,int:12,wis:12,cha:12});expect(rolls).toEqual(before);
 for(const order of [[0,0,2,3,4,5],[0,1,2,3,4],[0,1,2,3,4,6]])expect(()=>assignedAbilityValues(rolls,order)).toThrow('各分配一次');
 expect(()=>assignedAbilityValues([{...rolls[0],score:20},...rolls.slice(1)],[0,1,2,3,4,5])).toThrow('记录不符');
});
it('changes only base values and rejects stale cards or malformed replacements before mutation',()=>{
 const c=newCharacter();c.notes='Preserve manual notes';c.backgroundChoices={authored:{abilities:{str:2,dex:1}}};c.answers.authored=['kept'];c.runtime.hp=3;c.runtime.resources={spent:{name:'Authored spent resource',max:5,current:1}};
 const before=structuredClone(c),baseline={id:c.id,abilities:{...c.abilities}};
 replaceBaseAbilities(c,pointBuyValues(high),baseline);expect(c).toEqual({...before,abilities:high});
 const applied=structuredClone(c);
 for(const invalid of [{...high,str:31},{...high,str:1.5}])expect(()=>replaceBaseAbilities(c,invalid,{id:c.id,abilities:{...c.abilities}})).toThrow('1 至 30');
 expect(c).toEqual(applied);expect(()=>replaceBaseAbilities(c,high,baseline)).toThrow('已变化');expect(c).toEqual(applied);
 expect(()=>replaceBaseAbilities(c,high,{id:'other-card',abilities:{...c.abilities}})).toThrow('已切换');expect(c).toEqual(applied);
});
