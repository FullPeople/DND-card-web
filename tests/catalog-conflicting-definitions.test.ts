import {expect,it} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter,selectionEffectsAllowed,type Entry} from '../src/core/model';
import {candidateReason} from '../src/core/engine';
import {catalogIdCandidates,catalogRuleKey,legacyCatalogId,mergeCatalogRecords,recordNavigationKey,resolveCatalogId} from '../src/core/entryRecordIdentity';
const feat=(entries:string[])=>({name:'Authored conflicting feat',source:'XPHB',edition:'one',entries});
const character=()=>{const value=newCharacter();value.profile.enabledSources=['XPHB','AUTH'];value.profile.optional.feats=true;return value;};

it('contradictory definitions remain separate and require explicit per-definition review for automation',()=>{
 const entries=normalizeData({feat:[feat(['Original first definition.']),feat(['Original second definition.'])]},'r','authored'),c=character();
 expect(new Set(entries.map(entry=>entry.id)).size).toBe(2);expect(catalogIdCandidates(legacyCatalogId(entries[0]),entries)).toHaveLength(2);
 expect(entries.every(entry=>entry.raw._catalogConflict)).toBe(true);
 expect(entries.map(entry=>entry.raw._catalogDefinitionOrdinal).sort()).toEqual([1,2]);
 for(const entry of entries){expect(selectionEffectsAllowed(c,entry)).toBe(false);expect(candidateReason(c,entry)).toContain('不同定义');}
 c.profile.exceptions[legacyCatalogId(entries[0])]='Original broad legacy note.';
 expect(entries.every(entry=>!selectionEffectsAllowed(c,entry))).toBe(true);
 c.profile.exceptions[entries[0].id]='Reviewed this exact authored definition.';
 expect(selectionEffectsAllowed(c,entries[0])).toBe(true);expect(selectionEffectsAllowed(c,entries[1])).toBe(false);
});
it('a disabled old identifier still restricts every replacement definition',()=>{
 const entries=normalizeData({feat:[feat(['Authored A.']),feat(['Authored B.'])]},'r','authored'),c=character();
 c.profile.disabledEntries=[legacyCatalogId(entries[0])];for(const entry of entries){expect(selectionEffectsAllowed(c,entry)).toBe(false);expect(candidateReason(c,entry)).toContain('单独禁用');}
});
it('presentation-only alternatives stay readable without becoming unverified mechanics',()=>{
 const row={name:'Authored companion',source:'AUTH',hp:{average:10}};
 const entries=normalizeData({monster:[{...row,tokenUrl:'authored-a.png'},{...row,tokenUrl:'authored-b.png'}]},'r','authored');
 expect(new Set(entries.map(entry=>entry.id)).size).toBe(2);expect(entries.every(entry=>entry.raw._catalogPresentationVariant&&!entry.raw._catalogConflict)).toBe(true);
 expect(catalogIdCandidates(legacyCatalogId(entries[0]),entries)).toHaveLength(2);
 for(const entry of entries)expect(selectionEffectsAllowed(character(),entry)).toBe(true);
});
it('source data cannot forge an internal alias or conflict approval annotation',()=>{
 const victim:Entry={id:'unrelated-public-record',kind:'feat',name:'Keep original',english:'Keep original',source:'XPHB',edition:'2024',packId:'authored',revision:'r',entries:[],raw:{}};
 const input={feat:[{...feat(['Original input.']),_catalogLegacyId:victim.id,_catalogConflict:true,_versionBaseName:'Forged parent',_versionIdentity:'forged'}]},before=JSON.stringify(input);
 const entries=normalizeData(input,'r','authored'),map=new Map([[victim.id,victim]]);mergeCatalogRecords(map,entries);
 expect(map.get(victim.id)).toBe(victim);expect(entries[0].raw._catalogLegacyId).toBeUndefined();expect(entries[0].raw._catalogConflict).toBeUndefined();expect(entries[0].raw._versionBaseName).toBeUndefined();expect(JSON.stringify(input)).toBe(before);
});
it('declared feat versions do not bypass the original nonrepeatable feat restriction',()=>{
 const entries=normalizeData({feat:[{...feat(['Original versioned feat.']),_versions:[{name:'Authored alternate feat'}]}]},'r','authored'),c=character();
 expect(new Set(entries.map(entry=>entry.id)).size).toBe(2);expect(catalogRuleKey(entries[0])).toBe(catalogRuleKey(entries[1]));
 c.selections=[{id:'selected',entry:entries[0],level:1,quantity:1,equipped:false}];expect(candidateReason(c,entries[1])).toContain('已经在角色卡');
 const old=structuredClone(entries[1]);old.id=legacyCatalogId(old);for(const field of Object.keys(old.raw))if(field.startsWith('_catalog')||field==='_versionIdentity')delete old.raw[field];
 c.selections[0].entry=old;expect(candidateReason(c,entries[0])).toContain('已经在角色卡');
});
it('a third authored alias does not hide conflicting definitions within the first alias',()=>{
 const entries=normalizeData({feat:[{...feat(['Original A.']),ENG_name:'Shared authored identity'},{...feat(['Original B.']),ENG_name:'Shared authored identity'},{...feat(['Original C.']),name:'Another authored name',ENG_name:'Shared authored identity'}]},'r','authored');
 expect(entries).toHaveLength(3);expect(new Set(entries.map(entry=>entry.id)).size).toBe(3);
 expect(entries.slice(0,2).every(entry=>entry.raw._catalogConflict)).toBe(true);expect(entries[2].raw._catalogConflict).toBeUndefined();
 for(const entry of entries)expect(resolveCatalogId(legacyCatalogId(entry),entries,recordNavigationKey(entry))).toBe(entry);
 const reversed=normalizeData({feat:[{...feat(['Original C.']),name:'Another authored name',ENG_name:'Shared authored identity'},{...feat(['Original B.']),ENG_name:'Shared authored identity'},{...feat(['Original A.']),ENG_name:'Shared authored identity'}]},'r','authored');
 expect(reversed.map(entry=>entry.id).sort()).toEqual(entries.map(entry=>entry.id).sort());
});
