import {describe,it,expect,vi,afterEach} from 'vitest';
import {RULE_PACK_EXAMPLE} from '../src/platform/rulePackExample';
import {validatePack,validateCharacter} from '../src/core/validation';
import {newCharacter} from '../src/core/model';
import {cardSyncCopies} from '../src/platform/cardSyncCopies';
import {customVisibilityAllows} from '../src/ui/customVisibility';
import {matchesLibraryTab} from '../src/ui/libraryData';
import {rememberAnnouncementPreference,readAnnouncementPreference,rememberAnnouncementVersion,announcementPending,readAnnouncementVersion,forgetAnnouncementVersion} from '../src/platform/announcement';

afterEach(()=>vi.unstubAllGlobals());
describe('extension authoring and current-card synchronization',()=>{
 it('imports the complete example and preserves typed item properties through export and reimport',()=>{
  const input=structuredClone(RULE_PACK_EXAMPLE),before=structuredClone(input),pack=validatePack(input,[]);
  expect(input).toEqual(before);expect(pack.entries).toHaveLength(5);
  expect(pack.entries.find(e=>e.english==='Training Spear')?.raw).toMatchObject({dmg1:'1d6',property:['T','V'],value:100,weight:3});
  expect(pack.entries.find(e=>e.english==='Travel Leather Armor')?.raw).toMatchObject({type:'LA',armor:true,ac:11});
  for(const entry of pack.entries){const displayed={...entry,raw:{...entry.raw,_customPack:true}};expect(customVisibilityAllows(displayed,'custom')).toBe(true);expect(customVisibilityAllows(displayed,'native')).toBe(false);expect(matchesLibraryTab(displayed,'custom')).toBe(true);expect(matchesLibraryTab(displayed,entry.kind==='feat'?'feat':'item')).toBe(true);expect(entry.raw._customPack).toBeUndefined();}
  const character=newCharacter();character.profile.enabledSources.push(pack.id);character.rulePacks=[pack];character.selections=[{id:'selected',entry:pack.entries[1],quantity:1,level:1,equipped:true}];expect(()=>validateCharacter(JSON.parse(JSON.stringify(character)))).not.toThrow();
 });
 it('backs up the untouched original while updating the existing identity and consumed counters',()=>{
  const original=newCharacter();original.id='existing-binding';original.name='旅行者';original.revision=9;original.createdAt='2025-01-01T00:00:00.000Z';original.runtime.resources={'spent':{name:'已消耗',current:0,max:3}};
  const old=structuredClone(original),migrated=structuredClone(original);migrated.id='migration-generated-copy';migrated.name+='（同步副本）';migrated.notes='updated content';
  const {backup,current}=cardSyncCopies(original,migrated,'2026-10-09T00:00:00.000Z');
  expect(current).toMatchObject({id:original.id,name:original.name,revision:10,createdAt:original.createdAt,notes:'updated content'});expect(backup.id).not.toBe(current.id);expect(backup.notes).toBe(original.notes);expect(backup.runtime).toEqual(original.runtime);expect(current.runtime.resources.spent.current).toBe(0);
  current.runtime.resources.spent.current=1;expect(backup.runtime.resources.spent.current).toBe(0);expect(original).toEqual(old);expect(()=>validateCharacter(backup)).not.toThrow();expect(()=>validateCharacter(current)).not.toThrow();
 });
 it('keeps the remembered preference on a new release while isolating standalone and suite acknowledgments',()=>{
  const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});
  rememberAnnouncementVersion('old','suite');expect(readAnnouncementPreference('suite')).toBe(true);expect(announcementPending(readAnnouncementVersion('suite'),'new')).toBe(true);expect(readAnnouncementPreference()).toBe(false);
  rememberAnnouncementPreference(false,'suite');expect(readAnnouncementPreference('suite')).toBe(false);rememberAnnouncementVersion('new');forgetAnnouncementVersion('suite');expect(readAnnouncementVersion()).toBe('new');expect(readAnnouncementPreference()).toBe(true);
 });
});
