import {standalone} from './buildMode';
import { openDB } from 'idb';
import type { Character, Entry, Raw, RulePack } from '../core/model';
export interface Workspace { schemaVersion: 1; characters: Character[]; activeId: string; packs: RulePack[]; customEntries?:Entry[] }
let connection: ReturnType<typeof openDB> | undefined;
const db = () => connection ??= openDB(standalone?'dnd-card-standalone':'dnd-card-workspace', 1, { upgrade(db) { db.createObjectStore('documents'); db.createObjectStore('cache'); } });
export async function loadWorkspace(): Promise<Workspace | undefined> { return (await db()).get('documents', 'workspace'); }
export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const database = await db(); const tx = database.transaction('documents', 'readwrite');
  const previous = await tx.store.get('workspace');
  if (previous) await tx.store.put(previous, 'backup');
  await tx.store.put(structuredClone(workspace), 'workspace'); await tx.done;
}
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
