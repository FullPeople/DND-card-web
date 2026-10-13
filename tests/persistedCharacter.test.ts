import {describe,expect,it,vi} from 'vitest';
import {newCharacter} from '../src/core/model';
import {characterHash} from '../src/cloud/sync';
import {readPersistedCharacter} from '../src/cloud/persistedCharacter';

describe('cloud reads after local persistence',()=>{
 it('still waits for both persistence reads without hashing the same document twice',async()=>{
  const card=newCharacter(),read=vi.fn(async()=>card),hash=vi.fn(characterHash);
  expect(await readPersistedCharacter(read,hash)).toBe(card);
  expect(read).toHaveBeenCalledTimes(2);expect(hash).not.toHaveBeenCalled();
 });
 it('waits again when a local edit extends the save queue during the first read',async()=>{
  const first=newCharacter(),latest={...first,notes:'Latest persisted notes'},hash=vi.fn(characterHash);
  const read=vi.fn().mockResolvedValueOnce(first).mockResolvedValue(latest);
  expect(await readPersistedCharacter(read,hash)).toBe(latest);
  expect(read).toHaveBeenCalledTimes(3);expect(hash).toHaveBeenCalledTimes(2);
 });
 it('retains another edit arriving during the second persistence wait',async()=>{
  const a=newCharacter(),b={...a,notes:'Second edit'},c={...b,notes:'Third edit'};
  const read=vi.fn().mockResolvedValueOnce(a).mockResolvedValueOnce(b).mockResolvedValue(c);
  expect(await readPersistedCharacter(read,characterHash)).toBe(c);expect(read).toHaveBeenCalledTimes(4);
 });
 it('different objects use the original content comparison including revision-only changes',async()=>{
  const a=newCharacter(),b={...a,revision:a.revision+1,updatedAt:'later'},hash=vi.fn(characterHash);
  const read=vi.fn().mockResolvedValueOnce(a).mockResolvedValue(b);
  expect(await readPersistedCharacter(read,hash)).toBe(a);expect(hash).toHaveBeenCalledTimes(2);
 });
 it('propagates a failed second persistence read instead of returning an unsaved card',async()=>{
  const a=newCharacter(),read=vi.fn().mockResolvedValueOnce(a).mockRejectedValueOnce(Error('Local save failed'));
  const hash=vi.fn(characterHash);
  await expect(readPersistedCharacter(read,hash)).rejects.toThrow('Local save failed');expect(hash).not.toHaveBeenCalled();
 });
});
