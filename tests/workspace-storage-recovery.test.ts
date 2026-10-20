import 'fake-indexeddb/auto';
import {IDBFactory} from 'fake-indexeddb';
import {openDB} from 'idb';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {newCharacter} from '../src/core/model';
import {openWorkspaceDatabase,workspaceConnection,workspaceRecoveryKey} from '../src/platform/workspaceDatabase';
import {readWorkspaceRecovery,recoverWorkspaceFromText} from '../src/platform/workspaceRecovery';
import {recoveredBinding} from '../src/cloud/recoveredBinding';
import type {CloudCard} from '../src/cloud/api';
import {withSiteSources} from '../src/core/siteSources';

beforeEach(()=>{vi.resetModules();vi.doMock('../src/platform/buildMode',()=>({standalone:true,automationDevelopment:false}));vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('location',{search:'',hash:''});});
afterEach(()=>{vi.unstubAllGlobals();vi.doUnmock('../src/platform/buildMode');});

describe('workspace schema ownership',()=>{
 it('can read cloud receipts before the character book first opens',async()=>{
  const {readSyncReceipts}=await import('../src/cloud/sync');
  expect(await readSyncReceipts(['cold-card'])).toEqual({'cold-card':{}});
  const {saveWorkspace,loadWorkspace}=await import('../src/platform/storage');
  const {newCharacter}=await import('../src/core/model'),card=newCharacter();
  const book={schemaVersion:1 as const,characters:[card],activeId:card.id,packs:[]};
  await saveWorkspace(book);expect(await loadWorkspace(true)).toEqual(book);
 });
 it('can remove absent cloud bindings before the book first opens',async()=>{
  vi.stubGlobal('window',new EventTarget());vi.stubGlobal('BroadcastChannel',undefined);
  const {forgetDeletedCloudCard}=await import('../src/cloud/bindings');
  await expect(forgetDeletedCloudCard('absent')).resolves.toBeUndefined();
  const {workspaceIdentity}=await import('../src/platform/workspaceIdentity');
  const database=await openDB(workspaceIdentity.database);
  expect([...database.objectStoreNames]).toEqual(['cache','documents']);database.close();
 });
});

const collection=()=>{const one=newCharacter(),two=newCharacter();one.name='Original';one.revision=19;one.runtime.hp=7;two.name='Second';return {format:'dnd-card-web-collection',version:1,characters:[one,two]};};
describe('additive schema repair',()=>{
 it('creates a fresh valid schema without a recovery marker',async()=>{
  const db=await openWorkspaceDatabase('fresh');expect(db.version).toBe(1);expect(await db.get('documents',workspaceRecoveryKey)).toBeUndefined();db.close();
 });
 it('repairs the old empty v1 shell and prevents blank autosaves',async()=>{
  const db=await openDB('dnd-card-standalone',1);db.close();
  const {loadWorkspace,saveWorkspace}=await import('../src/platform/storage');
  await expect(loadWorkspace(true)).rejects.toThrow('JSON');
  const card=newCharacter();await expect(saveWorkspace({schemaVersion:1,characters:[card],activeId:card.id,packs:[]})).rejects.toThrow('备份');
  const check=await openWorkspaceDatabase('dnd-card-standalone');expect(check.version).toBe(2);expect(await check.get('documents','workspace')).toBeUndefined();check.close();
 });
 it('adds a missing cache without changing characters, backups, bindings or other stores',async()=>{
  const db=await openDB('partial',1,{upgrade(db){db.createObjectStore('documents');db.createObjectStore('other');}});
  const book=collection(),binding={accountId:'owner',cloudId:'remote',revision:8};
  await db.put('documents',book,'workspace');await db.put('documents',{old:true},'backup');await db.put('documents',binding,'cloud-binding:one');await db.put('other','untouched','key');db.close();
  const repaired=await openWorkspaceDatabase('partial');expect(repaired.version).toBe(2);
  expect(await repaired.get('documents','workspace')).toEqual(book);expect(await repaired.get('documents','backup')).toEqual({old:true});expect(await repaired.get('documents','cloud-binding:one')).toEqual(binding);expect(await repaired.get('other','key')).toBe('untouched');expect(await repaired.get('documents',workspaceRecoveryKey)).toBeUndefined();repaired.close();
 });
 it('retains cache contents when documents are missing, then restores all card fields and identities',async()=>{
  const db=await openDB('restore',1,{upgrade(db){db.createObjectStore('cache');}});await db.put('cache',{body:'retained'},'rules');db.close();
  const backup=collection(),recovered=await recoverWorkspaceFromText('restore',JSON.stringify(backup));
  expect(recovered.characters).toEqual(backup.characters);expect(recovered.activeId).toBe(backup.characters[0].id);
  const check=await openWorkspaceDatabase('restore');expect(await check.get('cache','rules')).toEqual({body:'retained'});expect(await check.get('documents',workspaceRecoveryKey)).toBeUndefined();expect(await check.get('documents','workspace')).toEqual(recovered);check.close();
 });
 it('opens a valid later schema without downgrading or changing it',async()=>{
  const db=await openDB('future',4,{upgrade(db){db.createObjectStore('documents');db.createObjectStore('cache');db.createObjectStore('future');}});await db.put('future',42,'value');db.close();
  const check=await openWorkspaceDatabase('future');expect(check.version).toBe(4);expect(await check.get('future','value')).toBe(42);check.close();
 });
 it('cooperates with another tab upgrade and reopens a cached connection afterwards',async()=>{
  const connection=workspaceConnection('tabs'),first=await connection();
  const next=await openDB('tabs',2,{upgrade(db){db.createObjectStore('later');}});
  const reopened=await connection();expect(reopened).not.toBe(first);expect(reopened.version).toBe(2);expect(reopened.objectStoreNames.contains('later')).toBe(true);next.close();reopened.close();
 });
 it('does not cache a failed connection forever',async()=>{
  const connection=workspaceConnection('retry');vi.spyOn(indexedDB,'open').mockImplementationOnce(()=>{throw new DOMException('temporary','SecurityError');});
  await expect(connection()).rejects.toThrow('temporary');const db=await connection();expect(db.objectStoreNames.contains('documents')).toBe(true);db.close();vi.restoreAllMocks();
 });
 it('reports a blocked repair and does not delete the old database',async()=>{
  const held=await openDB('blocked',1);await expect(openWorkspaceDatabase('blocked',{blockedMs:10})).rejects.toThrow('其他标签');held.close();
  const check=await openWorkspaceDatabase('blocked');expect(check.version).toBe(2);expect(await check.get('documents',workspaceRecoveryKey)).toBeTruthy();check.close();
 });
 it('allows concurrent first readers to use one consistent schema',async()=>{
  const [one,two]=await Promise.all([openWorkspaceDatabase('parallel'),openWorkspaceDatabase('parallel')]);await one.put('documents',17,'proof');expect(await two.get('documents','proof')).toBe(17);one.close();two.close();
 });
});

