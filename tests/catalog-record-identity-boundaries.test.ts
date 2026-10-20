import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter,type Entry} from '../src/core/model';
import {recordNavigationKey,resolveCatalogId,catalogIdCandidates,mergeCatalogRecords,legacyCatalogId} from '../src/core/entryRecordIdentity';
import {sha256Hex} from '../src/core/entryIdentityHash';
import {choiceEntryMatcher,optionForEntry} from '../src/ui/choiceCatalog';
import type {SheetChoice} from '../src/core/automation/choices';
import {referenceEntryCategory,referenceEntryKind,resolveEntryReference} from '../src/core/entryReferences';
const definitions=()=>normalizeData({feat:['Authored First','Authored Second'].map(name=>({name,ENG_name:'Shared Authored Feat',source:'XPHB',edition:'one',entries:[`Original ${name} description.`]}))},'r','authored');

it.each(['','Original Unicode 原创文本 🎲'])('portable identity hashes match the platform SHA-256 for %j',value=>{
 expect(sha256Hex(value)).toBe(createHash('sha256').update(value,'utf8').digest('hex'));
});
it('incremental merging removes a superseded old alias and preserves unrelated records',()=>{
 const entries=definitions(),old=structuredClone(entries[0]);old.id=legacyCatalogId(old);delete old.raw._catalogLegacyId;
 const unrelated={...old,id:'unrelated',name:'Keep unrelated'};
 const map=new Map<string,Entry>([[old.id,old],[unrelated.id,unrelated]]);
 mergeCatalogRecords(map,entries);mergeCatalogRecords(map,entries);
 expect(map.size).toBe(3);expect(map.has(old.id)).toBe(false);expect(map.get('unrelated')).toEqual(unrelated);
 expect([...map.values()].filter(entry=>entry.id!=='unrelated').map(entry=>entry.name)).toEqual(entries.map(entry=>entry.name));
});
it('an old ambiguous link needs a choice while a newly qualified link reopens exactly',()=>{
 const entries=definitions(),old=legacyCatalogId(entries[0]);
 expect(catalogIdCandidates(old,entries)).toHaveLength(2);expect(resolveCatalogId(old,entries)).toBeUndefined();
 for(const entry of entries){expect(resolveCatalogId(entry.id,entries)).toBe(entry);expect(resolveCatalogId(old,entries,recordNavigationKey(entry))).toBe(entry);}
 expect(resolveCatalogId(old,entries,'not-a-record')).toBeUndefined();
});
it('a saved choice alias matches its complete authored definition instead of the other English alias',()=>{
 const entries=definitions(),saved=structuredClone(entries[0]);saved.id=legacyCatalogId(saved);delete saved.raw._catalogLegacyId;
 const character=newCharacter();character.profile.enabledSources=['XPHB'];character.profile.optional.feats=true;
 const choice:SheetChoice={id:'authored-choice',ownerId:'owner',label:'Authored choice',count:1,channel:'content',
  options:[{value:saved.id,label:saved.name,entry:saved}],selected:[saved.id],complete:true,restricted:false};
 const before=JSON.stringify(choice),match=choiceEntryMatcher(character,choice);
 expect(match(entries[0])?.value).toBe(saved.id);expect(optionForEntry(character,choice,entries[0])?.value).toBe(saved.id);
 expect(match(entries[1])).toBeUndefined();expect(optionForEntry(character,choice,entries[1])).toBeUndefined();expect(JSON.stringify(choice)).toBe(before);
});
it('an explicit reference tag keeps different feature schemas in their own namespace',()=>{
 const common={name:'Shared authored option',source:'AUTH',edition:'one',entries:['Original reference fixture.']};
 const entries=normalizeData({optionalfeature:[{...common,featureType:['AUTH']}],charoption:[{...common,charoptionType:['AUTH']} ]},'r','authored');
 const pointer='Shared authored option|AUTH';expect(resolveEntryReference(pointer,entries,'feature')).toBeUndefined();
 for(const [tag,category] of [['optfeature','optionalfeature'],['charoption','charoption']])expect(resolveEntryReference(pointer,entries,referenceEntryKind(tag),referenceEntryCategory(tag))?.raw._category).toBe(category);
 expect(resolveEntryReference(pointer,entries,referenceEntryKind('unknown-source-kind'))).toBeUndefined();
});
it('declared version identifiers do not depend on object property order',()=>{
 const base={name:'Authored companion',ENG_name:'Authored companion',source:'AUTH',hp:{average:10}};
 const a=normalizeData({monster:[{...base,_versions:[{name:'Alternate authored companion',hp:{average:20,formula:'3d6'}}]}]},'r','authored');
 const b=normalizeData({monster:[{...base,_versions:[{hp:{formula:'3d6',average:20},name:'Alternate authored companion'}]}]},'r','authored');
 expect(a.map(entry=>entry.id)).toEqual(b.map(entry=>entry.id));
});
