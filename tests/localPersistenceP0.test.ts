import 'fake-indexeddb/auto';
import {beforeEach,expect,it,vi} from 'vitest';
import {newCharacter} from '../src/core/model';
import {snapshotSaveQueue} from '../src/platform/snapshotSaveQueue';
import type {Workspace} from '../src/platform/storage';
vi.mock('../src/platform/buildMode',()=>({standalone:false}));
vi.mock('../src/cloud/room',()=>({qqRoom:false}));
let database='';
vi.mock('../src/platform/workspaceIdentity',()=>({get workspaceIdentity(){return {database,cacheDatabase:database};}}));
beforeEach(()=>{vi.resetModules();database='p0-local-'+crypto.randomUUID();});
it('keeps both characters, portrait, packs and the durable backup after burst saves and reload',async()=>{
 const {saveWorkspace,loadWorkspace,restoreBackup}=await import('../src/platform/storage');
 const first=newCharacter(),second=newCharacter();first.name='Local fixture';first.portrait={data:'data:image/png;base64,fixture',x:0,y:0,zoom:1};second.notes='Keep other character';
 const before:Workspace={schemaVersion:1,characters:[first,second],activeId:first.id,packs:[]};await saveWorkspace(before);
 const write=vi.fn(saveWorkspace),q=snapshotSaveQueue(write),saves:Promise<void>[]=[];
 for(let hp=1;hp<=50;hp++)saves.push(q.enqueue({...before,characters:[{...first,runtime:{...first.runtime,hp}},second]}));
 q.flush();await Promise.all(saves);expect(write).toHaveBeenCalledOnce();const reloaded=await loadWorkspace();expect(reloaded!.characters[0].runtime.hp).toBe(50);expect(reloaded!.characters[0].portrait).toEqual(first.portrait);expect(reloaded!.characters[1]).toEqual(second);expect(await restoreBackup()).toEqual(before);
});
