import {INFUSION_DAMAGE_TYPES} from '../core/automation/infusions';
import {ArmorAdjustmentReview} from './ArmorAdjustmentReview';
import {RacialDarkvisionSummary} from './RacialDarkvisionSummary';
import {RacialMovementSummary} from './RacialMovementSummary';
import {SourceSpellChoiceControl,SourceResourceColumnControl} from './SourceSpellControls';
import {LimitedSourceUseControl} from './LimitedSourceUseControl';
import {ItemChargeUseControl} from './ItemChargeUseControl';
import {ItemAtWillSpellControl} from './ItemAtWillSpellControl';
import {ChargedItemSpellControl} from './ChargedItemSpellControl';
import {chargedItemSpellOffers} from '../core/automation/chargedItemSpells';
import {itemAtWillOffers,itemAtWillStateIssue} from '../core/automation/itemAtWill';
import {itemChargeOffers,itemChargeStateIssue} from '../core/automation/itemChargeDebits';
import {limitedSourceUseOffers} from '../core/automation/limitedSourceUses';
import {planSourceSpells} from '../core/automation/sourceSpells';
import {ABILITIES,ABILITY_LABELS,type Entry,type Ability} from '../core/model';
import {automaticWeaponAbility,automaticWeaponAttacks,weaponType} from '../core/automation/weapons';
import {planFeatureResources} from '../core/automation/featureResources';
import {sheetChoices} from '../core/automation/choices';
import type {Character,Derived} from '../core/model';
import {automationEnabled,setAutomationEnabled,supportedAutomation} from '../core/automation/state';
import {armorType,equipSelection} from '../core/automation/equipment';
import type {Edit} from './CharacterPages';

