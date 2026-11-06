import {expect,it} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {homebrewBody} from '../src/data/homebrew';
import {classSpellFilterSource} from '../src/data/classSpellCatalog';

it('keeps primary source abbreviations distinct from their IDs without extending normalized rule snapshots',()=>{
 const body={class:[{name:'Authored primary caster',source:'PHB'}]},[owner]=normalizeData(body,'authored');
 expect(classSpellFilterSource(body,owner.source)).toEqual({source:'PHB',abbreviation:"PHB'14",nonstandard:false,registeredHomebrew:false});
 expect(owner.raw).toEqual({...body.class[0],_category:'class'});
});
it('preserves a declared homebrew abbreviation on its exact source without borrowing a display name',()=>{
 const body={_meta:{sources:[{json:'ABOOK',full:'Authored full title',abbreviation:'Different abv'}]},class:[{name:'Authored caster',source:'ABOOK'}]};
 const before=JSON.stringify(body),[owner]=normalizeData(homebrewBody(body),'authored','kiwee-homebrew');
 expect(classSpellFilterSource(body,owner.source)).toEqual({source:'ABOOK',abbreviation:'Different abv',nonstandard:true,registeredHomebrew:true});
 expect(Object.hasOwn(owner.raw,'_classSpellFilterSource')).toBe(false);
 expect(JSON.stringify(body)).toBe(before);
});
it('does not confuse a homebrew content marker with registration of the class source',()=>{
 const body={_meta:{sources:[{json:'ABOOK',abbreviation:'A'}]},class:[{name:'Authored core-source row',source:'PHB'}]},[owner]=normalizeData(homebrewBody(body),'authored','kiwee-homebrew');
 expect(classSpellFilterSource(body,owner.source)).toEqual({source:'PHB',abbreviation:"PHB'14",nonstandard:false,registeredHomebrew:false});
});
it('does not infer an unknown abbreviation from an unrelated declared book or a source display name',()=>{
 const body={_meta:{sources:[{json:'OTHER',abbreviation:'Other'}]},class:[{name:'Authored unknown-source row',source:'ABOOK'}]},[owner]=normalizeData(homebrewBody(body),'authored','kiwee-homebrew');
 expect(classSpellFilterSource(body,owner.source)).toEqual({source:'ABOOK',unresolved:true});
});
it('keeps declared spell-list groups available even when their file has no class entries',()=>{
 const raw={name:'Authored group',source:'ABOOK',spells:['Authored group spell|PHB']};
 const [group]=normalizeData({spellList:[raw]},'authored','kiwee-homebrew');
 expect(group).toMatchObject({kind:'rule',source:'ABOOK',raw:{_category:'spellList',spells:raw.spells}});
});
it('preserves separately sourced and separately versioned groups without merging their display names',()=>{
 const entries=normalizeData({spellList:[{name:'Authored group',source:'PHB',spells:[]},{name:'Authored group',source:'XPHB',spells:[]}]},'authored');
 expect(entries).toHaveLength(2);expect(new Set(entries.map(entry=>entry.id)).size).toBe(2);expect(entries.map(entry=>entry.edition)).toEqual(['2014','2024']);
});
it('resolves actual pinned source abbreviations that differ from the stored source ID without modifying class snapshots',()=>{
 expect(classSpellFilterSource({},'LLVESSEL')).toEqual({source:'LLVESSEL',abbreviation:'LLVes',nonstandard:true,registeredHomebrew:true});
 expect(classSpellFilterSource({},'LLMC')).toEqual({source:'LLMC',abbreviation:'LLMag',nonstandard:true,registeredHomebrew:true});
});
it('keeps a live declaration conflicting with the pinned source label unresolved',()=>{
 expect(classSpellFilterSource({_meta:{sources:[{json:'LLVESSEL',abbreviation:'Changed'}]}},'LLVESSEL')).toEqual({source:'LLVESSEL',unresolved:true});
});
