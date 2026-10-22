import {newCharacter,type Entry} from '../src/core/model';

export function authoredCards(size:number){
 return Array.from({length:3},(_,index)=>{
  const c=newCharacter(index===1?'2014':'2024');c.name=['暮色巡守','银叶学者','远岸行者'][index];c.baseHp=26+index*8;c.runtime.hp=18+index*5;c.abilities={str:10+index*2,dex:16-index,con:14,int:12+index*2,wis:13,cha:10};c.profile.enabledSources=['SWITCH_LAB'];
  c.selections=Array.from({length:size},(_,i)=>{
   const entry:Entry={id:`switch-lab:feature:${index}:${i}`,kind:'feature',name:`原创特性 ${i+1}`,english:`Authored feature ${i+1}`,source:'SWITCH_LAB',edition:c.edition,packId:'authored-switch-lab',revision:'1',entries:[`这是一条用于比较卡面大小的原创说明，编号 ${i+1}。它不授予资源，也不包含外部规则。`],raw:{}};
   return {id:entry.id,entry,level:1,quantity:1,equipped:false};
  });return c;
 });
}
