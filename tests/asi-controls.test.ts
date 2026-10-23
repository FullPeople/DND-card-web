import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach,it,expect,vi} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {AsiAllocationControl} from '../src/ui/AsiAllocationControl';

const mocked=vi.hoisted(()=>({status:{eligible:true,active:false} as any,supported:true}));
vi.mock('../src/core/automation/asi',()=>({asiAllocationStatus:()=>mocked.status,isSupportedAsi:()=>mocked.supported,setAsiAllocation:vi.fn()}));
beforeEach(()=>{mocked.status={eligible:true,active:false};mocked.supported=true;});
const entry:Entry={id:'asi',kind:'feat',name:'属性值提升',english:'Ability Score Improvement',source:'XPHB',edition:'2024',packId:'authored',revision:'1',entries:[],raw:{}};
function fixture(){const c=newCharacter();c.abilities.str=16;c.notes='保留手工字段';return {c,choiceId:'fighter:grant4',entry,unavailable:false,writable:true,edit:(action:(draft:typeof c)=>void)=>action(c)};}
function button(html:string,name:string){return html.match(new RegExp(`<button[^>]*>${name}</button>`))?.[0]||'';}
it('shows explicit opt-in and manual-score warning without mutating the character',()=>{
 const props=fixture(),before=JSON.stringify(props.c),html=renderToStaticMarkup(createElement(AsiAllocationControl,props));
 expect(html).toContain('尚未确认属性提升');expect(html).toContain('本次提升尚未计入手工基础属性');expect(html).toContain('上限 20');expect(button(html,'确认属性提升')).toContain('disabled');expect(html).not.toContain('撤回属性提升');expect(JSON.stringify(props.c)).toBe(before);
});
it('does not expose allocation for an unreviewed feat',()=>{mocked.supported=false;expect(renderToStaticMarkup(createElement(AsiAllocationControl,fixture()))).toBe('');});
it('distinguishes a saved suspended allocation from an active contribution and allows withdrawal',()=>{
 const props=fixture();mocked.status={eligible:false,active:false,reason:'来源未启用',binding:{selectionId:'grant4',choiceId:props.choiceId,entryId:entry.id,allocation:{str:2}}};
 const html=renderToStaticMarkup(createElement(AsiAllocationControl,props));expect(html).toContain('属性提升记录已保留，当前不生效');expect(html).toContain('力量 +2');expect(html).toContain('仍可撤回此分配');expect(button(html,'确认属性提升')).toContain('disabled');expect(button(html,'撤回属性提升')).not.toContain('disabled');
});
it('blocks both writes for a read-only card',()=>{
 const props=fixture();props.writable=false;mocked.status={eligible:true,active:true,binding:{allocation:{dex:1,con:1}}};
 const html=renderToStaticMarkup(createElement(AsiAllocationControl,props));expect(html).toContain('属性提升已生效');expect(button(html,'确认属性提升')).toContain('disabled');expect(button(html,'撤回属性提升')).toContain('disabled');
});
it('preserves unknown saved state without exposing writes',()=>{
 const props=fixture();(props.c as any).asiAllocations={version:2,unknown:{keep:true}};mocked.status={eligible:false,active:false};const before=JSON.stringify(props.c),html=renderToStaticMarkup(createElement(AsiAllocationControl,props));
 expect(html).toContain('记录版本尚未支持');expect(button(html,'确认属性提升')).toContain('disabled');expect(html).not.toContain('撤回属性提升');expect(JSON.stringify(props.c)).toBe(before);
});
