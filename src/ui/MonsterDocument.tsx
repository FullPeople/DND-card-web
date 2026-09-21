import { ABILITY_LABELS, type Ability, type Entry } from '../core/model';
import { Entries, Inline } from './Entries';
import { SourceName } from './SourceName';
import { speedText, translate } from './libraryData';

const signed=(n:number)=>`${n>=0?'+':''}${n}`;
const sizes:Record<string,string>={T:'微型',S:'小型',M:'中型',L:'大型',H:'巨型',G:'超巨型'};
const alignments:Record<string,string>={L:'守序',N:'中立',C:'混乱',G:'善良',E:'邪恶',U:'无阵营',A:'任意阵营'};
const skills:Record<string,string>={acrobatics:'特技','animal handling':'驯兽',arcana:'奥秘',athletics:'运动',deception:'欺瞒',history:'历史',insight:'洞悉',intimidation:'威吓',investigation:'调查',medicine:'医药',nature:'自然',perception:'察觉',performance:'表演',persuasion:'游说',religion:'宗教','sleight of hand':'巧手',stealth:'隐匿',survival:'生存'};
const xpByCR:Record<string,number>={'0':10,'1/8':25,'1/4':50,'1/2':100,...Object.fromEntries([200,450,700,1100,1800,2300,2900,3900,5000,5900,7200,8400,10000,11500,13000,15000,18000,20000,22000,25000,33000,41000,50000,62000,75000,90000,105000,120000,135000,155000].map((n,i)=>[String(i+1),n]))};
const list=(v:any)=>Array.isArray(v)?v:v==null?[]:[v];
const defense=(v:any,key:string):string=>Array.isArray(v)?v.map(x=>defense(x,key)).join('、'):typeof v==='string'?(key==='conditionImmune'?`{@condition ${v}}`:translate(v)):v?.special||`${v?.preNote||''}${defense(v?.[key]||[],key)}${v?.note||''}`;
function alignment(value:any):string{return list(value).map(v=>typeof v==='string'?alignments[v]||v:v.special||`${alignment(v.alignment)}${v.chance?`（${v.chance}%）`:''}`).join('');}
export function MonsterPortrait({entry}:{entry:Entry}){
 const url=entry.raw.tokenUrl || (entry.raw.hasToken?`https://5e.kiwee.top/img/bestiary/tokens/${entry.raw.source||entry.source}/${encodeURIComponent(entry.english)}.webp`:undefined);
 if(!url||!/^https?:\/\//i.test(url))return null;
 return <img key={url} className="monster-portrait" src={url} alt={entry.name} onError={e=>{e.currentTarget.style.display='none';}}/>;
}
export function MonsterDocument({entry,onLink}:{entry:Entry;onLink:(reference:string,kind?:string)=>void}){
 const r=entry.raw,cr=typeof r.cr==='object'?r.cr.cr:r.cr,pb=r.pbNote?undefined:Number(r.pb??Math.max(2,Math.ceil((Number(cr)||0)/4)+1));
 const mod=(a:Ability)=>Math.floor(((Number(r[a]??10))-10)/2);
 const initiative=typeof r.initiative==='number'?r.initiative:mod('dex')+(Number(r.initiative?.proficiency)||0)*(pb||0);
 const passiveInitiative=10+initiative+(r.initiative?.advantageMode==='adv'?5:r.initiative?.advantageMode==='dis'?-5:0);
 const type=typeof r.type==='string'?translate(r.type):`${translate(r.type?.type)}${r.type?.tags?.length?`（${r.type.tags.map((t:any)=>typeof t==='string'?t:`${t.prefix||''}${t.tag}`).join('、')}）`:''}`;
 const fields:[string,string][]=[];
 if(r.skill)fields.push(['技能',Object.entries(r.skill).map(([key,v])=>`${skills[key]||key} ${v}`).join('、')]);
 for(const [key,label] of [['vulnerable','易伤'],['resist','抗性'],['immune','免疫'],['conditionImmune','状态免疫']])if(r[key])fields.push([label,defense(r[key],key)]);
 fields.push(['感官',[...list(r.senses),...(r.passive!=null?[`被动察觉 ${r.passive}`]:[])].join('，')||'—']);
 fields.push(['语言',list(r.languages).join('、')||'—']);
 function block(value:any,index:number){
  if(typeof value!=='object'||!value||!value.name)return <Entries key={index} value={value} onLink={onLink}/>;
  const ordinary=value.entries||value.entry;
  if(!ordinary)return <Entries key={index} value={value} onLink={onLink}/>;
  const parts=list(ordinary),first=parts[0];
  return <section className="monster-trait" key={index}><p><strong><em><Inline text={String(value.name).replace(/[。.]$/,'')} onLink={onLink}/>{value.ENG_name&&value.ENG_name!==value.name&&<> <Inline text={String(value.ENG_name).replace(/[。.]$/,'')} onLink={onLink}/></>}。</em></strong>{typeof first==='string'&&<> <Inline text={first} onLink={onLink}/></>}</p><Entries value={typeof first==='string'?parts.slice(1):parts} onLink={onLink}/></section>;
 }
 const sections:[string,unknown][]=[['特质',r.trait],['施法',r.spellcasting],['动作',r.action],['附赠动作',r.bonus],['反应',r.reaction],['传奇动作',r.legendary],['神话动作',r.mythic],['变体',r.variant],['巢穴动作',r._legendaryGroup?.lairActions],['区域效应',r._legendaryGroup?.regionalEffects],['神话遭遇',r._legendaryGroup?.mythicEncounter]];
 return <div className="monster-document rules-prose document-prose">
 <p className="monster-classification"><em>{list(r.size).map(s=>sizes[s]||s).join(' / ')} {type}{r.alignment?.length?`，${alignment(r.alignment)}`:''}</em></p>
 <div className="monster-basics"><div><p><strong>AC</strong> {list(r.ac).map((a:any)=>typeof a==='number'?String(a):a.special||`${a.ac}${a.from?.length?`（${a.from.join('、')}）`:''}${a.condition||''}`).map((a:string,i:number)=><span key={i}>{i>0?' / ':''}<Inline text={a} onLink={onLink}/></span>)}</p><p><strong>HP</strong> {r.hp?.special||<>{r.hp?.average??'—'}{r.hp?.formula&&<>（<Inline text={r.hp.formula} onLink={onLink}/>）</>}</>}</p><p><strong>速度</strong> {speedText(r.speed)}</p></div><p className="monster-initiative"><strong>先攻</strong> {signed(initiative)}（{passiveInitiative}）</p></div>
 <div className="monster-abilities" aria-label="怪物属性与豁免">{([['str','int'],['dex','wis'],['con','cha']] as Ability[][]).map((group,i)=><div className="monster-ability-group" key={i}><div className="monster-ability-labels"><span/><span/><span>调整</span><span>豁免</span></div>{group.map(a=><div className="monster-ability-row" key={a}><strong>{ABILITY_LABELS[a]}</strong><span>{r[a]??'—'}</span><span>{r[a]==null?'—':signed(mod(a))}</span><span>{r.save?.[a]??(r[a]==null?'—':signed(mod(a)))}</span></div>)}</div>)}</div>
 <div className="monster-defenses">{fields.map(([label,value])=><p key={label}><strong>{label}</strong> <Inline text={value} onLink={onLink}/></p>)}{cr!=null&&<p><strong>CR</strong> {cr}（XP {(r.cr?.xp??xpByCR[String(cr)])?.toLocaleString()||'—'}{pb!=null?`; PB ${signed(pb)}`:r.pbNote?`; PB ${r.pbNote}`:''}）</p>}</div>
 {r.entries&&<Entries value={r.entries} onLink={onLink}/>}{sections.filter(([,values])=>list(values).length).map(([name,values])=><section className="monster-section" key={name}><h3>{name}</h3>{name==='传奇动作'&&r.legendaryHeader&&<Entries value={r.legendaryHeader} onLink={onLink}/>}<div>{list(values).map(block)}</div></section>)}
 <footer className="monster-footnotes">{r.environment?.length>0&&<p><strong>栖息地：</strong>{r.environment.map(translate).join('、')}</p>}{r.treasure?.length>0&&<p><strong>宝藏：</strong>{r.treasure.map(translate).join('、')}</p>}<p><strong>来源：</strong><SourceName id={entry.source}/>{entry.page?`，${entry.page}页`:''}</p></footer>
 </div>;
}
