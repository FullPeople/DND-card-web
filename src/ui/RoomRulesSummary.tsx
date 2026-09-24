import type {Character,Entry} from '../core/model';
import {SourceSettings} from './SourceSettings';
import {useSources} from './SourceName';
import './rules177.css';

export function RoomRulesSummary({character,entries,scope}:{character:Character;entries:Entry[];scope?:string}){
 const {setMode}=useSources();
 return <div className="room-rules-summary">
  <section className="settings-section"><h3>{scope==='room'?'房间规则':'场景规则'} <small>{character.edition}</small></h3><div className="room-rule-flags">
   {([['feats','专长'],['multiclass','兼职'],['legacy','兼容旧版']] as const).map(([key,label])=><span key={key} className={character.profile.optional[key]?'enabled':''}><input type="checkbox" checked={character.profile.optional[key]} readOnly aria-label={label} tabIndex={-1}/>{label}</span>)}
  </div></section>
  <SourceSettings c={character} entries={entries} edit={()=>{}} readOnly summary changeMode={setMode}/>
  {Object.keys(character.profile.exceptions).length>0&&<section className="settings-section"><h3>DM 特许</h3>{Object.entries(character.profile.exceptions).map(([id,reason])=><p key={id}>{entries.find(e=>e.id===id)?.name||id}：{reason}</p>)}</section>}
 </div>;
}
