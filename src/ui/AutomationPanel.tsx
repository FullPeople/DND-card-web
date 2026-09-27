import type {Character,Derived} from '../core/model';
import {automationEnabled,setAutomationEnabled,supportedAutomation} from '../core/automation/state';
import {armorType,equipSelection} from '../core/automation/equipment';
import type {Edit} from './CharacterPages';

export function AutomationPanel({c,d,edit,copy}:{c:Character;d:Derived;edit:Edit;copy:()=>void}){
 const supported=!c.automation||supportedAutomation(c),enabled=automationEnabled(c);
 return <section className="automation-panel">
  <p>本机自动化开发版。当前接入护甲与盾牌计算；武器快捷攻击和来源固定法术正在开发。</p>
  {!c.automation?<><p>这张卡保持手动填写。复制后可以试用自动计算，原卡和人工修正都会保留。</p><button onClick={copy}>复制并开启自动计算</button></>:supported?<label><input type="checkbox" aria-label="启用自动计算" checked={enabled} onChange={e=>edit(draft=>setAutomationEnabled(draft,e.target.checked))}/>启用自动计算</label>:<p role="alert">这张卡使用尚未支持的自动化协议或规则版本。原始记录已保留，暂不执行或转换。</p>}
  <h3>护甲与盾牌</h3><p>当前 AC：<strong data-testid="automation-ac">{d.ac}</strong>。卸下后恢复适用方案，手工绝对修正与卡面加减仍有效。</p>
  {enabled&&c.selections.filter(row=>armorType(row.entry)).map(row=><label key={row.id} style={{display:'block'}}><input type="checkbox" aria-label={`装备 ${row.entry.name}`} checked={row.equipped} onChange={e=>edit(draft=>equipSelection(draft,row.id,e.target.checked))}/>{row.entry.name} · {row.entry.source}</label>)}
  <ul>{d.trace.ac?.map((line,i)=><li key={i}>{line}</li>)}</ul>
  {d.issues.filter(issue=>issue.id.startsWith('armor-')||issue.id.startsWith('equipment-')||issue.id==='automation-protocol').map(issue=><p key={issue.id} role="alert">{issue.message}</p>)}
 </section>;
}
