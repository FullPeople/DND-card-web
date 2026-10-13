import {useMemo,useState} from 'react';
import {classMatches,type Character,type Entry} from '../core/model';
import {resolveEntryReference} from '../core/entryReferences';
import {librarySourceEnabled} from './libraryData';
import {wikiEditionAllows} from './wikiEdition';
import {Entries} from './Entries';
import {SourceName} from './SourceName';

export function SubclassComparison({entry,entries,character,editionFilter,onLink}:{entry:Entry;entries:Entry[];character:Character;editionFilter:string;onLink:(reference:string,kind?:string)=>void}){
 const [chosen,setChosen]=useState<string[]>([]);
 const parent=entry.kind==='class'?entry:entries.find(value=>value.kind==='class'&&classMatches(entry,value));
 const options=useMemo(()=>parent?entries.filter(value=>value.kind==='subclass'&&classMatches(value,parent)&&librarySourceEnabled(character,value)&&wikiEditionAllows(value,character,editionFilter)):[],[parent,entries,character,editionFilter]);
 const selected=options.filter(value=>chosen.includes(value.id));
 const features=(value:Entry):Entry[]=>(value.raw.subclassFeatures||[]).flatMap((pointer:any)=>{const target=resolveEntryReference(typeof pointer==='string'?pointer:pointer.subclassFeature,entries,'feature');return target?[target]:[];});
 const levels=[...new Set(selected.flatMap(value=>features(value).map(feature=>Number(feature.raw.level)||0)))].sort((a,b)=>a-b);
 if(!['class','subclass'].includes(entry.kind)||options.length<2)return null;
 return <details className="subclass-comparison"><summary>比较子职</summary><p>选择最多 3 个子职，按等级并排阅读；版本和来源按当前筛选保留。</p><div className="comparison-picks">{options.map(value=><label key={value.id}><input type="checkbox" checked={chosen.includes(value.id)} disabled={chosen.length>=3&&!chosen.includes(value.id)} onChange={()=>setChosen(old=>old.includes(value.id)?old.filter(id=>id!==value.id):[...old,value.id])}/>{value.name}（{value.source}）</label>)}</div>
  {selected.length>0&&<div className="comparison-table"><table><thead><tr><th scope="col">等级</th>{selected.map(value=><th key={value.id} scope="col">{value.name}<br/><small><SourceName id={value.source}/></small></th>)}</tr></thead><tbody>{levels.map(level=><tr key={level}><th scope="row">{level||'—'}</th>{selected.map(value=><td key={value.id}>{features(value).filter(feature=>(Number(feature.raw.level)||0)===level).map(feature=><section key={feature.id}><strong>{feature.name}</strong><Entries compact value={feature.entries} onLink={onLink}/></section>)}</td>)}</tr>)}{!levels.length&&<tr><th scope="row">正文</th>{selected.map(value=><td key={value.id}><Entries value={value.entries} onLink={onLink}/></td>)}</tr>}</tbody></table></div>}
 </details>;
}
