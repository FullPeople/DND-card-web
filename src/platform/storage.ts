import {standalone,automationDevelopment} from './buildMode';
import { openDB } from 'idb';
import type { Character, Entry, Raw, RulePack } from '../core/model';
import type {SiteSources} from '../core/siteSources';
import {qqRoom,readRoom,saveRoom,roomState} from '../cloud/room';
export interface Workspace { schemaVersion: 1; characters: Character[]; activeId: string; packs: RulePack[]; customEntries?:Entry[]; siteSources?:SiteSources; legacySourceProfiles?:Record<string,SiteSources> }
let connection: ReturnType<typeof openDB> | undefined;
const db = () => connection ??= openDB(qqRoom?'dnd-card-qq-room:'+qqRoom:automationDevelopment?'dnd-card-automation-choices-20261001':standalone?'dnd-card-standalone':'dnd-card-workspace', 1, { upgrade(db) { db.createObjectStore('documents'); db.createObjectStore('cache'); } });
export async function loadWorkspace(): Promise<Workspace | undefined> {
  if(!qqRoom)return (await db()).get('documents','workspace');
  const remote=await readRoom(),database=await db(),draft=await database.get('documents','room-pending') as {workspace:Workspace;revision:number}|undefined;
  if(draft)return draft.workspace;
  return {schemaVersion:1,characters:[remote.character],activeId:remote.character.id,packs:remote.character.rulePacks||[]};
}
export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const database = await db(); const tx = database.transaction('documents', 'readwrite');
  const previous = await tx.store.get('workspace');
  if (previous) await tx.store.put(previous, 'backup');
  await tx.store.put(workspace, 'workspace'); await tx.done;
  if(qqRoom){
    if(workspace.characters.length!==1||workspace.activeId!==roomState()?.character.id)throw Error('房间卡不能创建、替换或删除云端原卡。');
    const database=await db(),pending=await database.get('documents','room-pending') as {revision:number}|undefined,revision=pending?.revision??roomState()!.revision;
    await database.put('documents',{workspace,revision},'room-pending');
    await saveRoom(workspace.characters[0],revision);await database.delete('documents','room-pending');
  }
}
export async function hasRoomDraft(){return qqRoom?!!await (await db()).get('documents','room-pending'):false;}
export async function archiveRoomDraft(){if(!qqRoom)return;const database=await db(),tx=database.transaction('documents','readwrite'),draft=await tx.store.get('room-pending');if(draft)await tx.store.put(draft,'room-recovery:'+Date.now());await tx.store.delete('room-pending');await tx.done;}
export async function restoreBackup(): Promise<Workspace | undefined> { return (await db()).get('documents', 'backup'); }
export async function readCache(key: string): Promise<{ body: Raw; revision: string } | undefined> { return (await db()).get('cache', key); }
export async function writeCache(key: string, data: { body: Raw; revision: string }): Promise<void> { await (await db()).put('cache', data, key); }
export function download(name: string, value: unknown, type = 'application/json'): void {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  downloadBlob(name,new Blob([text], { type: `${type};charset=utf-8` }));
}
export function downloadBlob(name:string,blob:Blob):void{
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export function pickFile(accept = '.json'): Promise<File | undefined> {
 return new Promise(resolve=>{
  const input=document.createElement('input');
  input.type='file';input.accept=accept;input.dataset.filePicker='true';
  Object.assign(input.style,{position:'fixed',width:'1px',height:'1px',opacity:'0',pointerEvents:'none'});
  const parent=[...document.querySelectorAll('dialog[open]')].at(-1)||document.body;parent.append(input);
  let done=false;
  // A window focus event can precede the Windows chooser closing. Never detach
  // its owner or force focus while that native modal is still unwinding.
  const finish=(event:Event)=>{event.stopPropagation();if(done)return;done=true;const file=input.files?.[0];setTimeout(()=>{input.remove();resolve(file);},0);};
  input.addEventListener('change',finish,{once:true});input.addEventListener('cancel',finish,{once:true});
  input.click();
 });
}

/** A single recoverable draft per remote identity, separate from the character book. */
export async function saveRecovery(character:Character){const database=await db();const key='recovery:'+character.id;const tx=database.transaction('documents','readwrite');const old=await tx.store.get(key);if(!old||old.revision<=character.revision)await tx.store.put(structuredClone(character),key);await tx.done;}
export async function loadRecoveries():Promise<Character[]>{const database=await db();const keys=await database.getAllKeys('documents');return Promise.all(keys.filter(k=>String(k).startsWith('recovery:')).map(k=>database.get('documents',k)));}

export interface CloudBinding {accountId:string;cloudId:string;revision:number}
export async function loadCloudBindings():Promise<Record<string,CloudBinding>>{
 const database=await db(),keys=await database.getAllKeys('documents');
 const pairs=await Promise.all(keys.filter(key=>String(key).startsWith('cloud-binding:')).map(async key=>[String(key).slice(14),await database.get('documents',key)] as const));return Object.fromEntries(pairs);
}
export async function saveCloudBinding(localId:string,binding:CloudBinding){await (await db()).put('documents',binding,'cloud-binding:'+localId);}
export async function stageCloudDraft(character:Character,binding:CloudBinding):Promise<string>{
 const id='cloud:'+binding.accountId+':'+binding.cloudId,database=await db(),tx=database.transaction('documents','readwrite');
 const workspace=await tx.store.get('workspace') as Workspace|undefined;
 // Reopening a cloud card always keeps its existing local draft and baseline.
 // A conflicting or revoked save must not be erased by opening the editor.
 if(!workspace?.characters.some(card=>card.id===id)&&!await tx.store.get('cloud-staged:'+id)){
  await tx.store.put({...structuredClone(character),id},'cloud-staged:'+id);await tx.store.put(binding,'cloud-binding:'+id);
 }
 await tx.done;return id;
}
export async function prepareCloudDraft(workspace:Workspace|undefined,canWrite:boolean):Promise<Workspace|undefined>{
 const id=new URLSearchParams(location.search).get('cloudDraft');if(!standalone||!id)return workspace;
 if(workspace?.characters.some(card=>card.id===id))return {...workspace,activeId:id};
 const card=await (await db()).get('documents','cloud-staged:'+id) as Character|undefined;
 if(!card)throw Error('没有找到待编辑的本机草稿，请从卡库重新打开。');
 const packs=[...(workspace?.packs||[])];
 for(const pack of card.rulePacks||[]){const old=packs.find(row=>row.id===pack.id);if(old&&JSON.stringify(old)!==JSON.stringify(pack))throw Error('云端卡的规则包与本机版本不同，请先导出备份并用完整 JSON 导入核对。');if(!old)packs.push(pack);}
 return {...workspace,schemaVersion:1,characters:[...(workspace?.characters||[]),card],activeId:id,packs};
}
