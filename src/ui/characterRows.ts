import type {Character,RulePack} from '../core/model';
import {evaluate} from '../core/engine';
import {withSiteSources,type SiteSources} from '../core/siteSources';
import type {CharacterRow} from './CharacterManager';
export function localCharacterRow(c:Character):CharacterRow{const d=evaluate(c);return {id:c.id,name:c.name,player:c.player,edition:c.edition,classes:c.selections.filter(s=>s.entry.kind==='class').map(s=>`${s.entry.name} ${s.level}`).join(' / '),hp:c.runtime.hp,maxHp:d.maxHp,ac:d.ac,level:d.level,write:true,locked:c.locked};}

/** Immutable documents share derived summaries; live permissions remain outside this cache. */
export function createCharacterRowReader(){
 const summaries=new WeakMap<Character,{sources:SiteSources|undefined;packs:RulePack[]|undefined;row:CharacterRow}>();
 return (character:Character,sources?:SiteSources,packs?:RulePack[]):CharacterRow=>{
  const cached=summaries.get(character);
  if(cached&&cached.sources===sources&&cached.packs===packs)return cached.row;
  const row=localCharacterRow(withSiteSources(character,sources,packs));
  summaries.set(character,{sources,packs,row});
  return row;
 };
}
