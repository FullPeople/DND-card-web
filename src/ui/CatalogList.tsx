import { useEffect, useMemo, useState } from 'react';
import type { Character, Entry } from '../core/model';
import { EntryDraggable } from './DragEntry';
import { SourceName } from './SourceName';
import { explicitlyExcluded, type Column, type LibraryTab } from './libraryData';
import { VirtualList } from './VirtualList';

type Row={id:string;entry:Entry;group?:Entry[];child?:boolean};
function raceFamilyName(e:Entry){return String(e.raw._parentName||e.raw.raceName||e.raw._versionBaseName||e.raw._baseName||e.name||e.english).replace(/\s*[（(][^）)]*[）)]\s*$/,'').trim();}
export function raceFamily(e:Entry){return raceFamilyName(e).toLowerCase();}
export function CatalogList({entries,columns,kind,character,selected,inspect,sort,descending,onSort,resetKey,loading,onSettings,pulse}: {entries:Entry[];columns:Column[];kind:LibraryTab;character:Character;selected?:Entry;inspect:(e:Entry)=>void;sort:string;descending:boolean;onSort:(key:string)=>void;resetKey:string;loading:boolean;onSettings:()=>void;pulse:number}){
 const [expanded,setExpanded]=useState<string[]>([]);
 const families=useMemo(()=>{const groups=new Map<string,Entry[]>();if(kind==='race')for(const e of entries){const key=raceFamily(e),group=groups.get(key)||[];group.push(e);groups.set(key,group);}return groups;},[entries,kind]);
 useEffect(()=>{if(selected?.kind==='race'){const key=raceFamily(selected);setExpanded(v=>v.includes(key)?v:[...v,key]);}},[selected?.id]);
 const rows=useMemo(()=>kind!=='race'?entries.map(entry=>({id:entry.id,entry})):Array.from(families,([key,group])=>group.length===1?[{id:group[0].id,entry:group[0]}]:[{id:`group:${key}`,entry:group[0],group},...(expanded.includes(key)?group.map(entry=>({id:entry.id,entry,child:true})):[])]).flat(),[entries,kind,families,expanded]);
 const grid={gridTemplateColumns:`minmax(120px,2.1fr) repeat(${columns.length-2},minmax(40px,1fr)) minmax(70px,1.2fr)`};
 const row=(value:Row)=>{const {entry,group}=value;if(group){const key=raceFamily(entry),open=expanded.includes(key);return <button className="catalog-race-group" aria-expanded={open} onClick={()=>setExpanded(v=>open?v.filter(x=>x!==key):[...v,key])}><span>{open?'▾':'▸'}</span><strong>{raceFamilyName(entry)}</strong><small>{group.length} 个条目</small></button>;}
 return <EntryDraggable entry={entry} data-entry-id={entry.id} style={grid} className={`catalog-row columns-${kind} ${value.child?'race-child':''} ${entry.raw.meta?.ritual?'ritual-row':''} ${explicitlyExcluded(character,entry)?'entry-disabled':''} ${selected?.id===entry.id?'active':''}`} onClick={()=>inspect(entry)}>{columns.map(col=><span key={col.key} className={col.key==='name'?'entry-name':'catalog-value'}>{col.key==='name'?<>{entry.name}{entry.english!==entry.name&&<small> {entry.english}</small>}</>:col.key==='source'?<SourceName id={entry.source}/>:col.key==='level'&&entry.kind==='spell'?entry.raw.level===0?'戏法':`${entry.raw.level}环`:col.key==='hd'?`d${col.value(entry)}`:col.value(entry)===''?'—':col.value(entry)}</span>)}</EntryDraggable>;};
 return <div className="catalog-shell">{pulse>0&&<div className="catalog-fill-glow" key={pulse} aria-hidden="true"/>}<VirtualList items={rows} rowHeight={28} className="catalog-list" label="资料列表" resetKey={resetKey} itemKey={r=>r.id} renderRow={row} header={<div className={`catalog-columns columns-${kind}`} style={grid} role="row">{columns.map(col=><button key={col.key} role="columnheader" aria-sort={sort===col.key?descending?'descending':'ascending':'none'} onClick={()=>onSort(col.key)}>{col.label}{sort===col.key?descending?' ▾':' ▴':''}</button>)}</div>} empty={<div className="empty-state"><span>没有符合条件的条目</span><p>{loading?'资料正在载入。':'试试其他关键词，或取消“已启用”查看全部来源。'}</p><button onClick={onSettings}>查看规则设置</button></div>}/></div>;
}
