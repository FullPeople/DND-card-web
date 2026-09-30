import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter,entryEdition,type Entry} from '../src/core/model';
import {sourceGroup,setSourceGroup,type SourceRegistry} from '../src/core/sourceCatalog';
import sourceRegistry from '../src/data/sourceRegistry.json';
import {sourceSettings,withSiteSources} from '../src/core/siteSources';
import {validateCharacter} from '../src/core/validation';
import {classCompatibilityIssues,reviewClasses} from '../src/core/classMigration';
const rows=normalizeData({class:[{name:'测试工匠',ENG_name:'Test Artisan',source:'OLDER',edition:'classic'},{name:'测试工匠',ENG_name:'Test Artisan',source:'NEWER',edition:'classic'},{name:'测试工匠',ENG_name:'Test Artisan',source:'NEXT',edition:'one'}]},'fixture');
it('accepts obsolete conflict preferences in old backups while source toggles retain their meaning',()=>{
 const c=newCharacter('2014');c.profile.sourceConflicts={mode:'manual',selected:{legacy:[rows[0].id]}};c.profile.autoSourceDefaults=[];setSourceGroup(c.profile,['OLDER','NEWER'],true);setSourceGroup(c.profile,['OLDER','NEWER'],false);
 const restored=validateCharacter(JSON.parse(JSON.stringify(c)));expect(withSiteSources(newCharacter(),sourceSettings(restored.profile)).profile.sourceConflicts).toEqual(c.profile.sourceConflicts);expect(restored.profile.enabledSources).not.toContain('NEWER');expect(restored.profile.autoSourceDefaults).toContain('NEWER');
 expect(()=>validateCharacter({...c,profile:{...c.profile,sourceConflicts:{mode:'invalid',selected:{}}}})).toThrow(/同名资料/);
});
it('categorizes the requested five lists and uses parent edition for adapted subclasses',()=>{
 const sources=sourceRegistry as SourceRegistry;
 expect(sourceGroup('PHB',{})).toBe('三宝书');expect(sourceGroup('TCE',{})).toBe('核心规则');expect(sourceGroup('COS',{COS:{name:'冒险',category:'模组内容'}})).toBe('模组内容');expect(sourceGroup('AU',sources)).toBe('威世智每月更新');expect(sourceGroup('AUD',sources)).toBe('威世智每月更新');expect(sourceGroup('UATHEMYSTICCLASS',sources)).toBe('核心规则');expect(sourceGroup('UAEXAMPLE',{},[{...rows[0],raw:{_homebrew:true}}])).toBe('第三方');expect(sourceGroup('BREW',{},[{...rows[0],raw:{_homebrew:true}}])).toBe('第三方');
 const entries=normalizeData({class:[{name:'测试工匠',source:'NEXT',edition:'one'}],subclass:[{name:'适配子职',source:'OLDER',edition:'classic',className:'测试工匠',classSource:'NEXT'}]},'fixture');expect(entryEdition(entries[1])).toBe('2024');
});
it('ignores revision, translation and cache changes; warns for unmigrated imports, rule changes and wrong edition',()=>{
 const current:Entry={...rows[2],raw:{hd:{faces:8}}},c=newCharacter();c.selections=[{id:'class',entry:{...current,revision:'old',entries:['旧译文'],raw:{...current.raw,page:20,_cache:'old'}},level:1,quantity:1,equipped:false}];
 expect(classCompatibilityIssues(c,[current])).toHaveLength(0);c.selections[0].entry.raw.hd={faces:6};expect(classCompatibilityIssues(c,[current])).toHaveLength(1);
 c.selections[0].entry={...rows[0]};expect(classCompatibilityIssues(c,rows)).toHaveLength(1);c.profile.optional.legacy=true;expect(classCompatibilityIssues(c,rows)).toHaveLength(0);
 c.selections[0].entry={...current,id:'old',english:'测试工匠',source:'IMPORTED',packId:'imported',raw:{}};expect(classCompatibilityIssues(c,[current])).toHaveLength(1);expect(reviewClasses(c,[current])[0].suggested).toBeUndefined();
 c.selections[0].entry.raw._custom=true;expect(classCompatibilityIssues(c,[current])).toHaveLength(1);c.selections=[];expect(classCompatibilityIssues(c,[])).toHaveLength(0);
});
