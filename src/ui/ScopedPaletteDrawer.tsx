import {useEffect,useRef,useState} from 'react';
import type {Character} from '../core/model';
import {CARD_COLORS,CARD_COMPONENTS,type CardColor,type CardComponent} from '../core/palette';
import {displayCharacterEdit,displayCharacterPaletteEdit} from '../core/displayCharacterEdit';
import {appearance,applyAppearance,APPEARANCE_EVENT,UI_COLORS,WIKI_COLORS,PRESETS,applyPreset,currentPreset,resetAppearance,saveAppearance,replaceAppearance,type AppearanceGroup} from '../platform/appearance';
import {download,pickFile} from '../platform/storage';
import {parseSitePaletteSettings,type PaletteSettings} from '../platform/paletteSettings';
import {parseCharacterPaletteSettings,type CharacterPaletteSettings} from '../platform/characterPaletteSettings';
import {CARD_PALETTE_PRESETS,cardPalettePreset} from './cardPalettePresets';
import {PaletteColorField} from './PaletteColorField';
import {PaletteStage,type PaletteHot} from './PaletteStage';
import {CloseIcon,SwatchIcon} from './icons';
import './paletteDrawer.css';

type Edit=(action:(draft:Character)=>void,key?:string)=>void;
type PaletteSnapshot={appearance?:ReturnType<typeof appearance>;card?:Pick<Character,'id'|'palette'|'componentPalette'>};
type PaletteChange={before:PaletteSnapshot;after:PaletteSnapshot};
export type PaletteHistory={namespace?:string;undo:PaletteChange[];redo:PaletteChange[]};
const componentNames:Record<CardComponent,string>={all:'整张角色卡',identity:'身份与职业',abilities:'六项属性',skills:'技能与豁免',vitals:'生命与数值',features:'特性',spells:'法术',inventory:'背包',background:'背景',resources:'快捷栏与资源',portrait:'头像与立绘'};
const colorNames:Record<CardColor,string>={paper:'纸张',surface:'内容底色',frame:'组件描边',heading:'标题栏',headingInk:'标题文字',ink:'文字',badge:'图标'};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

