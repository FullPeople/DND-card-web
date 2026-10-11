import type {Edition} from '../core/model';
import {useSources,type SourceMode} from './SourceName';

export function LibraryDisplaySettings({edition,characterEdition,changeEdition}:{edition:string;characterEdition:Edition;changeEdition:(edition:string)=>void}){
 const {mode,setMode}=useSources();
 return <section className="settings-section library-display-settings"><h3>资料浏览</h3><p className="muted">这些选项只改变你看到的资料，不修改角色卡或房间规则；只读时也可以调整。</p>
 <div className="setting-row"><span>资料版本</span><div className="segmented" role="radiogroup" aria-label="资料浏览版本">{[['character',`跟随角色 · ${characterEdition}`],['2014','2014'],['2024','2024'],['all','2014 与 2024']].map(([value,label])=><button type="button" key={value} role="radio" aria-checked={edition===value} onClick={()=>changeEdition(value)}>{label}</button>)}</div></div>
 <div className="setting-row"><span>简写显示方式</span><div className="segmented" role="radiogroup" aria-label="简写显示方式">{([['full','纯文本'],['short','简写'],['both','纯文本（简写）']] as [SourceMode,string][]).map(([value,label])=><button type="button" key={value} role="radio" aria-checked={mode===value} onClick={()=>setMode(value)}>{label}</button>)}</div></div>
 </section>;
}
