import 'fake-indexeddb/auto';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {openDB} from 'idb';
import {newCharacter} from '../src/core/model';
import {snapshotMemo} from '../src/platform/snapshotMemo';
import {workspaceNavigationWriter} from '../src/platform/workspaceNavigationWriter';
import {cloudSaveScheduler} from '../src/cloud/saveScheduler';
import type {Workspace} from '../src/platform/storage';

afterEach(()=>vi.useRealTimers());
const book=():Workspace=>{const characters=[newCharacter(),newCharacter()];return {schemaVersion:1,characters,activeId:characters[0].id,packs:[]};};
describe('warm standalone card switches',()=>{
 it('reuses all already-opened views and recalculates a changed immutable snapshot',()=>{
  const a=newCharacter(),b=newCharacter(),memo=snapshotMemo(),compute=vi.fn(()=>({result:Math.random()}));
  const first=memo('derived',a,compute);memo('derived',b,compute);
  for(let i=0;i<100;i++){expect(memo('derived',a,compute)).toBe(first);memo('derived',b,compute);}
  expect(compute).toHaveBeenCalledTimes(2);
  memo('derived',{...a,runtime:{...a.runtime,hp:12}},compute);expect(compute).toHaveBeenCalledTimes(3);
  memo('choices',a,compute);expect(compute).toHaveBeenCalledTimes(4);
  snapshotMemo()('derived',a,compute);expect(compute).toHaveBeenCalledTimes(5);
 });
 it('keeps the normal and embedded paths uncached when the isolated profile is off',()=>{
  const a=newCharacter(),memo=snapshotMemo(false),compute=vi.fn(()=>({}));memo('derived',a,compute);memo('derived',a,compute);expect(compute).toHaveBeenCalledTimes(2);
 });
 it('persists only selection metadata across repeated switches without rewriting characters',async()=>{
  const original=book(),write=vi.fn(async(_next:Workspace)=>{}),select=vi.fn(async(_next:Workspace)=>{}),save=workspaceNavigationWriter(write,select);
  await save(original);for(let i=0;i<20;i++)await save({...original,activeId:original.characters[i%2].id});
  expect(write).toHaveBeenCalledTimes(1);expect(select).toHaveBeenCalledTimes(20);
  await save({...original,characters:original.characters.map((card,i)=>i?card:{...card,name:'Changed draft'})});expect(write).toHaveBeenCalledTimes(2);
  await save({...original,packs:[]});expect(write).toHaveBeenCalledTimes(3);
 });
 it('does not treat a failed content save as durable on the next switch',async()=>{
  const original=book(),write=vi.fn().mockRejectedValueOnce(Error('quota')).mockResolvedValue(undefined),select=vi.fn(async()=>{}),save=workspaceNavigationWriter(write,select);
  await expect(save(original)).rejects.toThrow('quota');await save({...original,activeId:original.characters[1].id});expect(write).toHaveBeenCalledTimes(2);expect(select).not.toHaveBeenCalled();
 });
 it('does not restart cloud hashing or network sync when returning to an unchanged card',async()=>{
  vi.useFakeTimers();const [a,b]=book().characters,sync=vi.fn(async()=>{}),scheduler=cloudSaveScheduler(sync);
  scheduler.enable(true);scheduler.observe([a,b],a.id);await vi.advanceTimersByTimeAsync(650);scheduler.observe([a,b],b.id);await vi.advanceTimersByTimeAsync(650);expect(sync).toHaveBeenCalledTimes(2);sync.mockClear();
  for(let i=0;i<20;i++){scheduler.observe([a,b],i%2?a.id:b.id);await vi.advanceTimersByTimeAsync(700);}expect(sync).not.toHaveBeenCalled();
  const changed={...a,runtime:{...a.runtime,hp:12}};scheduler.observe([changed,b],a.id);scheduler.observe([changed,b],b.id);await vi.advanceTimersByTimeAsync(650);expect(sync.mock.calls).toEqual([[a.id]]);scheduler.enable(false);
 });
 it('restores metadata after refresh, preserves content and backups, then clears old selection on a full save',async()=>{
  vi.resetModules();vi.stubGlobal('location',{search:'',hash:''});
  const {loadWorkspace,saveWorkspace,saveWorkspaceSelection,restoreBackup}=await import('../src/platform/storage');
  const {workspaceIdentity}=await import('../src/platform/workspaceIdentity'),original=book();
  const changed={...original,characters:original.characters.map((card,i)=>i?card:{...card,runtime:{...card.runtime,hp:17}})};
  await saveWorkspace(original);await saveWorkspace(changed);
  const beforeBackup=await restoreBackup();await saveWorkspaceSelection({...changed,activeId:changed.characters[1].id});
  expect((await loadWorkspace(true))?.activeId).toBe(changed.characters[1].id);expect((await loadWorkspace())?.activeId).toBe(changed.activeId);
  expect((await loadWorkspace(true))?.characters).toEqual(changed.characters);expect(await restoreBackup()).toEqual(beforeBackup);
  const db=await openDB(workspaceIdentity.database,1);expect(await db.get('documents','workspace-active-id')).toBe(changed.characters[1].id);
  await saveWorkspace(changed);expect(await db.get('documents','workspace-active-id')).toBeUndefined();expect((await loadWorkspace(true))?.activeId).toBe(changed.activeId);db.close();vi.unstubAllGlobals();
 });
});
