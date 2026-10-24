import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import {ClassChoiceRecords} from '../src/ui/ClassChoiceRecords';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {invocationFixture,learn,sync} from './fixtures/invocationFixture';
vi.mock('../src/ui/Reference',()=>({Reference:({children}:any)=>createElement('span',null,children)}));
it('shows learned skill and exact free-spell boundaries without promising automated spell effects',()=>{
 const {c,entries,find}=invocationFixture();for(const [index,name] of ['Beguiling Influence','Eldritch Sight','Armor of Shadows'].entries())learn(c,entries,find(name),index);
 const before=JSON.stringify(c),edit=vi.fn(),html=renderToStaticMarkup(createElement(ClassChoiceRecords,{c,catalog:entries,mode:'optional',edit}));
 expect(html).toContain('自动授予欺瞒和游说熟练');expect(html).toContain('目标、专注、持续时间与侦测结果仍手动处理');expect(html).toContain('仅对自身');expect(html).toContain('不自动加护甲');expect(html).toContain('替换时机仍手动处理');expect(html).not.toContain('确认灌注');expect(JSON.stringify(c)).toBe(before);expect(edit).not.toHaveBeenCalled();
});
it('read-only and suspended-source rendering preserves records and never writes character state',()=>{
 const {c,entries,find}=invocationFixture();learn(c,entries,find('Eldritch Sight'));c.profile.enabledSources=[];sync(c,entries);const before=JSON.stringify(c),edit=vi.fn();
 const html=renderToStaticMarkup(createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:false,open:vi.fn(),close:vi.fn()}},createElement(ClassChoiceRecords,{c,catalog:entries,mode:'optional',edit})));
 expect(html).toContain('来源未启用，原记录保留');expect(html).toContain('当前不可用，记录保留');expect(html.match(/<button[^>]*data-choice-id="warlock:class-optional:0"[^>]*>/)?.[0]).toContain('disabled');expect(JSON.stringify(c)).toBe(before);expect(edit).not.toHaveBeenCalled();
});

it('shows a retained wrong-parent grant as unavailable rather than an active proficiency',()=>{
 const {c,entries,find}=invocationFixture();learn(c,entries,find('Beguiling Influence'));c.selections.find(row=>row.entry.english==='Beguiling Influence')!.parentId='warlock';sync(c,entries);const html=renderToStaticMarkup(createElement(ClassChoiceRecords,{c,catalog:entries,mode:'optional'}));expect(html).toContain('当前不可用，记录保留');expect(html).toContain('原授予与子项记录已保留');
});
