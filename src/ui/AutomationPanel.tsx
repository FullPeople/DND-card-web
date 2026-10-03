import {SourceSpellChoiceControl} from './SourceSpellControls';
import {planSourceSpells} from '../core/automation/sourceSpells';
import {ABILITIES,ABILITY_LABELS,type Entry,type Ability} from '../core/model';
import {automaticWeaponAbility,automaticWeaponAttacks,weaponType} from '../core/automation/weapons';
import {planFeatureResources} from '../core/automation/featureResources';
import {sheetChoices} from '../core/automation/choices';
import type {Character,Derived} from '../core/model';
import {automationEnabled,setAutomationEnabled,supportedAutomation} from '../core/automation/state';
import {armorType,equipSelection} from '../core/automation/equipment';
import type {Edit} from './CharacterPages';
import {useState} from 'react';
import type {AutomationSource} from '../data/automationOverlay';
import {irMechanics} from '../core/automation/ir';
import {irRuntimeGaps} from '../core/automation/capabilities';

export function AutomationPanel({c,d,entries,edit,copy,writable=true,dataStatus='自动化资料尚未读取',dataReady=false,loadData}:{entries:Entry[];c:Character;d:Derived;edit:Edit;copy?:()=>void;writable?:boolean;dataStatus?:string;dataReady?:boolean;loadData?:(source?:AutomationSource,text?:string)=>Promise<void>}){
 const [url,setUrl]=useState(''),[hash,setHash]=useState(''),[version,setVersion]=useState('2.36.0'),[error,setError]=useState('');
 const coverage=c.selections.filter(row=>!row.entry.raw._contentOnly).reduce((counts,row)=>{const verdict=irRuntimeGaps(row.entry).length?'unsupported':row.entry.automation?.verdict||'needsAnnotation';counts[verdict]++;return counts;},{automated:0,noMechanics:0,needsAnnotation:0,unsupported:0});
 const supported=!c.automation||supportedAutomation(c),enabled=automationEnabled(c),weapons=automaticWeaponAttacks(c,d),spells=planSourceSpells(c,entries);
 return <section className="automation-panel"><fieldset disabled={!writable} style={{border:0,padding:0,margin:0,minWidth:0}}>
  <p role="status" data-testid="automation-data-status">{dataStatus}</p>
  <p data-testid="automation-selected-coverage">已选条目：已自动化 {coverage.automated} · 无额外机制 {coverage.noMechanics} · 待注释 {coverage.needsAnnotation} · 部分手动 {coverage.unsupported}</p>
  {loadData&&<details><summary>自动化资料源</summary><label>资料版本<input aria-label="自动化资料版本" value={version} onChange={e=>setVersion(e.target.value)}/></label><label>SHA-256<input aria-label="自动化资料哈希" value={hash} onChange={e=>setHash(e.target.value.trim())}/></label><label>资料地址<input aria-label="自动化资料地址" value={url} onChange={e=>setUrl(e.target.value)}/></label><button onClick={()=>void loadData({url,sha256:hash,kiweeVersion:version})}>读取资料源</button><label>导入本地 JSON<input aria-label="导入自动化资料" type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setError('');try{if(file.size>32*1024*1024)throw Error('文件超过 32 MB。');if(!/^[a-f0-9]{64}$/.test(hash))throw Error('请填写发布者提供的 SHA-256。');await loadData({url:`https://local.invalid/automation/${hash}.json`,sha256:hash,kiweeVersion:version},await file.text());}catch(err){setError(String(err));}finally{e.target.value='';}}}/></label><button onClick={()=>void import('../data/automationOverlay').then(api=>loadData(api.defaultAutomationSource()))}>恢复内置资料源</button>{error&&<p role="alert">{error}</p>}</details>}
  <p>已审阅的规则用于装备、选择、次数和休息。待注释、缺失与暂不支持的部分会列出。</p>
  {supported?<><p>新卡使用 IR 自动化。手写内容、修正和已消耗资源保留；可手动关闭。</p><label><input type="checkbox" aria-label="启用自动计算" checked={enabled} onChange={e=>edit(draft=>setAutomationEnabled(draft,e.target.checked))}/>启用自动计算</label></>:<><p role="alert">这张卡使用旧版或尚未支持的协议。原卡保持原样，升级会创建副本；无法对应的次数从已消耗状态开始。</p>{copy&&<button disabled={!dataReady} onClick={copy}>复制并升级到 IR 自动化</button>}</>}
  {d.issues.filter(issue=>issue.id.startsWith('automation-data:')||issue.id.startsWith('automation-gap:')||issue.id.startsWith('automation-runtime:')).map(issue=><p key={issue.id} role="alert">{issue.message}</p>)}
  <h3>护甲与盾牌</h3><p>当前 AC：<strong data-testid="automation-ac">{d.ac}</strong>。卸下后恢复适用方案，手工绝对修正与卡面加减仍有效。</p>
  {enabled&&c.selections.filter(row=>armorType(row.entry)).map(row=><label key={row.id} style={{display:'block'}}><input type="checkbox" aria-label={`装备 ${row.entry.name}`} checked={row.equipped} onChange={e=>edit(draft=>equipSelection(draft,row.id,e.target.checked))}/>{row.entry.name} · {row.entry.source}</label>)}
  <ul>{d.trace.ac?.map((line,i)=><li key={i}>{line}</li>)}</ul>
  {d.issues.filter(issue=>issue.id.startsWith('armor-')||issue.id.startsWith('equipment-')||issue.id==='automation-protocol').map(issue=><p key={issue.id} role="alert">{issue.message}</p>)}
  <h3>装备武器与快捷攻击</h3><p>装备后按属性、熟练和武器加值生成攻击。每件武器可选择命中与伤害所用属性，默认自动；武器额外加值保留。投掷、双手使用分别显示；不自动消耗弹药或判定战场条件，手工动作保留。</p>
  {enabled&&c.selections.filter(row=>weaponType(row.entry)).map(row=><div key={row.id} data-weapon-selection={row.id} style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><label><input type="checkbox" aria-label={`装备 ${row.entry.name}`} checked={row.equipped} onChange={e=>edit(draft=>equipSelection(draft,row.id,e.target.checked))}/>{row.entry.name} · {row.entry.source}</label>{row.entry.manualWeapon?.attack===undefined?<label>命中与伤害属性<select aria-label={`${row.entry.name}计算属性`} value={row.weaponAbility||''} onChange={e=>edit(draft=>{const stored=draft.selections.find(s=>s.id===row.id);if(!stored)return;if(e.target.value)stored.weaponAbility=e.target.value as Ability;else delete stored.weaponAbility;})}><option value="">自动（{ABILITY_LABELS[automaticWeaponAbility(row.entry,d)]}）</option>{ABILITIES.map(a=><option key={a} value={a}>{ABILITY_LABELS[a]}</option>)}</select></label>:<small>使用手写命中与伤害公式，计算属性不追加。</small>}</div>)}
  {weapons.attacks.map(attack=><details key={attack.key}><summary>{attack.name}：命中 {attack.attack_bonus}，伤害 {attack.damage}</summary><ul>{attack.trace.map((line,i)=><li key={i}>{line}</li>)}</ul></details>)}
  {weapons.issues.map(issue=><p key={issue.id} role="alert">{issue.message}</p>)}
  <h3>来源固定法术</h3><p>法术附属于赠送它的来源，不占普通预备名额。切换次数归属会保守保留消耗，可手动核对修正。切换方案、关闭来源与刷新不会恢复已用次数；未解析的条目仍需人工处理。</p>
  {enabled&&spells.choices.map(choice=>choice.spells?<SourceSpellChoiceControl key={choice.key} c={c} choice={choice} entries={entries} edit={edit} writable={writable}/>:<label key={choice.key} style={{display:'block'}}>{choice.label}<select aria-label={choice.label} value={choice.usageModes?c.automation?.spellUsageModes?.[choice.key]??'':choice.sets?c.automation?.spellSets?.[choice.key]??'':c.automation?.spellAbilities?.[choice.key]??''} onChange={e=>edit(draft=>{if(!draft.automation)return;if(choice.usageModes){const values=draft.automation.spellUsageModes||={};if(!e.target.value)delete values[choice.key];else values[choice.key]=e.target.value as 'shared'|'each';}else if(choice.sets){const values=draft.automation.spellSets||={};if(e.target.value==='')delete values[choice.key];else values[choice.key]=Number(e.target.value);}else{const values=draft.automation.spellAbilities||={};if(!e.target.value)delete values[choice.key];else values[choice.key]=e.target.value as Ability;}})}><option value="">请选择</option>{choice.usageModes?<><option value="each">各法术各自拥有次数</option><option value="shared">这些法术共用次数</option></>:choice.sets?choice.sets.map((label,index)=><option key={index} value={index}>{label}</option>):choice.abilities?.map(a=><option key={a} value={a}>{ABILITY_LABELS[a]}</option>)}</select></label>)}
  {spells.issues.map(issue=><p key={issue.id} role="alert">{issue.message}</p>)}
 </fieldset></section>;
}
