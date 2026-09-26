import {useMemo,useState} from 'react';
import {characterReview} from '../core/characterReview';
import {plainText} from '../core/export';
import {ABILITIES,ABILITY_LABELS,KIND_LABELS,SKILLS,signed,type Character,type Entry} from '../core/model';
import {choiceLabel} from '../core/engine';
import {useSources} from './SourceName';
import './characterReview.css';

const sections=['概况与风险','属性与熟练','法术与资源','装备与负重','条目与来源','裁定与依据'] as const;
const labels:Record<string,string>={ac:'护甲',hp:'生命上限',speed:'速度',initiative:'先攻',passive:'被动察觉',proficiency:'熟练加值',armor:'护甲',weapons:'武器',tools:'工具',languages:'语言'};
export function CharacterReview({c,inspect,exportHtml,ruleContext}:{c:Character;inspect?:(entry:Entry)=>void;exportHtml?:()=>void;ruleContext?:Pick<Character,'edition'|'profile'|'rulePacks'>}){
 const review=useMemo(()=>characterReview(ruleContext?{...c,...ruleContext}:c),[c,ruleContext]),{d,restricted,recordedLevel,manual,spells,stats,weight}=review,{format}=useSources();
 const [section,setSection]=useState<(typeof sections)[number]>('概况与风险'),[query,setQuery]=useState(''),[filter,setFilter]=useState('all');
 const spellRows=c.selections.filter(s=>s.entry.kind==='spell'),items=c.selections.filter(s=>s.entry.kind==='item');
 const entries=c.selections.filter(s=>(filter==='all'||filter==='restricted'&&!review.allowed(s)||s.entry.kind===filter)&&`${s.entry.name} ${s.entry.english} ${format(s.entry.source)} ${plainText(s.entry.entries)}`.toLowerCase().includes(query.trim().toLowerCase()));
 const fact=(label:string,value:string|number)=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>;
 const name=(entry:Entry)=>inspect?<button type="button" className="review-entry-link" onClick={()=>inspect(entry)}>{entry.name}</button>:entry.name;
 return <section className="character-review" aria-label="DM 审卡工作区">
  <header><div><h3>{c.name}</h3><p>{c.player||'未填写玩家'} · {c.edition} · 修订 {c.revision}</p></div>{exportHtml&&<button onClick={exportHtml}>导出离线审卡</button>}</header>
  {ruleContext&&<p className="review-note">按房间 {ruleContext.edition} 规则与来源核对；原卡 {c.edition} 身份和独立配置保留。{ruleContext.edition!==c.edition?'版本不同，请重点核对受限条目与等级。':''}</p>}
  <nav aria-label="审卡分类">{sections.map(label=><button key={label} type="button" aria-pressed={section===label} onClick={()=>setSection(label)}>{label}</button>)}</nav>
  {section==='概况与风险'&&<>
   <dl className="review-facts">{fact('记录等级',recordedLevel)}{fact('生效等级',d.level)}{fact('生命',`${c.runtime.hp} / ${d.maxHp}`)}{fact('临时生命',c.runtime.tempHp)}{fact('护甲',d.ac)}{fact('先攻',signed(d.initiative))}{fact('速度',`${d.speed} 尺`)}{fact('被动察觉',d.passive)}{fact('熟练加值',signed(d.proficiency))}{fact('生命骰',d.hitDice||'—')}</dl>
   <h4>角色身份</h4><p>{review.classes.map(s=>`${s.entry.name} ${s.level} 级`).join(' / ')||'未填写职业'}</p><p>{c.selections.filter(s=>['race','background','subclass'].includes(s.entry.kind)).map(s=>`${KIND_LABELS[s.entry.kind]}：${s.entry.name}`).join(' · ')||'未填写种族、背景或子职'}</p>
   <h4>需要核对</h4><ul className="review-findings">{recordedLevel!==d.level&&<li>记录等级 {recordedLevel} 与当前规则下生效等级 {d.level} 不一致，请核对职业来源与版本。</li>}{restricted.length>0&&<li><button onClick={()=>{setSection('条目与来源');setFilter('restricted');}}>查看 {restricted.length} 项受限条目</button>：记录保留，当前效果暂停。</li>}{review.unlinked.length>0&&<li>{review.unlinked.length} 项来自旧格式导入，尚未关联 Wiki 来源。</li>}{d.issues.map(issue=><li key={issue.id}>{issue.message}</li>)}{manual.length>0&&<li><button onClick={()=>setSection('裁定与依据')}>核对 {manual.length} 项人工数值修正</button></li>}{!restricted.length&&!review.unlinked.length&&!d.issues.length&&!manual.length&&<li>未发现来源受限或数值修正。</li>}</ul><p className="review-note">此卡为手动记录。技能、选择数量与复杂特性的合法性由 DM 结合规则核对。</p>
  </>}
  {section==='属性与熟练'&&<>
   <div className="review-table-wrap"><table><thead><tr><th>属性</th><th>基础</th><th>最终</th><th>调整</th><th>豁免</th></tr></thead><tbody>{ABILITIES.map(a=><tr key={a}><th>{ABILITY_LABELS[a]}</th><td>{c.abilities[a]}</td><td>{d.abilities[a]}</td><td>{signed(d.modifiers[a])}</td><td>{signed(d.saves[a].value)} {d.saves[a].proficient?'熟练':''}</td></tr>)}</tbody></table></div>
   <h4>技能</h4><table><thead><tr><th>技能</th><th>检定</th><th>训练</th><th>依据</th></tr></thead><tbody>{Object.entries(SKILLS).map(([key,skill])=><tr key={key}><th>{skill.name}</th><td>{signed(d.skills[key].value)}</td><td>{d.skills[key].expertise?'专精':d.skills[key].proficient?'熟练':'无'}</td><td>{d.skills[key].sources.join('；')||'—'}</td></tr>)}</tbody></table>
   <h4>装备与语言训练</h4><dl className="review-training">{Object.entries(c.training||{}).map(([key,value])=><div key={key}><dt>{labels[key]||key}</dt><dd>{value||'—'}</dd></div>)}</dl>
  </>}
  {section==='法术与资源'&&<>
   <dl className="review-facts">{fact('施法属性',ABILITY_LABELS[spells.ability])}{fact('法术攻击',signed(stats.attack))}{fact('豁免 DC',stats.dc)}{fact('施法制度',spells.mode==='prepared'?'预备法术':'已知法术')}{fact('预备容量',spells.capacity)}{fact('法术数',spellRows.length)}</dl>
   <table><thead><tr><th>法术</th><th>环阶</th><th>记录</th><th>来源</th></tr></thead><tbody>{[...spellRows].sort((a,b)=>Number(a.entry.raw.level||0)-Number(b.entry.raw.level||0)).map(s=><tr key={s.id} className={!review.allowed(s)?'review-restricted':''}><th>{name(s.entry)}</th><td>{Number(s.entry.raw.level||0)||'戏法'}</td><td>{!review.allowed(s)?'受限':spells.special?.[s.id]?.mode==='locked'?'固定法术':spells.special?.[s.id]?.mode==='uses'?`次数法术 · ${c.runtime.resources[`innate-spell:${s.id}`]?.current??0}/${spells.special[s.id].max||1}`:spells.prepared.includes(s.id)?'已预备':Number(s.entry.raw.level)===0?'戏法':spells.mode==='known'?'已知':'法术库'}</td><td>{format(s.entry.source)}</td></tr>)}</tbody></table>
   <h4>法术位与资源</h4><table><thead><tr><th>资源</th><th>剩余</th><th>上限</th></tr></thead><tbody>{Object.entries(spells.slots).filter(([,v])=>v.max>0).map(([level,v])=><tr key={`slot:${level}`}><th>{level} 环法术位</th><td>{v.max-v.used}</td><td>{v.max}</td></tr>)}{Object.entries(c.runtime.resources).map(([id,v])=><tr key={id}><th>{v.name||id}</th><td>{v.unlimited?'不限':v.current}</td><td>{v.unlimited?'不限':v.max}</td></tr>)}</tbody></table>
  </>}
  {section==='装备与负重'&&<>
   <dl className="review-facts">{fact('物品重量',`${weight.items} 磅`)}{fact('钱币重量',`${weight.coins} 磅`)}{fact('物品种类',items.length)}{fact('已同调',items.filter(s=>s.attuned).length)}</dl><p className="review-note">未填写重量的物品在表中明确标为未知，须另行核对。</p>
   <table><thead><tr><th>物品</th><th>数量</th><th>单件重量</th><th>装备 / 同调</th><th>来源</th></tr></thead><tbody>{items.map(s=><tr key={s.id}><th>{name(s.entry)}</th><td>{s.quantity}</td><td>{typeof s.entry.raw.weight==='number'?`${s.entry.raw.weight} 磅`:'未知'}</td><td>{[s.equipped?'已装备':'',s.attuned?'已同调':''].filter(Boolean).join(' / ')||'—'}</td><td>{format(s.entry.source)}</td></tr>)}</tbody></table>
  </>}
  {section==='条目与来源'&&<>
   <div className="review-filter"><input aria-label="审卡搜索条目" value={query} onChange={event=>setQuery(event.target.value)} placeholder="名称、来源或正文"/><select aria-label="审卡条目筛选" value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">全部条目</option><option value="restricted">受限条目</option>{Object.entries(KIND_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><span>{entries.length} 项</span></div>
   {entries.map(s=><details key={s.id} className={`review-selection ${review.allowed(s)?'':'review-restricted'}`}><summary><strong>{s.entry.name}</strong><span>{KIND_LABELS[s.entry.kind]} · {format(s.entry.source)} · {s.entry.edition}{!review.allowed(s)?' · 受限':''}{c.reviewed.includes(s.id)?' · 已人工核对':''}</span></summary><p>{s.parentId?`来自 ${c.selections.find(p=>p.id===s.parentId)?.entry.name||'已移除条目'} · `:''}资料修订 {s.entry.revision}{s.entry.page?` · 第 ${s.entry.page} 页`:''}</p><pre>{plainText(s.entry.entries)}</pre>{inspect&&<button onClick={()=>inspect(s.entry)}>在 Wiki 中查看</button>}</details>)}
   <h4>本卡引用来源</h4><table><thead><tr><th>来源</th><th>条目</th><th>受限</th></tr></thead><tbody>{review.sourceRows.map(row=><tr key={row.source}><th>{format(row.source)}</th><td>{row.total}</td><td>{row.restricted}</td></tr>)}</tbody></table>
  </>}
  {section==='裁定与依据'&&<>
   <h4>人工数值修正</h4><table><thead><tr><th>数值</th><th>修正</th><th>原因</th></tr></thead><tbody>{manual.map(row=><tr key={row.key}><th>{labels[row.target]||choiceLabel(row.target)}</th><td>{row.absolute?`最终值 ${row.value}`:signed(row.value)}</td><td>{row.reason}</td></tr>)}</tbody></table>
   <h4>DM 特许</h4>{Object.entries(c.profile.exceptions).map(([id,reason])=><p key={id}><strong>{c.selections.find(s=>s.entry.id===id)?.entry.name||id}</strong>：{reason}</p>)}
   <h4>计算依据</h4>{Object.entries(d.trace).map(([key,rows])=><details key={key}><summary>{labels[key]||choiceLabel(key)}</summary><ul>{rows.map((text,i)=><li key={i}>{text}</li>)}</ul></details>)}
   <h4>人物记录</h4><pre>{[c.identity.description,c.biography?.story??c.notes].filter(Boolean).join('\n\n')||'无'}</pre>
  </>}
 </section>;
}
