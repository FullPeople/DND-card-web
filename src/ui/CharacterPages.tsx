import {displayCharacterEdit} from '../core/displayCharacterEdit';
import {InventoryMarks} from './InventoryMarks';
import {NumberInput} from './NumberInput';
import {useContext} from 'react';
import {ABILITIES,ABILITY_LABELS,type Character,type Derived,type Entry,type Kind,type Selection,signed} from '../core/model';
import {spellValues,spellState} from '../core/characterDetails';
import {SheetCell} from './SheetCell';
import {SheetEditContext} from './SheetEdit';
import {Portrait} from './Portrait';
import {FeaturePanel} from './FeaturePanel';
import {ChoiceWorkspace} from './ChoiceWorkspace';
import {useChoiceWorkspace} from './ChoiceWorkspaceContext';
import {IdentityToken} from './IdentityToken';
export type Edit=(action:(c:Character)=>void,key?:string)=>void;
export type PageProps={c:Character;d:Derived;edit:Edit;browse:(kind:Kind)=>void;inspect:(e:Entry)=>void;onLink:(ref:string,kind?:string)=>void;add:(e:Entry)=>void;entries?:Entry[]};
export const number=(v:string,max=9999)=>Math.max(0,Math.min(max,Math.trunc(Number(v)||0)));
function Identity({kind,label,c,edit,inspect,browse,plain}:{kind:Kind;label:string;plain?:boolean}&Pick<PageProps,'c'|'edit'|'inspect'|'browse'>){
 if(plain){const picked=c.selections.filter(s=>s.entry.kind===kind).map(s=>s.entry.name).join('、');return <label className="biography-field"><span>{label}</span><div className="biography-text">{picked}</div></label>;}
 return <SheetCell label={label} className={`identity-field detail-identity identity-${kind}`} dropKinds={kind==='class'?['class','subclass']:[kind]}>{c.selections.filter(s=>s.entry.kind===kind||(kind==='class'&&s.entry.kind==='subclass')).map(s=><IdentityToken key={s.id} row={s} c={c} edit={edit} inspect={inspect}/>)}{!c.selections.some(s=>s.entry.kind===kind)&&<button className="cell-fill" onClick={()=>browse(kind)}>点击并拖拽填写</button>}</SheetCell>;}
