import type {Character,Derived} from '../core/model';
import {evaluate} from '../core/engine';
import {runtimeCharacterBase} from '../core/runtimeCharacterEdit';

/** Only explicit balance forks share construction identity. Normal edits,
 * incoming documents and different room rules must be evaluated independently. */
export function createWorkbenchDerivation(compute:(character:Character)=>Derived=evaluate){
 const cache=new WeakMap<Character,{edition:Character['edition'];profile:Character['profile'];packs:Character['rulePacks'];derived:Derived}[]>();
 return (character:Character,projection:Character=character):Derived=>{
  const base=runtimeCharacterBase(character),views=cache.get(base)||[];
  const hit=views.find(view=>view.edition===projection.edition&&view.profile===projection.profile&&view.packs===projection.rulePacks);
  if(hit)return hit.derived;
  const derived=compute(projection);
  cache.set(base,[{edition:projection.edition,profile:projection.profile,packs:projection.rulePacks,derived},...views].slice(0,2));
  return derived;
 };
}
export const workbenchDerived=createWorkbenchDerivation();
