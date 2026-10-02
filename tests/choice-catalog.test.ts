import {it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import type {SheetChoice} from '../src/core/automation/choices';
import {choiceCatalog,choiceEntryMatcher,optionForEntry} from '../src/ui/choiceCatalog';
const entry=(id:string,source='XPHB'):Entry=>({id,kind:'rule',source,edition:source==='PHB'?'2014':'2024',name:'运动',english:'Athletics',packId:'fixture',revision:'1',raw:{_category:'skill'},entries:[]});
const choice:SheetChoice={id:'skills',ownerId:'owner',label:'起始熟练项',count:2,channel:'skills',options:[{value:'athletics',label:'运动',entry:entry('imported-skill')}],selected:[],complete:false,restricted:false};
it('skill scope selects matching edition PHB terminology and rejects wrong versions/categories',()=>{
 const c=newCharacter(),catalog=[entry('live'),entry('old','PHB'),{...entry('fake'),kind:'spell' as const}];const scope=choiceCatalog(c,choice,catalog);expect(scope.tab).toBe('rule');expect(scope.entries.map(e=>e.id)).toEqual(['live']);expect(scope.filters).toEqual({source:{include:['XPHB'],exclude:[]},type:{include:['技能'],exclude:[]}});expect(optionForEntry(c,choice,catalog[1])).toBeUndefined();
 c.edition='2014';expect(choiceCatalog(c,choice,catalog).entries.map(e=>e.id)).toEqual(['old']);
});
it('inline and custom content stays a hovered option list instead of requiring a missing Wiki identity',()=>{
 const c=newCharacter(),inline={...entry('inline'),kind:'feature' as const,raw:{_category:'inlineChoice'}};const r={...choice,channel:'content' as const,options:[{value:inline.id,label:'自定义',entry:inline}]};expect(choiceCatalog(c,r,[inline]).wiki).toBe(false);expect(optionForEntry(c,r,inline)).toBeUndefined();
});
it('indexed candidates preserve old saved aliases, first matching option and source/level constraints',()=>{
 const c=newCharacter(),spell=(id:string,name:string,level=1):Entry=>({...entry(id),kind:'spell',name,english:name,raw:{level,_category:'spell',className:'Fixture',classSource:'XPHB'}}),first=spell('old-id','Saved Spell'),later=spell('live-id','Other Spell');
 const r:SheetChoice={...choice,channel:'spells',options:[{value:first.id,label:first.name,entry:first},{value:later.id,label:later.name,entry:later}]},matcher=choiceEntryMatcher(c,r),candidates=[spell('new-id','Saved Spell'),spell('live-id','Saved Spell'),spell('new-id','Saved Spell',2),{...spell('old-id','Saved Spell'),source:'PHB',edition:'2014' as const}];
 expect(candidates.map(e=>matcher(e)?.value)).toEqual(candidates.map(e=>optionForEntry(c,r,e)?.value));expect(matcher(candidates[0])?.value).toBe('old-id');expect(matcher(candidates[1])?.value).toBe('old-id');expect(matcher(candidates[2])).toBeUndefined();expect(matcher(candidates[3])).toBeUndefined();
 const scope=choiceCatalog(c,r,candidates);expect(scope.entries).toEqual(candidates.slice(0,2));expect(scope.wiki).toBe(true);
});
it('indexed terminology keeps option ordering when translated and English skill aliases differ',()=>{
 const c=newCharacter(),r={...choice,options:[{value:'perception',label:'察觉',entry:entry('perception')},...choice.options]},candidate={...entry('mixed-alias'),name:'察觉',english:'Athletics'};
 expect(choiceEntryMatcher(c,r)(candidate)).toBe(optionForEntry(c,r,candidate));expect(choiceEntryMatcher(c,r)(candidate)?.value).toBe('perception');
});
