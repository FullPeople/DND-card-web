import {it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import type {SheetChoice} from '../src/core/automation/choices';
import {choiceCatalog,optionForEntry} from '../src/ui/choiceCatalog';
const entry=(id:string,source='XPHB'):Entry=>({id,kind:'rule',source,edition:source==='PHB'?'2014':'2024',name:'运动',english:'Athletics',packId:'fixture',revision:'1',raw:{_category:'skill'},entries:[]});
const choice:SheetChoice={id:'skills',ownerId:'owner',label:'起始熟练项',count:2,channel:'skills',options:[{value:'athletics',label:'运动',entry:entry('imported-skill')}],selected:[],complete:false,restricted:false};
it('skill scope selects matching edition PHB terminology and rejects wrong versions/categories',()=>{
 const c=newCharacter(),catalog=[entry('live'),entry('old','PHB'),{...entry('fake'),kind:'spell' as const}];const scope=choiceCatalog(c,choice,catalog);expect(scope.tab).toBe('rule');expect(scope.entries.map(e=>e.id)).toEqual(['live']);expect(scope.filters).toEqual({source:{include:['XPHB'],exclude:[]},type:{include:['技能'],exclude:[]}});expect(optionForEntry(c,choice,catalog[1])).toBeUndefined();
 c.edition='2014';expect(choiceCatalog(c,choice,catalog).entries.map(e=>e.id)).toEqual(['old']);
});
it('inline and custom content stays a hovered option list instead of requiring a missing Wiki identity',()=>{
 const c=newCharacter(),inline={...entry('inline'),kind:'feature' as const,raw:{_category:'inlineChoice'}};const r={...choice,channel:'content' as const,options:[{value:inline.id,label:'自定义',entry:inline}]};expect(choiceCatalog(c,r,[inline]).wiki).toBe(false);expect(optionForEntry(c,r,inline)).toBeUndefined();
});
