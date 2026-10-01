import {describe,expect,it,vi} from 'vitest';
import {newCharacter,type Character} from '../src/core/model';
import type {Workspace} from '../src/platform/storage';

/** The legacy `documents` store as an older version may have left it. */
const documents=vi.hoisted(()=>new Map<string,unknown>());
vi.mock('idb',()=>({openDB:async()=>({get:async(_store:string,key:string)=>structuredClone(documents.get(key))})}));
const {loadWorkspace,restoreBackup}=await import('../src/platform/storage');

const SERVER='server:11111111-1111-4111-8111-111111111111';
const card=(id:string):Character=>({...newCharacter('2024'),id,name:id});
const polluted=():Workspace=>({schemaVersion:1,characters:[card('local-A'),card(SERVER)],activeId:SERVER,packs:[]});

describe('legacy workspace read boundary',()=>{
  it('drops server:* rows from a stored workspace and re-points activeId',async()=>{
    documents.set('workspace',polluted());
    const loaded=(await loadWorkspace())!;
    expect(loaded.characters.map(c=>c.id)).toEqual(['local-A']);expect(loaded.activeId).toBe('local-A');
    expect(JSON.stringify(loaded)).not.toContain('server:');
  });
  it('drops server:* rows from a stored backup the same way',async()=>{
    documents.set('backup',polluted());
    const restored=(await restoreBackup())!;
    expect(restored.characters.map(c=>c.id)).toEqual(['local-A']);expect(restored.activeId).toBe('local-A');
  });
  it('returns nothing for a server-only workspace, so startup creates a local one',async()=>{
    documents.set('workspace',{schemaVersion:1,characters:[card(SERVER)],activeId:SERVER,packs:[]});
    expect(await loadWorkspace()).toBeUndefined();
  });
});
