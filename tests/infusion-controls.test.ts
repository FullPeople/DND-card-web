import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
import {InfusionControl} from '../src/ui/InfusionControl';
import {ClassChoiceRecords} from '../src/ui/ClassChoiceRecords';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {infusionFixture} from './e2e/infusionFixture';
import {setInfusionTarget} from '../src/core/automation/infusions';
vi.mock('../src/ui/Reference',()=>({Reference:({children}:any)=>createElement('span',null,children)}));

const button=(html:string,label:string)=>html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0]||'';
function setup(){const state=infusionFixture(),edit=vi.fn();return {...state,edit,props:{c:state.c,entry:state.entry,choiceId:state.choiceId,ownerId:'infusion-owner',unavailable:false,writable:true,edit}};}
it('renders explicit supported target selection without mutating the character or auto-activating',()=>{
 const {c,props,edit}=setup(),before=JSON.stringify(c),html=renderToStaticMarkup(createElement(InfusionControl,props));
 expect(html).toContain('尚未指定灌注目标');expect(html).toContain('请选择已有物品');expect(html).toContain('灌注测试盾牌');expect(button(html,'确认增强防御灌注')).toContain('disabled');expect(edit).not.toHaveBeenCalled();expect(JSON.stringify(c)).toBe(before);
});
it('keeps unsupported learned abilities manual without rendering activation controls',()=>{
 const {props}=setup();props.entry={...props.entry,english:'Unreviewed Defense',name:'未核对能力',raw:{...props.entry.raw,ENG_name:'Unreviewed Defense'}};
 expect(renderToStaticMarkup(createElement(InfusionControl,props))).toBe('');
});
it.each(['choice','source','feature','automation'] as const)('allows explicit withdrawal but blocks new activation while %s is restricted',mode=>{
 const {c,props,choiceId,entry}=setup();setInfusionTarget(c,choiceId,entry.id,'infusion-item-0');
 if(mode==='choice')props.unavailable=true;else if(mode==='source')c.profile.enabledSources=['PHB'];else if(mode==='feature')c.profile.disabledEntries=[c.selections.find(row=>row.id==='infusion-feature')!.entry.id];else c.automation!.enabled=false;
 const before=JSON.stringify(c),html=renderToStaticMarkup(createElement(InfusionControl,props));
 expect(html).toContain('已指定灌注目标：灌注测试皮甲');expect(html).toContain('仍可撤回此灌注');expect(button(html,'确认增强防御灌注')).toContain('disabled');expect(button(html,'撤回增强防御灌注')).not.toContain('disabled');expect(JSON.stringify(c)).toBe(before);
});
it('read-only blocks both confirmation and withdrawal',()=>{
 const {c,props,choiceId,entry}=setup();setInfusionTarget(c,choiceId,entry.id,'infusion-item-0');props.writable=false;
 const html=renderToStaticMarkup(createElement(InfusionControl,props));expect(button(html,'确认增强防御灌注')).toContain('disabled');expect(button(html,'撤回增强防御灌注')).toContain('disabled');
});
it('preserves unknown infusion versions without reading missing fields or offering writes',()=>{
 const {c,props}=setup();(c as any).infusions={version:2,future:'untouched'};const before=JSON.stringify(c),html=renderToStaticMarkup(createElement(InfusionControl,props));
 expect(html).toContain('版本尚未支持');expect(button(html,'确认增强防御灌注')).toContain('disabled');expect(html).not.toContain('撤回灌注');expect(JSON.stringify(c)).toBe(before);
});
it.each(['unlearned','automation disabled','missing snapshot','missing owner'] as const)('retains a cleanup-only control after %s',mode=>{
 const {c,entry,choiceId,entries,edit}=setup();setInfusionTarget(c,choiceId,entry.id,'infusion-item-0');
 if(mode==='unlearned')c.answers[choiceId]=[];else if(mode==='automation disabled')c.automation!.enabled=false;else if(mode==='missing snapshot'){c.classChoiceSnapshots={};c.answers[choiceId]=[];}else c.selections=c.selections.filter(row=>row.id!=='infusion-owner');
 const before=JSON.stringify(c),html=renderToStaticMarkup(createElement(ClassChoiceRecords,{c,catalog:entries,mode:'optional',edit}));expect(html).toContain('已保留灌注记录');expect(html).toContain('撤回灌注');expect(html).not.toContain('确认灌注');expect(JSON.stringify(c)).toBe(before);
 const locked=renderToStaticMarkup(createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:false,open:()=>{},close:()=>{}}},createElement(ClassChoiceRecords,{c,catalog:entries,mode:'optional',edit})));expect(button(locked,'撤回增强防御灌注')).toContain('disabled');
});
