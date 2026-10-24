import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
vi.mock('../src/ui/Reference',()=>({Reference:({children}:any)=>createElement('span',null,children)}));
import {normalizeData} from '../src/data/catalog';
import {syncFeatures} from '../src/core/sheet';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../src/core/automation/choices';
import {setAsiAllocation} from '../src/core/automation/asi';
import {ClassChoiceRecords} from '../src/ui/ClassChoiceRecords';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {legacyAsiAllocationData,legacyAsiAllocationFixture} from './e2e/asiAllocationFixture';
function setup(source:'PHB'|'TCE'){
 const c=legacyAsiAllocationFixture(source),entries=normalizeData(legacyAsiAllocationData(source),'asi-legacy-ui');syncFeatures(c,entries);
 const choices=sheetChoices(c,entries).filter(choice=>choice.id.includes(':class-legacy-feat:'));
 for(const choice of choices){setSheetChoiceSlot(c,choice.id,0,choice.options.find(option=>option.entry.raw._classAbilityRecord)!.value,entries);setAsiAllocation(c,choice.id,{dex:1,str:1});}
 const props={c,catalog:entries,mode:'feat' as const,edit:(fn:(draft:typeof c)=>void)=>fn(c)};return {c,entries,choices,props};
}
it.each(['PHB','TCE'] as const)('renders one control per active %s allocation without a duplicate preserved record',source=>{
 const {c,choices,props}=setup(source),before=JSON.stringify(c),html=renderToStaticMarkup(createElement(ClassChoiceRecords,props));
 expect((html.match(/data-asi-choice=/g)||[]).length).toBe(choices.length);expect(html).not.toContain('已保留属性提升记录');expect(html).toContain('2014 属性值提升分配');expect(JSON.stringify(c)).toBe(before);
});
it('keeps exactly one cleanup control after a legacy alternative feat is chosen',()=>{
 const {c,entries,choices,props}=setup('TCE'),choice=choices[0],other=choice.options.find(option=>!option.entry.raw._classAbilityRecord&&option.entry.kind==='feat')!;
 expect(other).toBeDefined();setSheetChoiceSlot(c,choice.id,0,other.value,entries);syncChoiceContent(c,entries);
 const html=renderToStaticMarkup(createElement(ClassChoiceRecords,props));expect((html.match(/data-asi-choice=/g)||[]).length).toBe(1);expect(html).toContain('已保留属性提升记录');expect(html).toContain('属性提升记录已保留，当前不生效');expect(html).toContain('撤回属性提升');
});
it('keeps source-missing intent cleanup-only and honors read-only',()=>{
 const {c,props}=setup('TCE');c.selections=[];c.classChoiceSnapshots={};c.classChoiceArchive={};props.catalog=[];
 const before=JSON.stringify(c),html=renderToStaticMarkup(createElement(ClassChoiceRecords,props));expect(html).toContain('原属性提升资料未载入');expect(html).toContain('撤回属性提升');expect(html).not.toContain('确认属性提升');expect(JSON.stringify(c)).toBe(before);
 const locked=renderToStaticMarkup(createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:false,open:()=>{},close:()=>{}}},createElement(ClassChoiceRecords,props)));expect(locked).toMatch(/<button[^>]*disabled[^>]*>撤回属性提升<\/button>/);
});
