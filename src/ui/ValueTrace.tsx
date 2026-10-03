import {createContext,useContext,useLayoutEffect,useRef,useState,type ReactNode,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {ABILITY_LABELS,SKILLS,type Character,type Derived,type Ability,type SheetBonus} from '../core/model';
import {spellState,spellValues} from '../core/characterDetails';
import {evaluate} from '../core/engine';
import './valueTrace.css';

export type TraceModel={title:string;value:number;result:number;rows:string[];change?:(n:number)=>void;min?:number;max?:number};
type Context={c:Character;d:Derived;open:(anchor:HTMLElement,model:TraceModel)=>void};
export const ValueTraceContext=createContext<Context|undefined>(undefined);
const labels:Record<SheetBonus,string>={ac:'护甲等级',hp:'生命值上限',initiative:'先攻',speed:'速度',proficiency:'熟练加值',passive:'被动察觉'};
export function traceForInput(context:Context,label:string,value:number,change:(n:number)=>void):TraceModel|undefined{
 const {c,d}=context;
 for(const [a,name] of Object.entries(ABILITY_LABELS))if(label===`${name}基础值`)return {title:name,value,result:d.abilities[a as Ability],rows:d.trace[a]?.slice()||[],change,min:1,max:30};
 for(const [target,name] of Object.entries(labels))if(label===`${name}调整值`)return {title:name,value,result:target==='hp'?d.maxHp:d[target as Exclude<SheetBonus,'hp'>],rows:d.trace[target]||[],change,min:-9999,max:9999};
 if(label==='法术攻击调整值'||label==='法术DC调整值'){const settings=spellState(c),values=spellValues(c,d);return {title:label.replace('调整值',''),value,result:label==='法术攻击调整值'?values.attack:values.dc,rows:[`施法属性：${ABILITY_LABELS[settings.ability]} ${d.modifiers[settings.ability]}`,`熟练加值 ${d.proficiency}`,...(label==='法术DC调整值'?['基础 DC 8']:[]),`手动调整 ${value}`],change,min:-100,max:100};}
 return undefined;
}
export function ValueTraceProvider({c,d,enabled=true,children}:{c:Character;d:Derived;enabled?:boolean;children:ReactNode}){
 const [opened,setOpened]=useState<{element:HTMLElement;model:TraceModel;id:number}>(),serial=useRef(0);
 useLayoutEffect(()=>setOpened(undefined),[c.id,enabled]);
 return <ValueTraceContext.Provider value={enabled?{c,d,open:(element,model)=>setOpened(previous=>previous?.element===element?previous:{element,model,id:++serial.current})}:undefined}>{children}{opened&&enabled&&<TracePanel key={opened.id} element={opened.element} model={opened.model} c={c} d={d} close={()=>setOpened(undefined)}/>}</ValueTraceContext.Provider>;
}
export function TraceValue({target,label,value,children}:{target:string;label:string;value:number;children:ReactNode}){
 const context=useContext(ValueTraceContext);
 return <span className="trace-value" role={context?'button':undefined} tabIndex={context?0:undefined} aria-label={context?`${label}数据追溯`:undefined} onClick={e=>context?.open(e.currentTarget,{title:label,value,result:value,rows:context.d.trace[target]||[]})} onKeyDown={e=>{if(context&&['Enter',' '].includes(e.key)){e.preventDefault();context.open(e.currentTarget,{title:label,value,result:value,rows:context.d.trace[target]||[]});}}}>{children}</span>;
}
function TracePanel({element,model,c,d:current,close}:{element:HTMLElement;model:TraceModel;c:Character;d:Derived;close:()=>void}){
 const panel=useRef<HTMLDivElement>(null),field=useRef<HTMLInputElement>(null),[anchor,setAnchor]=useState(()=>element.getBoundingClientRect()),[draft,setDraft]=useState(String(model.value)),cancel=useRef(false),commitRef=useRef(()=>{}),committed=useRef(model.value);
 // Existing field remains the layout anchor; the overlay matches screen dimensions at any A4 zoom.
 useLayoutEffect(()=>{const update=()=>{if(!element.isConnected){close();return;}setAnchor(element.getBoundingClientRect());};const observer=new ResizeObserver(update);observer.observe(element);window.addEventListener('resize',update);window.addEventListener('scroll',update,true);return()=>{observer.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};},[element]);
 useLayoutEffect(()=>{field.current?.focus({preventScroll:true});field.current?.select();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){cancel.current=true;close();}};const down=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&e.target!==element){commitRef.current();close();}};window.addEventListener('keydown',key);window.addEventListener('pointerdown',down,true);return()=>{window.removeEventListener('keydown',key);window.removeEventListener('pointerdown',down,true);};},[element]);
 const key=Object.entries(labels).find(([,v])=>v===model.title)?.[0] as SheetBonus|undefined;
 let preview=c,d=current;const number=Number(draft),ability=Object.entries(ABILITY_LABELS).find(([,name])=>name===model.title)?.[0] as Ability|undefined;
 if(model.change&&draft.trim()&&Number.isInteger(number)&&Number.isFinite(number)&&number!==model.value){preview=structuredClone(c);const value=Math.max(model.min??-9999,Math.min(model.max??9999,number));
  if(ability)preview.abilities[ability]=value;else if(key)(preview.sheetBonuses||={})[key]=value;else if(model.title==='法术攻击'||model.title==='法术DC'){preview.spellSettings||=structuredClone(spellState(preview));preview.spellSettings[model.title==='法术攻击'?'attackBonus':'dcBonus']=value;}d=evaluate(preview);
 }
 const fresh=traceForInput({c:preview,d,open:()=>{}},`${model.title}基础值`,Number(draft),model.change||(()=>{}));
 const skill=Object.entries(SKILLS).find(([,s])=>s.name===model.title)?.[0],save=Object.entries(ABILITY_LABELS).find(([,s])=>`${s}豁免`===model.title)?.[0] as Ability|undefined;
 const result=key?(key==='hp'?d.maxHp:d[key]):skill?d.skills[skill].value:save?d.saves[save].value:model.title==='法术攻击'?spellValues(preview,d).attack:model.title==='法术DC'?spellValues(preview,d).dc:fresh?.result??model.result;
 const left=Math.max(8,Math.min(anchor.left-12,innerWidth-286)),top=Math.max(4,anchor.top-40),fieldTop=anchor.top-top;
 const style=getComputedStyle(element);
 const commit=()=>{const n=Number(draft);if(!cancel.current&&draft.trim()&&Number.isFinite(n)&&Number.isInteger(n)){const value=Math.max(model.min??-9999,Math.min(model.max??9999,n));if(value!==committed.current){committed.current=value;model.change?.(value);}}};
 commitRef.current=commit;
 const tab=(backward:boolean)=>{
  // A portal sits at the end of body, but keyboard navigation belongs at the
  // original field. Continue from that anchor without painting an idle total.
  const targets=[...document.querySelectorAll<HTMLElement>('input:not([disabled]),button:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(target=>!panel.current?.contains(target)&&target.tabIndex>=0&&target.getClientRects().length>0);
  const index=targets.indexOf(element),next=targets[index+(backward?-1:1)];commit();close();next?.focus();
 };
 return createPortal(<div ref={panel} className="value-trace-panel" role="dialog" aria-label={`${model.title}数据追溯`} style={{left,top,width:270}}><header style={{height:Math.max(24,fieldTop-10)}}><strong>{model.title}</strong><button aria-label="关闭数据追溯" onClick={()=>{commit();close();}}>×</button></header><div style={{height:anchor.height,marginLeft:anchor.left-left-14}}><input ref={field} className="trace-field" aria-label={`${model.title}追溯输入`} type="number" readOnly={!model.change} value={draft} style={{width:anchor.width,height:anchor.height,fontSize:style.fontSize,fontWeight:style.fontWeight,textAlign:style.textAlign as CSSProperties["textAlign"],padding:style.padding,boxSizing:'border-box'}} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Tab'){e.preventDefault();tab(e.shiftKey);}if(e.key==='Enter'){commit();close();}if(e.key==='Escape')cancel.current=true;}}/></div><ul>{(key?d.trace[key]||[]:fresh?.rows||model.rows).map((row,i)=><li key={i}>{row}</li>)}</ul><div className="trace-result"><span>最终结果</span><strong>{result}</strong></div></div>,document.body);
}
