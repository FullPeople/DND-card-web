import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter,entryEdition,type Entry} from '../src/core/model';
import {sourceGroup,sourceConflicts,hiddenConflictEntries,conflictSelection,setSourceGroup,type SourceRegistry} from '../src/core/sourceCatalog';
import sourceRegistry from '../src/data/sourceRegistry.json';
import {sourceSettings,withSiteSources} from '../src/core/siteSources';
import {validateCharacter} from '../src/core/validation';
import {classCompatibilityIssues,reviewClasses} from '../src/core/classMigration';
const rows=normalizeData({class:[{name:'测试工匠',ENG_name:'Test Artisan',source:'OLDER',edition:'classic'},{name:'测试工匠',ENG_name:'Test Artisan',source:'NEWER',edition:'classic'},{name:'测试工匠',ENG_name:'Test Artisan',source:'NEXT',edition:'one'}]},'fixture');
const registry={OLDER:{name:'旧扩展',date:'2019-11-19'},NEWER:{name:'新扩展',date:'2020-11-17'},NEXT:{name:'新版规则',date:'2025-11-18'}};
it('separates editions and owners, selects publication date and retains exact original identities',()=>{
 const groups=sourceConflicts(rows,'2014',registry);expect(groups).toHaveLength(1);expect(groups[0].latest).toEqual([rows[1].id]);expect(hiddenConflictEntries(rows,'2014',registry)).toEqual(new Set([rows[0].id]));expect(sourceConflicts(rows,'2024',registry)).toHaveLength(0);
 const different=normalizeData({subclass:[{name:'同名子职',source:'OLDER',className:'甲',classSource:'PHB'},{name:'同名子职',source:'NEWER',className:'乙',classSource:'PHB'}]},'fixture');expect(sourceConflicts(different,'2014',registry)).toHaveLength(0);
 expect(conflictSelection(groups[0],{mode:'manual',selected:{[groups[0].key]:[rows[0].id]}})).toEqual([rows[0].id]);expect(conflictSelection(groups[0],{mode:'all',selected:{}})).toHaveLength(2);
});
it('keeps unknown dates and ties visible and preserves manual decisions through round trips and source toggles',()=>{
 expect(sourceConflicts(rows,'2014',{...registry,NEWER:{name:'未知'}})[0].latest).toHaveLength(2);expect(sourceConflicts(rows,'2014',{...registry,NEWER:registry.OLDER})[0].uncertain).toBe(true);
 const c=newCharacter('2014'),g=sourceConflicts(rows,'2014',registry)[0];c.profile.sourceConflicts={mode:'manual',selected:{[g.key]:[rows[0].id]}};c.profile.autoSourceDefaults=[];setSourceGroup(c.profile,['OLDER','NEWER'],true);setSourceGroup(c.profile,['OLDER','NEWER'],false);
 const restored=validateCharacter(JSON.parse(JSON.stringify(c)));expect(withSiteSources(newCharacter(),sourceSettings(restored.profile)).profile.sourceConflicts).toEqual(c.profile.sourceConflicts);expect(restored.profile.enabledSources).not.toContain('NEWER');expect(restored.profile.autoSourceDefaults).toContain('NEWER');
 expect(()=>validateCharacter({...c,profile:{...c.profile,sourceConflicts:{mode:'invalid',selected:{}}}})).toThrow(/同名资料/);
});
it('categorizes the requested five lists and uses parent edition for adapted subclasses',()=>{
 const sources=sourceRegistry as SourceRegistry;
 expect(sourceGroup('PHB',{})).toBe('三宝书');expect(sourceGroup('TCE',{})).toBe('核心规则');expect(sourceGroup('COS',{COS:{name:'冒险',category:'模组内容'}})).toBe('模组内容');expect(sourceGroup('AU',sources)).toBe('威世智每月更新');expect(sourceGroup('AUD',sources)).toBe('威世智每月更新');expect(sourceGroup('UATHEMYSTICCLASS',sources)).toBe('核心规则');expect(sourceGroup('UAEXAMPLE',{},[{...rows[0],raw:{_homebrew:true}}])).toBe('第三方');expect(sourceGroup('BREW',{},[{...rows[0],raw:{_homebrew:true}}])).toBe('第三方');
 const entries=normalizeData({class:[{name:'测试工匠',source:'NEXT',edition:'one'}],subclass:[{name:'适配子职',source:'OLDER',edition:'classic',className:'测试工匠',classSource:'NEXT'}]},'fixture');expect(entryEdition(entries[1])).toBe('2024');
});
it('keeps all trilogy books outside comparison while resolving expansion reprints',()=>{
 const core=normalizeData({spell:['PHB','DMG','MM','XPHB','XDMG','XMM'].map(source=>({name:'同名法术',ENG_name:'Test Reprint',source,level:1}))},'fixture');
 const expansions=normalizeData({spell:['OLDER','NEWER'].map(source=>({name:'同名法术',ENG_name:'Test Reprint',source,level:1}))},'fixture');
 for(const edition of ['2014','2024'] as const){
  expect(sourceConflicts(core,edition,registry)).toHaveLength(0);
  const all=[...core,...expansions],groups=sourceConflicts(all,edition,registry);
  expect(groups).toHaveLength(1);expect(groups[0].entries.map(e=>e.source)).toEqual(['NEWER','OLDER']);
  expect(hiddenConflictEntries(all,edition,registry)).toEqual(new Set([expansions[0].id]));
  expect(hiddenConflictEntries(all,edition,registry,{mode:'manual',selected:{[groups[0].key]:[]}})).toEqual(new Set(expansions.map(e=>e.id)));
 }
 const adapted=normalizeData({subclass:['PHB','XPHB'].map(source=>({name:'适配子职',source,className:'测试职业',classSource:'XPHB',edition:'one'}))},'fixture');
 expect(adapted.every(e=>entryEdition(e)==='2024')).toBe(true);
 expect(sourceConflicts(adapted,'2024',registry)).toHaveLength(0);
});
it('does not warn for revision, translation, cache, or recognized imported names; warns for rule changes and wrong edition',()=>{
 const current:Entry={...rows[2],raw:{hd:{faces:8}}},c=newCharacter();c.selections=[{id:'class',entry:{...current,revision:'old',entries:['旧译文'],raw:{...current.raw,page:20,_cache:'old'}},level:1,quantity:1,equipped:false}];
 expect(classCompatibilityIssues(c,[current])).toHaveLength(0);c.selections[0].entry.raw.hd={faces:6};expect(classCompatibilityIssues(c,[current])).toHaveLength(1);
 c.selections[0].entry={...rows[0]};expect(classCompatibilityIssues(c,rows)).toHaveLength(1);c.profile.optional.legacy=true;expect(classCompatibilityIssues(c,rows)).toHaveLength(0);
 c.selections[0].entry={...current,id:'old',english:'测试工匠',source:'IMPORTED',packId:'imported',raw:{}};expect(classCompatibilityIssues(c,[current])).toHaveLength(0);expect(reviewClasses(c,[current])[0].suggested).toBeUndefined();
 c.selections[0].entry.raw._custom=true;expect(classCompatibilityIssues(c,[current])).toHaveLength(1);c.selections=[];expect(classCompatibilityIssues(c,[])).toHaveLength(0);
});
