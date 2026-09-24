import {describe,it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {ensureSiteSources,sourceSettings,withSiteSources} from '../src/core/siteSources';
import {includeNewProfileSources} from '../src/core/sourceDefaults';

describe('website source settings without changing character rules',()=>{
 it('migrates from the active card once and retains all previous source choices',()=>{
  const a=newCharacter('2014'),b=newCharacter('2024');a.profile.enabledSources=['PHB','SCAG'];b.profile.enabledSources=['XPHB','XGE'];b.profile.disabledEntries=['test'];
  const old={activeId:b.id,characters:[a,b]};const migrated=ensureSiteSources(old);
  expect(migrated.siteSources).toEqual({enabledSources:['XPHB','XGE'],disabledEntries:['test']});
  expect(migrated.legacySourceProfiles?.[a.id]).toEqual({enabledSources:['PHB','SCAG']});
  expect(ensureSiteSources({...migrated,activeId:a.id}).siteSources).toBe(migrated.siteSources);
  expect(old).not.toHaveProperty('siteSources');
 });
 it('shares availability but preserves each edition, optional rule and exemption',()=>{
  const card=newCharacter('2014');card.profile.optional.feats=false;card.profile.exceptions={own:'DM'};card.profile.disabledEntries=['old-only'];
  const effective=withSiteSources(card,{enabledSources:['PHB','XPHB','XGE'],disabledEntries:['site-item']});
  expect(effective.edition).toBe('2014');expect(effective.profile.optional).toBe(card.profile.optional);expect(effective.profile.exceptions).toEqual({own:'DM'});
  expect(effective.profile.disabledEntries).toEqual(['site-item']);expect(card.profile.disabledEntries).toEqual(['old-only']);
  expect(withSiteSources(card,{enabledSources:[]}).profile.disabledEntries).toBeUndefined();
 });
 it('new sources can default on globally without reenabling unchecked ones',()=>{
  const sources={enabledSources:['XPHB'],autoSourceDefaults:['XPHB','XGE'],disabledEntries:['spell']};
  const updated=includeNewProfileSources(sources,['XGE','VSS']);expect(updated.enabledSources).toEqual(['XPHB','VSS']);expect(updated.disabledEntries).toEqual(['spell']);
 });
 it('source imports cannot change edition or optional character rules',()=>{
  const c=newCharacter('2014');const profile={...newCharacter('2024').profile,enabledSources:['XGE'],optional:{feats:false,multiclass:true,legacy:true}};
  const projected=withSiteSources(c,sourceSettings(profile));expect(projected.edition).toBe('2014');expect(projected.profile.optional).toEqual(c.profile.optional);
 });
});
