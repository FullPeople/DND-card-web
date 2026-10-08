import {useEffect,useRef,useState} from 'react';
import type {Character} from '../core/model';
import {CARD_COLORS,CARD_COMPONENTS,isPaletteColor,type CardColor,type CardComponent} from '../core/palette';
import {displayCharacterEdit} from '../core/displayCharacterEdit';
import {appearance,applyAppearance,APPEARANCE_EVENT,UI_COLORS,WIKI_COLORS,resetAppearance,saveAppearance,type AppearanceGroup} from '../platform/appearance';
import './appearance.css';
import './paletteDrawer.css';

type Edit=(action:(draft:Character)=>void,key?:string)=>void;
const componentNames:Record<CardComponent,string>={all:'整张角色卡',identity:'身份与职业',abilities:'六项属性',skills:'技能与豁免',vitals:'生命与数值',features:'特性',spells:'法术',inventory:'背包',background:'背景',resources:'快捷栏与资源',portrait:'头像与立绘'};
const colorNames:Record<CardColor,string>={paper:'纸张',surface:'内容底色',frame:'组件描边',heading:'标题栏',headingInk:'标题文字',ink:'文字',badge:'图标'};

export function PaletteButton({open,toggle}:{open:boolean;toggle:()=>void}){
 return <button type="button" className="palette-toggle" aria-label="调色盘" aria-expanded={open} aria-controls="palette-drawer" title="调色盘" onClick={toggle}><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1.3a2.1 2.1 0 0 0 1.5-3.6 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3c0-5-4-8.8-9-8.8Z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="6.7" r="1"/><circle cx="14.5" cy="6.8" r="1"/><circle cx="17.5" cy="10" r="1"/></svg></button>;
}
function ColorField({label,value,preview,commit,disabled}:{label:string;value:string;preview:(value:string)=>void;commit:(value:string)=>void;disabled:boolean}){
 const input=useRef<HTMLInputElement>(null),pending=useRef<string|undefined>(undefined),[hex,setHex]=useState(value.toUpperCase());
 const callbacks=useRef({commit,preview});callbacks.current={commit,preview};
 useEffect(()=>{if(input.current)input.current.value=value;setHex(value.toUpperCase());},[value]);
 useEffect(()=>{const node=input.current!;const save=()=>{const next=pending.current;pending.current=undefined;if(next)callbacks.current.commit(next);};node.addEventListener('change',save);node.addEventListener('blur',save);return()=>{save();node.removeEventListener('change',save);node.removeEventListener('blur',save);};},[]);
 return <label className="palette-color"><span>{label}</span><input ref={input} type="color" aria-label={label} defaultValue={value} disabled={disabled} onInput={event=>{const color=event.currentTarget.value;pending.current=color;setHex(color.toUpperCase());callbacks.current.preview(color);}}/><input type="text" aria-label={`${label}颜色代码`} value={hex} spellCheck={false} maxLength={7} disabled={disabled} onChange={event=>setHex(event.target.value)} onBlur={()=>{if(isPaletteColor(hex)){callbacks.current.preview(hex);callbacks.current.commit(hex);}else setHex(value.toUpperCase());}}/></label>;
}
export function PaletteDrawer({open,close,character,edit,writable=false}:{open:boolean;close:()=>void;character?:Character;edit?:Edit;writable?:boolean}){
 const [group,setGroup]=useState<'ui'|'wiki'|'card'>('ui'),[component,setComponent]=useState<'all'|CardComponent>('all'),[colors,setColors]=useState(appearance),[error,setError]=useState('');
 const latest=useRef({character,edit,writable});latest.current={character,edit,writable};
 useEffect(()=>{const changed=()=>setColors(appearance());window.addEventListener(APPEARANCE_EVENT,changed);return()=>window.removeEventListener(APPEARANCE_EVENT,changed);},[]);
 useEffect(()=>{if(!open)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close();document.querySelector<HTMLButtonElement>('.palette-toggle')?.focus();}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[open,close]);
 function cardPreview(key:CardColor,value:string){if(latest.current.character?.id!==character?.id||!latest.current.writable)return;for(const paper of document.querySelectorAll<HTMLElement>('.paper[data-character-id]'))if(paper.dataset.characterId===latest.current.character?.id)paper.style.setProperty(component==='all'?`--card-all-${key}`:`--card-${component}-${key}`,value);}
 function cardCommit(key:CardColor,value:string){const current=latest.current;if(current.character?.id!==character?.id||!current.writable||!current.character||!current.edit)return;
  if(component==='all'&&key!=='headingInk')current.edit(displayCharacterEdit('palette',{...current.character.palette,[key]:value}),`palette:${key}`);
  else current.edit(displayCharacterEdit('componentPalette',{...current.character.componentPalette,[component]:{...current.character.componentPalette?.[component],[key]:value}}),`palette:${component}:${key}`);
 }
 function reset(){setError('');if(group!=='card'){if(!resetAppearance(group))setError('配色已应用，但当前浏览器无法保存设置。');return;}const current=latest.current;if(!current.writable||!current.character||!current.edit)return;if(component==='all'){current.edit(displayCharacterEdit('palette',undefined));const next={...current.character.componentPalette};delete next.all;current.edit(displayCharacterEdit('componentPalette',next));}else{const next={...current.character.componentPalette};delete next[component];current.edit(displayCharacterEdit('componentPalette',next));}}
 const definitions=group==='ui'?UI_COLORS:WIKI_COLORS,disabled=group==='card'&&(!character||!edit||!writable);
 return <section id="palette-drawer" className={`palette-drawer ${open?'is-open':''}`} role="dialog" aria-label="调色盘" aria-hidden={!open} inert={!open}>
 <header><strong>调色盘</strong><nav aria-label="配色内容">{[['ui','基础界面'],['wiki','Wiki'],['card','角色卡组件']].map(([key,label])=><button key={key} type="button" aria-pressed={group===key} onClick={()=>{setGroup(key as typeof group);setError('');}}>{label}</button>)}</nav><button type="button" onClick={reset} disabled={disabled}>恢复这一组</button><button type="button" aria-label="关闭调色盘" onClick={close}>×</button></header>
 <div className="palette-drawer-body">{group==='card'&&<div className="palette-component"><label>组件<select aria-label="角色卡配色组件" value={component} onChange={event=>setComponent(event.target.value as typeof component)}><option value="all">整张角色卡</option>{CARD_COMPONENTS.map(key=><option key={key} value={key}>{componentNames[key]}</option>)}</select></label><p>{disabled?'当前角色只读。基础界面和 Wiki 仍可调整。':'配色随当前角色保存，完整 JSON 备份也会保留。组件未单独设置的颜色沿用整张卡。'}</p></div>}
 <div className="palette-color-grid">{group==='card'?(Object.keys(CARD_COLORS) as CardColor[]).filter(key=>component==='all'||key!=='paper').map(key=><ColorField key={`${character?.id}:${component}:${key}`} label={colorNames[key]} value={character?.componentPalette?.[component]?.[key]||character?.componentPalette?.all?.[key]||character?.palette?.[key]||CARD_COLORS[key]} preview={value=>cardPreview(key,value)} commit={value=>cardCommit(key,value)} disabled={disabled}/>):Object.entries(definitions).map(([key,[label,fallback]])=><ColorField key={`${group}:${key}`} label={label} value={colors[group][key]||fallback} preview={value=>applyAppearance({...colors,[group]:{...colors[group],[key]:value}})} commit={value=>{if(!saveAppearance(group as AppearanceGroup,key,value))setError('配色已应用，但当前浏览器无法保存设置。');}} disabled={false}/>)}</div>
 {group!=='card'&&<p className="palette-note">即时预览，配色保存在当前浏览器。</p>}{error&&<p role="alert">{error}</p>}</div></section>;
}