export function PaletteDrawer({open,close,scope='site',character,edit,writable=false,disabledReason,history:providedHistory}:{open:boolean;close:()=>void;scope?:'site'|'card';character?:Character;edit?:Edit;writable?:boolean;disabledReason?:string;history?:PaletteHistory}){
 const [group,setGroup]=useState<'ui'|'wiki'|'card'>(scope==='card'?'card':'ui'),[hot,setHot]=useState<PaletteHot>(),[component,setComponent]=useState<CardComponent>('all'),[colors,setColors]=useState(appearance),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const latest=useRef({character,edit,writable});latest.current={character,edit,writable};
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const localHistory=useRef<PaletteHistory>({undo:[],redo:[]}),history=providedHistory||localHistory.current;
 const [,updateHistory]=useState(0),namespace=scope==='card'?`card:${character?.id||''}`:'site';
 useEffect(()=>{if(history.namespace!==namespace){history.namespace=namespace;history.undo=[];history.redo=[];updateHistory(n=>n+1);}},[history,namespace]);
 function snapshot():PaletteSnapshot{
  if(scope==='site')return {appearance:structuredClone(appearance())};
  const card=latest.current.character;return structuredClone(card?{card:{id:card.id,palette:card.palette,componentPalette:card.componentPalette}}:{});
 }
 function record(before:PaletteSnapshot,after:PaletteSnapshot){if(equal(before,after))return;history.undo.push({before,after});if(history.undo.length>50)history.undo.shift();history.redo=[];updateHistory(n=>n+1);}
 function replay(redo=false){
  setHot(undefined);setError('');setNotice('');const from=redo?history.redo:history.undo,to=redo?history.undo:history.redo,change=from.at(-1);if(!change)return;
  const expected=redo?change.before:change.after,next=redo?change.after:change.before,current=latest.current;
  if(!equal(snapshot(),expected)){history.undo=[];history.redo=[];updateHistory(n=>n+1);setError('配色已在其他操作中改变，撤回记录已清空。');return;}
  if(scope==='card'&&!equal(expected.card,next.card)){
   if(!current.writable||!current.edit||!current.character||next.card?.id!==current.character.id){setError('当前角色不可编辑，原配色保留。');return;}
   current.edit(displayCharacterPaletteEdit({palette:structuredClone(next.card.palette),componentPalette:structuredClone(next.card.componentPalette)}),'palette:history');
  }
  if(scope==='site'&&next.appearance&&!equal(expected.appearance,next.appearance)&&!replaceAppearance(next.appearance))setError('配色已应用，但当前浏览器无法保存设置。');
  from.pop();to.push(change);updateHistory(n=>n+1);
 }
 useEffect(()=>{if(!open||scope!=='site')return;const changed=()=>setColors(appearance());window.addEventListener(APPEARANCE_EVENT,changed);return()=>window.removeEventListener(APPEARANCE_EVENT,changed);},[open,scope]);
 useEffect(()=>setHot(undefined),[open,group,component,character?.id]);
 useEffect(()=>{if(!open)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close();document.querySelector<HTMLButtonElement>(scope==='card'?'.card-palette-toggle':'.app-header .palette-toggle,.player-viewer-toolbar .palette-toggle')?.focus();}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[open,close,scope]);
 function cardPreview(key:CardColor,value:string){
  if(scope!=='card'||latest.current.character?.id!==character?.id||!latest.current.writable)return;
  const name=component==='all'?`--card-all-${key}`:`--card-${component}-${key}`;
  for(const paper of document.querySelectorAll<HTMLElement>('.paper[data-character-id]'))if(paper.dataset.characterId===latest.current.character?.id)paper.style.setProperty(name,value);
  for(const stage of document.querySelectorAll<HTMLElement>('[data-palette-stage]'))stage.style.setProperty(name,value);
 }
 function cardCommit(key:CardColor,value:string){
  const current=latest.current;if(scope!=='card'||current.character?.id!==character?.id||!current.writable||!current.character||!current.edit)return;
  const before=snapshot(),after=structuredClone(before);
  const componentPalette={...current.character.componentPalette,[component]:{...current.character.componentPalette?.[component],[key]:value}};
  current.edit(displayCharacterEdit('componentPalette',componentPalette),`palette:${component}:${key}`);after.card!.componentPalette=componentPalette;
  record(before,after);
 }
 function appearanceCommit(key:string,value:string){if(scope!=='site')return;const before=snapshot();if(!saveAppearance(group as AppearanceGroup,key,value))setError('配色已应用，但当前浏览器无法保存设置。');record(before,snapshot());}
 function reset(){
  setError('');setNotice('');const before=snapshot();
  if(scope==='site'){if(!resetAppearance(group as AppearanceGroup))setError('配色已应用，但当前浏览器无法保存设置。');record(before,snapshot());return;}
  const current=latest.current;if(!current.writable||!current.character||!current.edit)return;
  const after=structuredClone(before),next={...current.character.componentPalette};delete next[component];
  if(component==='all')after.card!.palette=undefined;
  after.card!.componentPalette=next;current.edit(displayCharacterPaletteEdit(after.card!),'palette:reset');record(before,after);
 }
 function saveSettings(){
  setHot(undefined);
  if(scope==='site'){const settings:PaletteSettings={format:'dnd-card-palette',version:1,appearance:structuredClone(appearance())};download('DND-网页配色.json',settings);return;}
  const current=latest.current.character;if(!current)return;
  const settings:CharacterPaletteSettings={format:'dnd-character-palette',version:1,card:{palette:{...current.palette},components:structuredClone(current.componentPalette||{})}};
  download('DND-角色卡配色.json',settings);
 }
 async function importSettings(){
  setHot(undefined);setError('');setNotice('');const target=latest.current.character?.id;
  try{
   const file=await pickFile('.json');if(!file)return;if(file.size>65536)throw Error('配色设置文件过大，请选择导出的配色 JSON。');
   const text=await file.text();if(!mounted.current)return;const before=snapshot();
   if(scope==='site'){
    const settings=parseSitePaletteSettings(text);if(!replaceAppearance(settings.appearance))setError('配色已应用，但当前浏览器无法保存设置。');
    if((JSON.parse(text) as {card?:unknown}).card)setNotice('已导入网页配色；文件中的角色卡颜色可在卡片右上角的调色盘中导入。');
    record(before,snapshot());return;
   }
   const settings=parseCharacterPaletteSettings(text),current=latest.current;
   if(!current.writable||!current.character||!current.edit||current.character.id!==target)throw Error('当前角色不可编辑或已切换，原配色保留。');
   const after=structuredClone(before);
   current.edit(displayCharacterPaletteEdit({palette:settings.card.palette,componentPalette:settings.card.components}),'palette:import');
   after.card!.palette=settings.card.palette;after.card!.componentPalette=settings.card.components;record(before,after);
  }catch(problem){setError(problem instanceof Error?problem.message:'配色文件读取失败，原设置保留。');}
 }
 function choosePreset(id:string){
  setError('');setNotice('');const before=snapshot();
  if(scope==='site'){if(applyPreset(id))record(before,snapshot());return;}
  const preset=CARD_PALETTE_PRESETS.find(row=>row.id===id),current=latest.current;
  if(!preset||!current.writable||!current.character||!current.edit)return;
  const componentPalette={all:{...preset.colors}},after=structuredClone(before);
  current.edit(displayCharacterEdit('componentPalette',componentPalette),'palette:preset');after.card!.componentPalette=componentPalette;record(before,after);
 }
 const appearanceGroup:AppearanceGroup=group==='wiki'?'wiki':'ui',definitions=appearanceGroup==='ui'?UI_COLORS:WIKI_COLORS,disabled=scope==='card'&&(!character||!edit||!writable),preset=scope==='card'?cardPalettePreset(character):currentPreset(colors),title=scope==='card'?'角色卡调色盘':'网页调色盘';
 return <section id={scope==='card'?'character-palette-drawer':'palette-drawer'} data-palette-scope={scope} className={`palette-drawer ${open?'is-open':''}`} role="dialog" aria-label={scope==='card'?title:'调色盘'} aria-hidden={!open} inert={!open}>
  <header><strong>{title}</strong>{scope==='site'?<nav aria-label="配色内容">{[['ui','基础界面'],['wiki','Wiki']].map(([key,label])=><button key={key} type="button" aria-pressed={group===key} onClick={()=>{setGroup(key as typeof group);setError('');setNotice('');}}>{label}</button>)}</nav>:<span className="palette-card-name">{character?.name||'当前角色卡'}</span>}
   <button type="button" onClick={()=>replay()} disabled={!history.undo.length}>撤回配色</button><button type="button" onClick={()=>replay(true)} disabled={!history.redo.length}>重做配色</button><button type="button" onClick={saveSettings}>保存配色文件</button><button type="button" onClick={()=>void importSettings()}>导入配色</button><button type="button" onClick={reset} disabled={disabled}>恢复这一组</button><button type="button" className="palette-close" aria-label="关闭调色盘" title="关闭" onClick={close}><CloseIcon/></button>
  </header>
  {open&&<div className="palette-drawer-body"><div className="palette-layout"><PaletteStage group={group} hot={hot} character={scope==='card'?character:undefined}/><div className="palette-fields">
   <div className="palette-presets" role="group" aria-label={scope==='card'?'角色卡配色示例':'配色方案'}><span className="palette-presets-label"><SwatchIcon/>{scope==='card'?'整卡配色示例':'配色方案'}</span>{scope==='card'?CARD_PALETTE_PRESETS.map(row=><button key={row.id} type="button" className="palette-preset" aria-pressed={preset===row.id} title={row.description} disabled={disabled} onClick={()=>choosePreset(row.id)}><span className="palette-preset-swatches" aria-hidden="true"><i style={{background:row.colors.paper}}/><i style={{background:row.colors.surface}}/><i style={{background:row.colors.heading}}/><i style={{background:row.colors.frame}}/><i style={{background:row.colors.ink}}/></span>{row.name}</button>):PRESETS.map(row=><button key={row.id} type="button" className="palette-preset" aria-pressed={preset===row.id} title={row.description} onClick={()=>choosePreset(row.id)}><span className="palette-preset-swatches" aria-hidden="true"><i style={{background:row.colors.ui.background}}/><i style={{background:row.colors.ui.surface}}/><i style={{background:row.colors.ui.band}}/><i style={{background:row.colors.ui.selected}}/><i style={{background:row.colors.ui.accent}}/></span>{row.name}</button>)}</div>
   {scope==='card'&&<div className="palette-component"><nav aria-label="角色卡配色组件">{(['all',...CARD_COMPONENTS] as CardComponent[]).map(key=><button key={key} type="button" aria-pressed={component===key} onClick={()=>setComponent(key)}>{componentNames[key]}</button>)}</nav>{disabled?<aside className="class-compatibility-banner card-permission-banner" role="status"><p>{disabledReason||'当前角色只读，无法修改角色卡配色。'}</p></aside>:<p>颜色仅随当前角色保存，完整 JSON 备份会保留。应用整卡示例会替换这一张卡的整套颜色，可撤回。</p>}</div>}
   <div className="palette-color-grid">{scope==='card'?(Object.keys(CARD_COLORS) as CardColor[]).filter(key=>component==='all'||key!=='paper').map(key=><PaletteColorField key={`${character?.id}:${component}:${key}`} label={colorNames[key]} value={character?.componentPalette?.[component]?.[key]||character?.componentPalette?.all?.[key]||character?.palette?.[key]||CARD_COLORS[key]} preview={value=>cardPreview(key,value)} commit={value=>cardCommit(key,value)} disabled={disabled} enabled={open} highlight={()=>setHot({group:'card',key,component})} clearHighlight={()=>setHot(undefined)}/>):Object.entries(definitions).map(([key,[label,fallback]])=><PaletteColorField key={`${group}:${key}`} label={label} value={colors[appearanceGroup][key]||fallback} preview={value=>applyAppearance({...appearance(),[appearanceGroup]:{...appearance()[appearanceGroup],[key]:value}})} commit={value=>appearanceCommit(key,value)} disabled={false} enabled={open} highlight={()=>setHot({group,key})} clearHighlight={()=>setHot(undefined)}/>)}</div>
   <p className="palette-note">点击圆钮选色，或按住并拖动；松开后应用，Esc 取消未提交的选色。{scope==='card'?'当前卡的配色独立于网页和其他角色卡。':'这里仅调整基础界面和 Wiki，设置保存在当前浏览器。'}</p>{notice&&<p className="palette-note" role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  </div></div></div>}
 </section>;
}
