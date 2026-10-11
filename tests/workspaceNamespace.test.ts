import {describe,expect,it} from 'vitest';
import {workspaceNamespace,legacyRecoveryIds} from '../src/platform/workspaceNamespace';

const options={standalone:true,automationDevelopment:false};
describe('workspace database and editor lock ownership',()=>{
 it('separates host workspaces even when the iframe uses the standalone build',()=>{
  const a=workspaceNamespace({...options,workbenchSession:'room/a'}),b=workspaceNamespace({...options,workbenchSession:'room/b'});
  expect(a.database).not.toBe(b.database);expect(a.editorLock).not.toBe(b.editorLock);
  expect(a.database).not.toBe(workspaceNamespace(options).database);
  expect(a.editorLock).not.toBe(workspaceNamespace(options).editorLock);
  expect(a.cacheDatabase).toBe(b.cacheDatabase);expect(a.legacyRecoveries).toBe(true);
 });
 it('gives repeated views of the same host workspace the same database and lock',()=>{
  expect(workspaceNamespace({...options,workbenchSession:'room/a'})).toEqual(workspaceNamespace({...options,workbenchSession:'room/a'}));
 });
 it('keeps cloud room identities separate and gives them precedence',()=>{
  const a=workspaceNamespace({...options,qqRoom:'cloud/a',workbenchSession:'host/a'}),b=workspaceNamespace({...options,qqRoom:'cloud/b'});
  expect(a.database).not.toBe(b.database);expect(a.editorLock).not.toBe(b.editorLock);expect(a.cacheDatabase).toBe(a.database);expect(a.legacyRecoveries).toBe(false);
 });
 it('preserves existing standalone, development and generic storage',()=>{
  expect(workspaceNamespace(options).database).toBe('dnd-card-standalone');
  expect(workspaceNamespace({...options,automationDevelopment:true}).database).toBe('dnd-card-automation-choices-20261001');
  expect(workspaceNamespace({...options,standalone:false}).database).toBe('dnd-card-workspace');
  expect(workspaceNamespace(options).editorLock).toBe('dnd-card-editor');
 });
 it('encodes arbitrary session delimiters without collapsing distinct scopes',()=>{
  expect(workspaceNamespace({...options,workbenchSession:'a/b'}).database).not.toBe(workspaceNamespace({...options,workbenchSession:'a%2Fb'}).database);
 });
});
describe('legacy draft export authorization',()=>{
 const access={room:'allowed-room',cards:[{id:'one'},{id:'two'}],enabled:{characterCards:true}};
 it('exports only identities in the current host reading directory',()=>expect(legacyRecoveryIds(access)).toEqual(['suite:allowed-room:card:one','suite:allowed-room:card:two']));
 it('does not read old drafts before access is known or while cards are disabled',()=>{
  expect(legacyRecoveryIds(undefined)).toEqual([]);expect(legacyRecoveryIds({...access,enabled:{characterCards:false}})).toEqual([]);
 });
});
