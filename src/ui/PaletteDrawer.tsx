import {useEffect,useRef,useState} from 'react';
import type {Character} from '../core/model';
import {CARD_COLORS,CARD_COMPONENTS,type CardColor,type CardComponent} from '../core/palette';
import {displayCharacterEdit} from '../core/displayCharacterEdit';
import {appearance,applyAppearance,APPEARANCE_EVENT,UI_COLORS,WIKI_COLORS,resetAppearance,saveAppearance,replaceAppearance,type AppearanceGroup} from '../platform/appearance';
import {download,pickFile} from '../platform/storage';
import {parsePaletteSettings,type PaletteSettings} from '../platform/paletteSettings';
import {PaletteColorField} from './PaletteColorField';
import {clearPaletteHighlight,highlightPalette} from './paletteHighlight';
import './appearance.css';
import './paletteDrawer.css';

type Edit=(action:(draft:Character)=>void,key?:string)=>void;
const componentNames:Record<CardComponent,string>={all:'整张角色卡',identity:'身份与职业',abilities:'六项属性',skills:'技能与豁免',vitals:'生命与数值',features:'特性',spells:'法术',inventory:'背包',background:'背景',resources:'快捷栏与资源',portrait:'头像与立绘'};
const colorNames:Record<CardColor,string>={paper:'纸张',surface:'内容底色',frame:'组件描边',heading:'标题栏',headingInk:'标题文字',ink:'文字',badge:'图标'};
type PaletteSnapshot={appearance:ReturnType<typeof appearance>;card?:Pick<Character,'id'|'palette'|'componentPalette'>};
type PaletteChange={before:PaletteSnapshot;after:PaletteSnapshot};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