export function DetailHeader(props:PageProps&{page:string;openSpellAbility?:()=>void}){
 const {c,d,edit,page}=props,values=spellValues(c,d),editing=useContext(SheetEditContext),settings=spellState(c);
 // 背景页的页头只剩一个「背景」条目格，与下方形制重复，整条页头省掉、高度全给网格。
 if(page==='背景')return null;
 const spellStat=(kind:'attack'|'dc')=>{const key=kind==='attack'?'attackBonus':'dcBonus',label=kind==='attack'?'法术攻击':'法术DC',bonus=settings[key];return <div className={`adjusted-value ${editing?'has-adjustment':''}`}><strong className="page-value">{kind==='attack'?signed(values.attack):values.dc}</strong>{editing&&<label className="stat-adjustment"><span>调整</span><NumberInput aria-label={`${label}调整值`} type="number" min="-100" max="100" value={bonus} onChange={e=>{const value=Math.max(-100,Math.min(100,Number(e.target.value)||0));edit(d=>{d.spellSettings||=structuredClone(settings);d.spellSettings[key]=value;});}}/></label>}</div>;};
 return <header className={`detail-page-header header-${page}`}><div className="page-caption"><small>{c.name} · {c.edition}</small><h2>{page}</h2></div><div className="page-header-fields">
 {page==='特性'?<>{(['class','background','race'] as Kind[]).map((kind,i)=><Identity {...props} key={kind} kind={kind} label={['职业','背景','种族'][i]}/>)}</>:page==='法术'?<><SheetCell label="法术攻击加值">{spellStat('attack')}</SheetCell><SheetCell label="法术豁免 DC">{spellStat('dc')}</SheetCell><SheetCell label="施法属性" className="spell-ability-cell" settingsIcon onHeadingClick={editing?props.openSpellAbility:undefined} headingActionLabel="设置施法属性"><strong className="page-value">{ABILITY_LABELS[settings.ability]}</strong></SheetCell></>:page==='背包'?<InventoryMarks c={c} edit={edit}/>:<Identity {...props} kind="background" label="背景"/>}
 {page!=='背景'&&<Portrait c={c} edit={edit}/>}</div></header>;
}
export function FeaturesPage(props:PageProps){const workspace=useChoiceWorkspace();const {c,edit,browse,onLink,add}=props;const owner=(s:Selection)=>{let row=s;const seen=new Set<string>();while(row.parentId&&!seen.has(row.id)){seen.add(row.id);const parent=c.selections.find(p=>p.id===row.parentId);if(!parent)break;row=parent;}return row.entry.kind;};const rows=c.selections.filter(s=>['feature','rule','feat'].includes(s.entry.kind));
 const panel=(label:string,items:Selection[],kinds:Kind[],className:string)=><FeaturePanel detailed catalog={props.entries||[]} owners={c.selections.filter(s=>label==='职业特性'?['class','subclass'].includes(s.entry.kind):label==='种族特性'?s.entry.kind==='race':label==='背景特性'?s.entry.kind==='background':false)} c={c} edit={edit} rows={items} label={label} kinds={kinds} className={className} browse={()=>browse(kinds[0])} receive={add} onLink={onLink}/>;
 if(workspace.id)return <ChoiceWorkspace key={`${c.id}:${workspace.id}`} c={c} catalog={props.entries||[]} id={workspace.id} edit={edit} close={workspace.close}/>;
 return <><div className="features-page-grid">{panel('职业特性',rows.filter(s=>s.entry.kind!=='feat'&&!['race','background'].includes(owner(s))),['feature','rule'],'detail-class-features')}{panel('种族特性',rows.filter(s=>s.entry.kind!=='feat'&&owner(s)==='race'),['feature','rule'],'detail-race-features')}{panel('专长',rows.filter(s=>s.entry.kind==='feat'),['feat'],'detail-feats')}{panel('背景特性',rows.filter(s=>s.entry.kind!=='feat'&&owner(s)==='background'),['feature','rule'],'detail-background-features')}</div></>;
}
function TextField({label,value,change,multi=false}:{label:string;value:string;change:(v:string)=>void;multi?:boolean}){const editing=useContext(SheetEditContext);return <label className={`biography-field ${multi?'biography-multi':''}`}><span>{label}</span>{editing?multi?<textarea aria-label={label} value={value} onChange={e=>change(e.target.value)}/>:<input aria-label={label} value={value} onChange={e=>change(e.target.value)}/>:<div className="biography-text">{value}</div>}</label>;}
export function BackgroundPage({c,edit}:PageProps){const biography=c.biography||{};const bio=(key:keyof NonNullable<Character['biography']>,label:string,multi=true)=><TextField label={label} multi={multi} value={biography[key]??(key==='story'?c.notes:'')} change={value=>edit(c=>{(c.biography||={})[key]=value;},key)}/>;
 return <div className="biography-grid"><SheetCell label="人物资料" className="bio-identity"><TextField label="角色名" value={c.name} change={v=>edit(displayCharacterEdit('name',v),'name')}/><TextField label="玩家" value={c.player} change={v=>edit(displayCharacterEdit('player',v),'player')}/><Identity {...props} kind="background" label="背景" plain/>{bio('hometown','故乡',false)}{(['age','gender','alignment'] as const).map((key,i)=><TextField key={key} label={['年龄','性别','阵营'][i]} value={c.identity[key]} change={v=>edit(c=>{c.identity[key]=v;},key)}/>)}{bio('height','身高',false)}{bio('weight','体重',false)}</SheetCell><SheetCell label="背景描述" className="bio-description">{bio('backgroundDescription','背景描述')}</SheetCell><SheetCell label="人物形象" className="bio-appearance"><TextField label="人物形象" multi value={c.identity.description} change={v=>edit(c=>{c.identity.description=v;},'description')}/></SheetCell><SheetCell label="个性与信念" className="bio-personality">{bio('traits','个性')}{bio('ideals','理念')}{bio('bonds','羁绊')}{bio('flaws','缺陷')}</SheetCell><SheetCell label="背景故事" className="bio-story">{bio('story','背景故事')}</SheetCell><div className="bio-portrait"><Portrait c={c} edit={edit} field="illustration"/></div></div>;
}
