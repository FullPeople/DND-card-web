import {type Character,uid} from './model';
import {importOwlbear,parseFile,validateCharacter} from './validation';

/** Validate the entire selection before any workspace or room mutation. */
export function readCharacterTransfer(texts:string[]):Character[]{
  const cards:Character[]=[];
  for(const text of texts){
    const value:any=parseFile(text);
    const values=value?.format==='dnd-card-web-collection'?(value.version===1&&Array.isArray(value.characters)?value.characters:(()=>{throw Error('角色集合格式或版本无效');})()):[value];
    for(const row of values){
      if(cards.length>=200)throw Error('一次最多导入 200 张角色卡');
      const card=structuredClone(row?.schema_version?importOwlbear(row):validateCharacter(row));
      card.id=uid();card.revision=1;card.updatedAt=new Date().toISOString();
      cards.push(card);
    }
  }
  if(!cards.length)throw Error('没有可导入的角色');
  return cards;
}

export function deleteLocalCharacters(characters:Character[],activeId:string,ids:string[]){
  const selected=new Set(ids),remaining=characters.filter(c=>!selected.has(c.id));
  if(!remaining.length)throw Error('请至少保留一张角色卡');
  return {characters:remaining,activeId:remaining.some(c=>c.id===activeId)?activeId:remaining[0].id};
}