export function PaletteButton({open,toggle}:{open:boolean;toggle:()=>void}){
 return <button type="button" className="palette-toggle" aria-label="调色盘" aria-expanded={open} aria-controls="palette-drawer" title="调色盘" onClick={toggle}><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1.3a2.1 2.1 0 0 0 1.5-3.6 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3c0-5-4-8.8-9-8.8Z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="6.7" r="1"/><circle cx="14.5" cy="6.8" r="1"/><circle cx="17.5" cy="10" r="1"/></svg></button>;
}
export function PaletteDrawer({open,close,character,edit,writable=false}:{open:boolean;close:()=>void;character?:Character;edit?:Edit;writable?:boolean}){
 const [group,setGroup]=useState<'ui'|'wiki'|'card'>('ui'),[component,setComponent]=useState<'all'|CardComponent>('all'),[colors,setColors]=useState(appearance),[error,setError]=useState(''),[includeCard,setIncludeCard]=useState(writable);
 const latest=useRef({character,edit,writable});latest.current={character,edit,writable};
 const history=useRef<{undo:PaletteChange[];redo:PaletteChange[]}>({undo:[],redo:[]});
 const [,updateHistory]=useState(0);
 useEffect(()=>{history.current={undo:[],redo:[]};updateHistory(n=>n+1);},[character?.id]);
 function snapshot():PaletteSnapshot{const card=latest.current.character;return structuredClone({appearance:appearance(),...(card?{card:{id:card.id,palette:card.palette,componentPalette:card.componentPalette}}:{})});}
 function record(before:PaletteSnapshot,after:PaletteSnapshot){if(equal(before,after))return;history.current.undo.push({before,after});if(history.current.undo.length>50)history.current.undo.shift();history.current.redo=[];updateHistory(n=>n+1);}
 function replay(redo=false){clearPaletteHighlight();setError('');const state=history.current,from=redo?state.redo:state.undo,to=redo?state.undo:state.redo,change=from.at(-1);if(!change)return;
  const expected=redo?change.before:change.after,next=redo?change.after:change.before,current=latest.current;
  if(!equal(snapshot(),expected)){history.current={undo:[],redo:[]};updateHistory(n=>n+1);setError('配色已在其他操作中改变，撤回记录已清空。');return;}
  if(!equal(expected.card,next.card)){if(!current.writable||!current.edit||!current.character||next.card?.id!==current.character.id){setError('当前角色不可编辑，原配色保留。');return;}
   if(!equal(expected.card?.palette,next.card.palette))current.edit(displayCharacterEdit('palette',structuredClone(next.card.palette)),'palette:history');
   if(!equal(expected.card?.componentPalette,next.card.componentPalette))current.edit(displayCharacterEdit('componentPalette',structuredClone(next.card.componentPalette)),'palette:history-components');
  }
  if(!equal(expected.appearance,next.appearance)&&!replaceAppearance(next.appearance))setError('配色已应用，但当前浏览器无法保存设置。');
  from.pop();to.push(change);updateHistory(n=>n+1);
 }
 useEffect(()=>{const changed=()=>setColors(appearance());window.addEventListener(APPEARANCE_EVENT,changed);return()=>window.removeEventListener(APPEARANCE_EVENT,changed);},[]);
 useEffect(()=>{clearPaletteHighlight();return clearPaletteHighlight;},[open,group,component,character?.id]);
 useEffect(()=>{window.addEventListener('scroll',clearPaletteHighlight,true);window.addEventListener('resize',clearPaletteHighlight);return()=>{window.removeEventListener('scroll',clearPaletteHighlight,true);window.removeEventListener('resize',clearPaletteHighlight);};},[]);
 useEffect(()=>{if(!open)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close();document.querySelector<HTMLButtonElement>('.palette-toggle')?.focus();}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[open,close]);
 function cardPreview(key:CardColor,value:string){if(latest.current.character?.id!==character?.id||!latest.current.writable)return;for(const paper of document.querySelectorAll<HTMLElement>('.paper[data-character-id]'))if(paper.dataset.characterId===latest.current.character?.id)paper.style.setProperty(component==='all'?`--card-all-${key}`:`--card-${component}-${key}`,value);}
 function cardCommit(key:CardColor,value:string){const current=latest.current;if(current.character?.id!==character?.id||!current.writable||!current.character||!current.edit)return;const before=snapshot(),after=structuredClone(before);
  if(component==='all'&&key!=='headingInk'){const palette={...current.character.palette,[key]:value};current.edit(displayCharacterEdit('palette',palette),`palette:${key}`);after.card!.palette=palette;}
  else {const componentPalette={...current.character.componentPalette,[component]:{...current.character.componentPalette?.[component],[key]:value}};current.edit(displayCharacterEdit('componentPalette',componentPalette),`palette:${component}:${key}`);after.card!.componentPalette=componentPalette;}record(before,after);
 }
 function appearanceCommit(key:string,value:string){const before=snapshot();if(!saveAppearance(group as AppearanceGroup,key,value))setError('配色已应用，但当前浏览器无法保存设置。');record(before,snapshot());}
 function reset(){setError('');const before=snapshot();if(group!=='card'){if(!resetAppearance(group))setError('配色已应用，但当前浏览器无法保存设置。');record(before,snapshot());return;}const current=latest.current;if(!current.writable||!current.character||!current.edit)return;const after=structuredClone(before),next={...current.character.componentPalette};delete next[component];if(component==='all'){current.edit(displayCharacterEdit('palette',undefined));after.card!.palette=undefined;}current.edit(displayCharacterEdit('componentPalette',next));after.card!.componentPalette=next;record(before,after);}
 function saveSettings(){clearPaletteHighlight();const settings:PaletteSettings={format:'dnd-card-palette',version:1,appearance:structuredClone(appearance())};if(character&&includeCard)settings.card={palette:{...character.palette},components:structuredClone(character.componentPalette||{})};download('DND-配色设置.json',settings);}
 async function importSettings(){clearPaletteHighlight();setError('');const target=latest.current.character?.id;try{const file=await pickFile('.json');if(!file)return;if(file.size>65536)throw Error('配色设置文件过大，请选择导出的配色 JSON。');const settings=parsePaletteSettings(await file.text()),current=latest.current;
  if(settings.card&&(!current.writable||!current.character||!current.edit||current.character.id!==target))throw Error('当前角色不可编辑，未导入设置。可以导入仅含基础界面和 Wiki 的配色文件。');
  const before=snapshot(),after=structuredClone(before);after.appearance=settings.appearance;
  if(settings.card&&current.edit){current.edit(displayCharacterEdit('palette',settings.card.palette),'palette:import');current.edit(displayCharacterEdit('componentPalette',settings.card.components),'palette:import-components');after.card!.palette=settings.card.palette;after.card!.componentPalette=settings.card.components;}
  if(!replaceAppearance(settings.appearance))setError('配色已应用，但当前浏览器无法保存设置。');
  record(before,after);
 }catch(error){setError(error instanceof Error?error.message:'配色文件读取失败，原设置保留。');}}
 const definitions=group==='ui'?UI_COLORS:WIKI_COLORS,disabled=group==='card'&&(!character||!edit||!writable);
 return <section id="palette-drawer" className={`palette-drawer ${open?'is-open':''}`} role="dialog" aria-label="调色盘" aria-hidden={!open} inert={!open}>
 <header><strong>调色盘</strong><nav aria-label="配色内容">{[['ui','基础界面'],['wiki','Wiki'],['card','角色卡组件']].map(([key,label])=><button key={key} type="button" aria-pressed={group===key} onClick={()=>{setGroup(key as typeof group);setError('');}}>{label}</button>)}</nav><button type="button" onClick={()=>replay()} disabled={!history.current.undo.length}>撤回配色</button><button type="button" onClick={()=>replay(true)} disabled={!history.current.redo.length}>重做配色</button><button type="button" onClick={saveSettings}>保存配色文件</button><button type="button" onClick={()=>void importSettings()}>导入配色</button><button type="button" onClick={reset} disabled={disabled}>恢复这一组</button><button type="button" aria-label="关闭调色盘" onClick={close}>×</button></header>
 <div className="palette-drawer-body">{group==='card'&&<div className="palette-component"><nav aria-label="角色卡配色组件">{(['all',...CARD_COMPONENTS] as CardComponent[]).map(key=><button key={key} type="button" aria-pressed={component===key} onClick={()=>setComponent(key)}>{componentNames[key]}</button>)}</nav><p>{disabled?'当前角色只读。基础界面和 Wiki 仍可调整。':'配色随当前角色保存，完整 JSON 备份也会保留。组件未单独设置的颜色沿用整张卡。'}</p></div>}
 <div className="palette-color-grid">{group==='card'?(Object.keys(CARD_COLORS) as CardColor[]).filter(key=>component==='all'||key!=='paper').map(key=><PaletteColorField key={`${character?.id}:${component}:${key}`} label={colorNames[key]} value={character?.componentPalette?.[component]?.[key]||character?.componentPalette?.all?.[key]||character?.palette?.[key]||CARD_COLORS[key]} preview={value=>cardPreview(key,value)} commit={value=>cardCommit(key,value)} disabled={disabled} enabled={open} highlight={()=>highlightPalette('card',key,component,character?.id)} clearHighlight={clearPaletteHighlight}/>):Object.entries(definitions).map(([key,[label,fallback]])=><PaletteColorField key={`${group}:${key}`} label={label} value={colors[group][key]||fallback} preview={value=>applyAppearance({...appearance(),[group]:{...appearance()[group],[key]:value}})} commit={value=>appearanceCommit(key,value)} disabled={false} enabled={open} highlight={()=>highlightPalette(group,key,component)} clearHighlight={clearPaletteHighlight}/>)}</div>
 {character&&<label className="palette-note palette-export-option"><input type="checkbox" checked={includeCard} onChange={event=>setIncludeCard(event.target.checked)}/>配色文件包含当前角色卡配色</label>}<p className="palette-note">点击圆钮选色，或按住并拖动；松开后应用。悬停圆钮可高亮对应区域。基础界面与 Wiki 保存在当前浏览器。</p>{error&&<p role="alert">{error}</p>}</div></section>;
}
