import {describe,it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {includeNewDefaultSources,startAllSources} from '../src/core/sourceDefaults';
import {validateCharacter} from '../src/core/validation';
describe('default all expansion sources',()=>{
 it('enables late catalog sources but retains explicit source and entry exclusions after reload',()=>{
  const character=startAllSources(newCharacter('2014'),['SCAG','XGE']);
  character.profile.enabledSources=character.profile.enabledSources.filter(id=>id!=='SCAG');
  character.profile.disabledEntries=['xge-feat'];
  const restored=validateCharacter(JSON.parse(JSON.stringify(character)));
  const updated=includeNewDefaultSources(restored,['SCAG','XGE','VSS','VSS']);
  expect(updated.profile.enabledSources).toContain('VSS');expect(updated.profile.enabledSources).not.toContain('SCAG');
  expect(updated.profile.disabledEntries).toEqual(['xge-feat']);expect(updated.edition).toBe('2014');
  expect(includeNewDefaultSources(updated,['SCAG','XGE','VSS'])).toBe(updated);
 });
 it('leaves existing/manual profiles untouched',()=>{
  const old=newCharacter();expect(includeNewDefaultSources(old,['VSS'])).toBe(old);
  const manual=startAllSources(old,['VSS']);delete manual.profile.autoSourceDefaults;manual.profile.enabledSources=[];
  expect(includeNewDefaultSources(manual,['VSS','LATE'])).toBe(manual);
 });
 it('rejects invalid persisted default-source bookkeeping',()=>{
  const c=newCharacter();(c.profile as any).autoSourceDefaults='all';expect(()=>validateCharacter(c)).toThrow('默认资料来源');
 });
});
