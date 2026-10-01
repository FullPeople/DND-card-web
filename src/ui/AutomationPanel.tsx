import {SourceSpellChoiceControl,SourceSpellRestControl} from './SourceSpellControls';
import {planSourceSpells} from '../core/automation/sourceSpells';
import {ABILITIES,ABILITY_LABELS,type Entry,type Ability} from '../core/model';
import {automaticWeaponAbility,automaticWeaponAttacks,weaponType} from '../core/automation/weapons';
import type {Character,Derived} from '../core/model';
import {automationEnabled,setAutomationEnabled,supportedAutomation} from '../core/automation/state';
import {armorType,equipSelection} from '../core/automation/equipment';
import type {Edit} from './CharacterPages';

export function AutomationPanel({c,d,entries,edit,copy,writable=true}:{entries:Entry[];c:Character;d:Derived;edit:Edit;copy?:()=>void;writable?:boolean}){
 const supported=!c.automation||supportedAutomation(c),enabled=automationEnabled(c),weapons=automaticWeaponAttacks(c,d),spells=planSourceSpells(c,entries);
 return <section className="automation-panel"><fieldset disabled={!writable} style={{border:0,padding:0,margin:0,minWidth:0}}>
  <p>基础自动化支持护甲、盾牌、装备武器快捷攻击和来源赠送法术；未支持的部分会列出。</p>
  {!c.automation?<><p>{copy?'这张卡保持手动填写。复制后可以试用自动计算，原卡和人工修正都会保留。':'这张卡保持手动填写。开启后按装备与来源计算，手写内容和人工修正保留，也可随时关闭。'}</p><button onClick={copy||(()=>edit(draft=>setAutomationEnabled(draft,true)))}>{copy?'复制并开启自动计算':'开启自动计算'}</button></>:supported?<label><input type="checkbox" aria-label="启用自动计算" checked={enabled} onChange={e=>edit(draft=>setAutomationEnabled(draft,e.target.checked))}/>启用自动计算</label>:<p role="alert">这张卡使用尚未支持的自动化协议或规则版本。原始记录已保留，暂不执行或转换。</p>}
  <h3>护甲与盾牌</h3><p>当前 AC：<strong data-testid="automation-ac">{d.ac}</strong>。卸下后恢复适用方案，手工绝对修正与卡面加减仍有效。</p>
  {enabled&&c.selections.filter(row=>armorType(row.entry)).map(row=><label key={row.id} style={{display:'block'}}><input type="checkbox" aria-label={`装备 ${row.entry.name}`} checked={row.equipped} onChange={e=>edit(draft=>equipSelection(draft,row.id,e.target.checked))}/>{row.entry.name} · {row.entry.source}</label>)}
  <ul>{d.trace.ac?.map((line,i)=><li key={i}>{line}</li>)}</ul>
  {d.issues.filter(issue=>issue.id.startsWith('armor-')||issue.id.startsWith('equipment-')||issue.id==='automation-protocol').map(issue=><p key={issue.id} role="alert">{issue.message}</p>)}
  <h3>装备武器与快捷攻击</h3><p>装备后按属性、熟练和武器加值生成攻击。每件武器可选择命中与伤害所用属性，默认自动；武器额外加值保留。投掷、双手使用分别显示；不自动消耗弹药或判定战场条件，手工动作保留。</p>
  {enabled&&c.selections.filter(row=>weaponType(row.entry)).map(row=><div key={row.id} data-weapon-selection={row.id} style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><label><input type="checkbox" aria-label={`装备 ${row.entry.name}`} checked={row.equipped} onChange={e=>edit(draft=>equipSelection(draft,row.id,e.target.checked))}/>{row.entry.name} · {row.entry.source}</label>{row.entry.raw.attackBonus===undefined?<label>命中与伤害属性<select aria-label={`${row.entry.name}计算属性`} value={row.weaponAbility||''} onChange={e=>edit(draft=>{const stored=draft.selections.find(s=>s.id===row.id);if(!stored)return;if(e.target.value)stored.weaponAbility=e.target.value as Ability;else delete stored.weaponAbility;})}><option value="">自动（{ABILITY_LABELS[automaticWeaponAbility(row.entry,d)]}）</option>{ABILITIES.map(a=><option key={a} value={a}>{ABILITY_LABELS[a]}</option>)}</select></label>:<small>使用手写命中与伤害公式，计算属性不追加。</small>}</div>)}
  {weapons.attacks.map(attack=><details key={attack.key}><summary>{attack.name}：命中 {attack.attack_bonus}，伤害 {attack.damage}</summary><ul>{attack.trace.map((line,i)=><li key={i}>{line}</li>)}</ul></details>)}
  {weapons.issues.map(issue=><p key={issue.id} role="alert">{issue.message}</p>)}
  <h3>来源固定法术</h3><p>法术附属于赠送它的来源，不占普通预备名额。切换次数归属会保守保留消耗，可手动核对修正。切换方案、关闭来源与刷新不会恢复已用次数；未解析的条目仍需人工处理。</p>
  {enabled&&spells.choices.map(choice=>choice.spells?<SourceSpellChoiceControl key={choice.key} c={c} choice={choice} entries={entries} edit={edit} writable={writable}/>:<label key={choice.key} style={{display:'block'}}>{choice.label}<select aria-label={choice.label} value={choice.usageModes?c.automation?.spellUsageModes?.[choice.key]??'':choice.sets?c.automation?.spellSets?.[choice.key]??'':c.automation?.spellAbilities?.[choice.key]??''} onChange={e=>edit(draft=>{if(!draft.automation)return;if(choice.usageModes){const values=draft.automation.spellUsageModes||={};if(!e.target.value)delete values[choice.key];else values[choice.key]=e.target.value as 'shared'|'each';}else if(choice.sets){const values=draft.automation.spellSets||={};if(e.target.value==='')delete values[choice.key];else values[choice.key]=Number(e.target.value);}else{const values=draft.automation.spellAbilities||={};if(!e.target.value)delete values[choice.key];else values[choice.key]=e.target.value as Ability;}})}><option value="">请选择</option>{choice.usageModes?<><option value="each">各法术各自拥有次数</option><option value="shared">这些法术共用次数</option></>:choice.sets?choice.sets.map((label,index)=><option key={index} value={index}>{label}</option>):choice.abilities?.map(a=><option key={a} value={a}>{ABILITY_LABELS[a]}</option>)}</select></label>)}
  {enabled&&<SourceSpellRestControl c={c} edit={edit} writable={writable}/>}
  {spells.issues.map(issue=><p key={issue.id} role="alert">{issue.message}</p>)}
 </fieldset></section>;
}
