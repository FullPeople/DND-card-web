import { openDB } from 'idb';
import type { Character, Raw, RulePack } from '../core/model';
export interface Workspace { schemaVersion: 1; characters: Character[]; activeId: string; packs: RulePack[] }
let connection: ReturnType<typeof openDB> | undefined;
const db = () => connection ??= openDB('dnd-card-workspace', 1, { upgrade(db) { db.createObjectStore('documents'); db.createObjectStore('cache'); } });
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
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function pickFile(accept = '.json'): Promise<File | undefined> {
  return new Promise(resolve => { const input = document.createElement('input'); input.type = 'file'; input.accept = accept;
    input.onchange = () => resolve(input.files?.[0]); input.oncancel = () => resolve(undefined); input.click(); });
}