describe('explicit role-book recovery',()=>{
 it('rejects an invalid second card before writing or even repairing a database',async()=>{
  const db=await openDB('invalid',1);db.close();const backup=collection();(backup.characters[1] as unknown as {edition:string}).edition='invalid';
  await expect(recoverWorkspaceFromText('invalid',JSON.stringify(backup))).rejects.toThrow();
  const check=await openDB('invalid');expect(check.version).toBe(1);expect(check.objectStoreNames.length).toBe(0);check.close();
 });
 it('rejects duplicate identities rather than renaming or discarding cards',()=>{
  const backup=collection();backup.characters[1].id=backup.characters[0].id;expect(()=>readWorkspaceRecovery(JSON.stringify(backup))).toThrow('重复');
 });
 it('never overwrites an existing workspace, backup or pending cloud receipt',async()=>{
  const db=await openWorkspaceDatabase('existing'),original={keep:'all'},receipt={pending:{revision:12}};await db.put('documents',original,'workspace');await db.put('documents','backup','backup');await db.put('documents',receipt,'cloud-sync:one');db.close();
  await expect(recoverWorkspaceFromText('existing',JSON.stringify(collection()))).rejects.toThrow('未覆盖');
  const check=await openWorkspaceDatabase('existing');expect(await check.get('documents','workspace')).toEqual(original);expect(await check.get('documents','backup')).toBe('backup');expect(await check.get('documents','cloud-sync:one')).toEqual(receipt);check.close();
 });
});

describe('explicit reconnection of a recovered private card',()=>{
 const fixture=()=>{const character=newCharacter(),remote={id:'REMOTE',revision:20,role:'owner',character} as CloudCard;return {remote,local:{...structuredClone(character),id:'cloud:owner:REMOTE',revision:90}};};
 it('reconnects identical content without changing either card',async()=>{
  const {remote,local}=fixture(),before=structuredClone({remote,local}),{receipt}=await recoveredBinding(local,remote,'owner');expect(receipt.binding).toEqual({accountId:'owner',cloudId:'REMOTE',revision:20});expect(receipt.sourceId).toBe(remote.character.id);expect({remote,local}).toEqual(before);
 });
 it('preserves both sides when their values differ',async()=>{const {remote,local}=fixture();local.runtime.hp=5;await expect(recoveredBinding(local,remote,'owner')).rejects.toThrow('内容不同');});
 it('reconstructs only shared source settings while preserving the visible sheet',async()=>{const {remote,local}=fixture();local.profile.enabledSources=['PHB','XGE'];local.profile.autoSourceDefaults=['PHB'];const sources={enabledSources:['PHB','XGE'],autoSourceDefaults:['PHB']};const {character}=await recoveredBinding(local,remote,'owner',{},sources);expect(character.profile).toEqual(remote.character.profile);expect(withSiteSources(character,sources)).toEqual(withSiteSources(local,sources));expect(character.id).toBe(local.id);});
 it('does not hide personal rule changes behind shared source settings',async()=>{const {remote,local}=fixture();local.profile.optional={...local.profile.optional,legacy:!remote.character.profile.optional.legacy};await expect(recoveredBinding(local,remote,'owner',{}, {enabledSources:local.profile.enabledSources})).rejects.toThrow('内容不同');});
 it('refuses another account or missing permissions',async()=>{const {remote,local}=fixture();await expect(recoveredBinding(local,remote,'other')).rejects.toThrow('身份');await expect(recoveredBinding(local,{...remote,role:undefined},'owner')).rejects.toThrow('权限');});
 it.each([{pending:{accountId:'owner',hash:'unknown'}},{lastError:{phase:'uncertain' as const,message:'keep'}},{binding:{accountId:'owner',cloudId:'REMOTE',revision:19}}])('does not replace existing sync evidence %j',async previous=>{const {remote,local}=fixture();await expect(recoveredBinding(local,remote,'owner',previous)).rejects.toThrow('待核对');});
});