export function AutomationPanel({c,d,entries,edit,copy,writable=true}:{entries:Entry[];c:Character;d:Derived;edit:Edit;copy?:()=>void;writable?:boolean}){
 const supported=!c.automation||supportedAutomation(c),enabled=automationEnabled(c),weapons=automaticWeaponAttacks(c,d),spells=planSourceSpells(c,entries),limited=limitedSourceUseOffers(c),itemCharges=itemChargeOffers(c),itemAtWill=itemAtWillOffers(c,entries),chargedSpells=chargedItemSpellOffers(c,entries);
 return <section className="automation-panel"><fieldset disabled={!writable} style={{border:0,padding:0,margin:0,minWidth:0}}>
  <p>自动化支持装备、职业与特性选择、可适配的次数资源和休息恢复；未支持的规则会列出。</p>
  {supported?<><p>新建、导入和旧角色默认开启自动化。手写内容、修正和已消耗资源保留；可在此手动关闭。</p><label><input type="checkbox" aria-label="启用自动计算" checked={enabled} onChange={e=>edit(draft=>setAutomationEnabled(draft,e.target.checked))}/>启用自动计算</label></>:<p role="alert">这张卡使用尚未支持的自动化协议或规则版本。原始记录已保留，暂不执行或转换。</p>}
  <h3>护甲与盾牌</h3><p>当前 AC：<strong data-testid="automation-ac">{d.ac}</strong>。卸下后恢复适用方案，卡面调整值保留。</p>
  <ArmorAdjustmentReview c={c} edit={edit}/>
  {enabled&&c.selections.filter(row=>armorType(row.entry)).map(row=><label key={row.id} style={{display:'block'}}><input type="checkbox" aria-label={`装备 ${row.entry.name}`} checked={row.equipped} onChange={e=>edit(draft=>equipSelection(draft,row.id,e.target.checked))}/>{row.entry.name} · {row.entry.source}</label>)}
  <ul>{d.trace.ac?.map((line,i)=><li key={i}>{line}</li>)}</ul>
  {d.issues.filter(issue=>issue.id.startsWith('armor-')||issue.id.startsWith('feature-ac-rule:')||issue.id.startsWith('equipment-')||issue.id==='automation-protocol').map(issue=><p key={issue.id} role="alert">{issue.message}</p>)}
  <h3>当前自动抗性</h3><p data-testid="automation-resistances">{INFUSION_DAMAGE_TYPES.filter(type=>d.resistances?.includes(type)).join('、')||'无'}</p><p>仅列出当前可核对并生效的抗性；实际伤害结算与减免仍需手动处理，不会自动改写生命值。</p>
  <ul>{d.trace.resistances?.map((line,i)=><li key={i}>{line}</li>)}</ul>
  {d.issues.filter(issue=>issue.id.startsWith('item-resistance-bonus:')).map(issue=><p key={issue.id} role="alert">{issue.message}</p>)}
  <RacialDarkvisionSummary d={d}/>
  <RacialMovementSummary d={d}/>
  <h3>装备武器与快捷攻击</h3><p>装备后按属性、熟练和武器加值生成攻击。每件武器可选择命中与伤害所用属性，默认自动；武器额外加值保留。投掷、双手使用分别显示；不自动消耗弹药或判定战场条件，手工动作保留。</p>
  {enabled&&c.selections.filter(row=>weaponType(row.entry)).map(row=><div key={row.id} data-weapon-selection={row.id} style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><label><input type="checkbox" aria-label={`装备 ${row.entry.name}`} checked={row.equipped} onChange={e=>edit(draft=>equipSelection(draft,row.id,e.target.checked))}/>{row.entry.name} · {row.entry.source}</label>{row.entry.raw.attackBonus===undefined?<label>命中与伤害属性<select aria-label={`${row.entry.name}计算属性`} value={row.weaponAbility||''} onChange={e=>edit(draft=>{const stored=draft.selections.find(s=>s.id===row.id);if(!stored)return;if(e.target.value)stored.weaponAbility=e.target.value as Ability;else delete stored.weaponAbility;})}><option value="">自动（{ABILITY_LABELS[automaticWeaponAbility(row.entry,d)]}）</option>{ABILITIES.map(a=><option key={a} value={a}>{ABILITY_LABELS[a]}</option>)}</select></label>:<small>使用手写命中与伤害公式，计算属性不追加。</small>}</div>)}
  {weapons.attacks.map(attack=><details key={attack.key}><summary>{attack.name}：命中 {attack.attack_bonus}，伤害 {attack.damage}</summary><ul>{attack.trace.map((line,i)=><li key={i}>{line}</li>)}</ul></details>)}
  {weapons.issues.map(issue=><p key={issue.id} role="alert">{issue.message}</p>)}
  <h3>来源固定法术</h3><p>法术附属于赠送它的来源，不占普通预备名额。切换次数归属会保守保留消耗，可手动核对修正。切换方案、关闭来源与刷新不会恢复已用次数；未解析的条目仍需人工处理。</p>
  {itemAtWill.map(offer=><ItemAtWillSpellControl key={offer.key} c={c} ownerId={offer.ownerId} entries={entries} edit={edit} writable={writable}/>)}
  {chargedSpells.map(offer=><ChargedItemSpellControl key={offer.key} c={c} ownerId={offer.ownerId} entries={entries} edit={edit} writable={writable}/>)}
  {itemAtWillStateIssue(c)&&<p role="status">{itemAtWillStateIssue(c)}</p>}
  {limited.map(offer=><LimitedSourceUseControl key={offer.key} c={c} ownerId={offer.ownerId} poolId={offer.poolId} edit={edit} writable={writable}/>)}
  {c.runtime.limitedSourceUses&&(c.runtime.limitedSourceUses.version!==1||!limited.length)&&<p role="status">有限来源记录当前无法解析或版本尚未支持；原记录保留，不能重新初始化。</p>}
  {itemCharges.map(offer=><ItemChargeUseControl key={offer.key} c={c} ownerId={offer.ownerId} edit={edit} writable={writable}/>)}
  {itemChargeStateIssue(c)&&<p role="status">{itemChargeStateIssue(c)}</p>}
  {enabled&&spells.choices.filter(choice=>!choice.limitedUse&&!choice.itemChargeUse&&!choice.itemAtWill&&!choice.chargedItemSpell).map(choice=>choice.resourceColumns?<SourceResourceColumnControl key={choice.key} c={c} choice={choice} entries={entries} edit={edit} writable={writable}/>:choice.spells?<SourceSpellChoiceControl key={choice.key} c={c} choice={choice} entries={entries} edit={edit} writable={writable}/>:<label key={choice.key} style={{display:'block'}}>{choice.label}<select aria-label={choice.label} value={choice.usageModes?c.automation?.spellUsageModes?.[choice.key]??'':choice.sets?c.automation?.spellSets?.[choice.key]??'':c.automation?.spellAbilities?.[choice.key]??''} onChange={e=>edit(draft=>{if(!draft.automation)return;if(choice.usageModes){const values=draft.automation.spellUsageModes||={};if(!e.target.value)delete values[choice.key];else values[choice.key]=e.target.value as 'shared'|'each';}else if(choice.sets){const values=draft.automation.spellSets||={};if(e.target.value==='')delete values[choice.key];else values[choice.key]=Number(e.target.value);}else{const values=draft.automation.spellAbilities||={};if(!e.target.value)delete values[choice.key];else values[choice.key]=e.target.value as Ability;}})}><option value="">请选择</option>{choice.usageModes?<><option value="each">各法术各自拥有次数</option><option value="shared">这些法术共用次数</option></>:choice.sets?choice.sets.map((label,index)=><option key={index} value={index}>{label}</option>):choice.abilities?.map(a=><option key={a} value={a}>{ABILITY_LABELS[a]}</option>)}</select></label>)}
  {spells.issues.map(issue=><p key={issue.id} role="alert">{issue.message}</p>)}
 </fieldset></section>;
}
