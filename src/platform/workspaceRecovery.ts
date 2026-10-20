import type {Workspace} from './storage';
import type {Character,RulePack} from '../core/model';
import {parseFile,validateCharacter,validatePack} from '../core/validation';
import {openWorkspaceDatabase,workspaceRecoveryKey} from './workspaceDatabase';

/** Recovery keeps identities and revisions. Ordinary imports still make copies. */
export function readWorkspaceRecovery(text:string):Workspace{
 if(text.length>20*1024*1024)throw Error('备份文件超过 20 MB，未修改本机记录。');
 const value=parseFile(text) as Partial<Workspace>&{format?:string;version?:number};
 const collection=value.format==='dnd-card-web-collection'&&value.version===1;
 if(!collection&&value.schemaVersion!==1)throw Error('请选择完整角色簿 JSON 备份。');
 if(!Array.isArray(value.characters)||!value.characters.length||value.characters.length>200)throw Error('角色簿应包含 1 至 200 张角色卡。');
 const characters=value.characters.map(card=>validateCharacter(structuredClone(card))) as Character[];
 if(new Set(characters.map(card=>card.id)).size!==characters.length)throw Error('备份内存在重复角色身份，未修改本机记录。');
 const packs:RulePack[]=collection?[]:structuredClone(value.packs||[]);
 for(const card of characters)for(const pack of card.rulePacks||[]){
  const old=packs.find(row=>row.id===pack.id);
  if(old&&JSON.stringify(old)!==JSON.stringify(pack))throw Error('备份内的规则包版本不一致，请先核对备份。');
  if(!old)packs.push(structuredClone(pack));
 }
 for(const pack of packs)validatePack({...pack,entries:pack.entries.map(entry=>({...entry,id:entry.id.slice(pack.id.length+1)}))},packs);
 const activeId=characters.some(card=>card.id===value.activeId)?value.activeId!:characters[0].id;
 return {...(!collection?value:{}),schemaVersion:1,characters,activeId,packs};
}

export async function recoverWorkspaceFromText(name:string,text:string):Promise<Workspace>{
 const workspace=readWorkspaceRecovery(text),database=await openWorkspaceDatabase(name);
 try{
  const tx=database.transaction('documents','readwrite');
  if(await tx.store.get('workspace')){await tx.done;throw Error('本机已有角色簿，未覆盖。请先核对或导出已有角色。');}
  await tx.store.put(workspace,'workspace');await tx.store.delete('workspace-active-id');
  await tx.store.delete(workspaceRecoveryKey);await tx.done;return workspace;
 }finally{database.close();}
}
