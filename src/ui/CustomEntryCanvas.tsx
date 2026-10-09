import {FieldHelp} from './CustomFieldHelp';
import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ABILITIES,ABILITY_LABELS,type Entry,type Raw} from '../core/model';
import {CUSTOM_TYPES} from '../core/customEntries';
import {EntryFacts} from './EntryFacts';
import {MonsterDocument} from './MonsterDocument';
import {Entries} from './Entries';
import {monsterNumber,setMonsterNumber} from '../core/monsterEditing';
import './customCanvas.css';

const schools={A:'防护',C:'咒法',D:'预言',E:'惑控',V:'塑能',I:'幻术',N:'死灵',T:'变化'};
const sizes={T:'微型',S:'小型',M:'中型',L:'大型',H:'巨型',G:'超巨型'};
const damageTypes={B:'钝击',P:'穿刺',S:'挥砍',A:'强酸',C:'寒冷',F:'火焰',O:'力场',L:'闪电',N:'暗蚀',I:'毒素',Y:'心灵',R:'光耀',T:'雷鸣'};
const prose=(entries:unknown[])=>entries.map(v=>typeof v==='string'?v:JSON.stringify(v)).join('\n\n');
const parseProse=(text:string)=>text.split(/\n\s*\n/).filter(s=>s.trim()).map(s=>{try{const v=JSON.parse(s);return v&&typeof v==='object'?v:s;}catch{return s;}});
type Props={name:string;english:string;type:string;edition:Entry['edition'];body:string;entries:unknown[];raw:Raw;monsterCard?:boolean;disabled?:boolean;identity:(key:'name'|'english'|'type'|'edition',value:string)=>void;change:(raw:Raw)=>void;changeBody:(body:string)=>void;invalid:(message:string)=>void};

/** The ordinary rules document is the editing surface; only the selected area opens inputs. */
export function CustomEntryCanvas(p:Props){
 const [selected,setSelected]=useState<{key:string;label:string;anchor:HTMLElement;x:number;y:number}>(),[invalid,setInvalid]=useState(false);
 const editor=useRef<HTMLElement>(null),[position,setPosition]=useState<{left:number;top:number}>();
 const entry:Entry={id:'custom-preview',name:p.name||'自定义条目',english:p.english||p.name,kind:CUSTOM_TYPES[p.type].kind,source:p.monsterCard?p.raw.source||'CUSTOM':'CUSTOM',page:p.raw.page,packId:'custom',revision:'draft',edition:p.edition,entries:p.entries,raw:p.type==='monster'?{...p.raw,entries:undefined}:p.raw};
 function choose(key:string,label:string,anchor:HTMLElement,point?:{x:number;y:number}){if(invalid||p.disabled)return;const bounds=anchor.getBoundingClientRect();setPosition(undefined);setSelected({key,label,anchor,x:(point&&point.x!==0?point.x:bounds.left)-bounds.left,y:(point&&point.y!==0?point.y:Math.max(bounds.top,0))-bounds.top});}
 useLayoutEffect(()=>{
  if(!selected)return;
  const update=()=>{const popup=editor.current;if(!popup)return;const bounds=selected.anchor.getBoundingClientRect(),width=popup.offsetWidth,height=popup.offsetHeight,x=bounds.left+selected.x,y=bounds.top+selected.y;const left=Math.max(12,Math.min(x,innerWidth-width-12)),top=Math.max(12,Math.min(y+12+height<=innerHeight-12?y+12:y-height-12,innerHeight-height-12));setPosition(old=>old?.left===left&&old.top===top?old:{left,top});};
  update();const observer=new ResizeObserver(update);if(editor.current)observer.observe(editor.current);window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};
 },[selected]);
 function report(message:string){setInvalid(!!message);p.invalid(message);}
 function region(key:string,label:string,content:ReactNode){return <button type="button" key={key} className="canvas-region" aria-label={`修改${label}`} onClick={event=>choose(key,label,event.currentTarget,{x:event.clientX,y:event.clientY})}>{content}</button>;}
 const item=entry.kind==='item';
 return <div className="custom-canvas">
 <p className="canvas-hint">{p.monsterCard?'点击虚线框中的内容，在原位置附近修改；保存资料后生效。':'点击示例中的名称、资料或正文，在原位置附近修改；保存后才会加入自定义资料。'}</p>
 {selected&&createPortal(<section ref={editor} className="canvas-field-editor" role="region" aria-label={`编辑${selected.label}`} key={selected.key} style={{left:position?.left??0,top:position?.top??0,visibility:position?'visible':'hidden'}} onKeyDown={event=>{if(!invalid&&(event.key==='Escape'||event.key==='Enter'&&event.target instanceof HTMLInputElement)){event.preventDefault();selected.anchor.focus({preventScroll:true});setSelected(undefined);}}}><header><strong>{selected.label}</strong>{['time','range','components','duration'].includes(selected.key)&&<FieldHelp label={selected.label}/>}<button type="button" disabled={invalid} onClick={()=>{selected.anchor.focus({preventScroll:true});setSelected(undefined);}}>完成修改</button></header><fieldset disabled={p.disabled}><CanvasField {...p} field={selected.key} report={report}/></fieldset>{invalid&&<p role="alert">请先修正此区域的格式，再完成修改。</p>}</section>,document.body)}
  <article className="custom-document rules-prose document-prose">
 <div className="detail-heading">{!p.monsterCard&&<div className="canvas-edition">{region('type','类型',CUSTOM_TYPES[p.type].label)}{region('edition','适用版本',p.edition==='both'?'通用资料':p.edition)}</div>}<h1>{region('name','名称',entry.name)}</h1>{region('english','英文名',p.english||'点击填写英文名')}{!p.monsterCard&&<small>自定义资料 · 示例中的所有文字均可修改</small>}</div>
 {entry.kind==='monster'?<><MonsterDocument entry={entry} onLink={()=>{}} onEdit={choose}/><div className="canvas-extra-fields">{[['save','豁免'],['skill','技能'],['resist','伤害抗性'],['immune','伤害免疫'],['conditionImmune','状态免疫'],['trait','特质'],['action','动作'],['bonus','附赠动作'],['reaction','反应'],['legendary','传奇动作'],['mythic','神话动作'],['spellcasting','施法'],['cr','挑战等级']].filter(([key])=>p.raw[key]===undefined).map(([key,label])=>region(key,label,`＋ ${label}`))}</div></>:<>
 <EntryFacts entry={entry} onLink={()=>{}} onEdit={choose}/>
 {item&&<div className="canvas-item-facts">{region('value','价格（金币）',`价格：${Number(p.raw.value||0)/100} 金币`)}{region('weight','重量（磅）',`重量：${p.raw.weight??0} 磅`)}{p.type==='weapon'&&<>{region('weaponCategory','武器熟练类别',p.raw.weaponCategory==='martial'?'军用武器':'简易武器')}{region('typeRaw','武器类型',p.raw.type==='R'?'远程武器':'近战武器')}{region('dmgType','武器伤害类型',damageTypes[p.raw.dmgType as keyof typeof damageTypes]||'伤害类型')}</>}{['armor','tool'].includes(p.type)&&region('typeRaw',p.type==='armor'?'护甲类型':'工具类别',String(p.raw.type||'类别'))}</div>}
 {p.type==='subclass'&&<div className="canvas-item-facts">{region('className','所属职业名称',`所属职业：${p.raw.className}`)}{region('classSource','所属职业来源',`职业来源：${p.raw.classSource}`)}</div>}
 </>}
 <div className="canvas-region canvas-body" role="button" tabIndex={0} aria-label="修改正文" onClickCapture={event=>{event.preventDefault();event.stopPropagation();choose('body','正文',event.currentTarget,{x:event.clientX,y:event.clientY});}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose('body','正文',event.currentTarget);}}}><Entries value={p.entries} onLink={()=>{}}/>{!p.entries.length&&<p>点击填写完整正文。</p>}</div>
 </article></div>;
}

function CanvasField(p:Props&{field:string;report:(message:string)=>void}){
 const r=p.raw,k=p.field,update=(key:string,value:unknown)=>p.change({...r,[key]:value});
 const input=(label:string,value:any,change:(text:string)=>void,type='text',min?:number,max?:number)=><label>{label}<input autoFocus aria-label={label} type={type} min={min} max={max} step={type==='number'?'any':undefined} value={value??''} onChange={e=>change(e.target.value)}/></label>;
 const number=(key:string,label:string,min=0,max=999999)=>input(label,r[key],value=>update(key,value===''?undefined:Number(value)),'number',min,max);
 const select=(label:string,value:any,change:(value:string)=>void,options:Record<string,string>)=><label>{label}<select autoFocus aria-label={label} value={value??''} onChange={e=>change(e.target.value)}>{value!==undefined&&!Object.hasOwn(options,value)&&<option value={value}>{String(value)}</option>}{Object.entries(options).map(([v,label])=><option value={v} key={v}>{label}</option>)}</select></label>;
 const checks=(key:string,label:string,options:Record<string,string>)=><fieldset><legend>{label}</legend>{Object.entries(options).map(([value,label])=><label key={value}><input type="checkbox" aria-label={key==='proficiency'?`职业${label}豁免熟练`:label} checked={r[key]?.includes(value)||false} onChange={e=>update(key,e.target.checked?[...(r[key]||[]),value]:(r[key]||[]).filter((v:string)=>v!==value))}/>{label}</label>)}</fieldset>;
 const json=(key:string,label:string,example:unknown={})=><JsonRegion label={label} value={r[key]??example} change={value=>update(key,value)} report={p.report}/>;
 if(['name','english'].includes(k))return input(k==='name'?'自定义条目名称':'自定义条目英文名',p[k as 'name'|'english'],value=>p.identity(k as 'name'|'english',value));
 if(k==='type')return select('自定义条目类型',p.type,value=>p.identity('type',value),Object.fromEntries(Object.entries(CUSTOM_TYPES).map(([key,v])=>[key,v.label])));
 if(k==='edition')return select('自定义条目版本',p.edition,value=>p.identity('edition',value),{both:'通用',2014:'2014',2024:'2024'});
 if(k==='body')return <label>自定义条目正文<textarea autoFocus aria-label="自定义条目正文" value={p.body} onChange={e=>p.changeBody(e.target.value)} maxLength={100000}/><small>空行分段；已有的列表、表格和子标题保留原结构。</small></label>;
 if(k==='school')return <>{number('level','法术环阶',0,9)}{select('法术学派',r.school,v=>update('school',v),schools)}</>;
 if(k==='time'){
  const current=r.time?.[0];if(!current||typeof current!=='object')return json('time','施法时间',[{number:1,unit:'action'}]);
  const change=(value:Raw)=>update('time',[{...current,...value},...r.time.slice(1)]);
  return <>{input('施法时间数量',current.number,v=>change({number:Number(v)}),'number',1)}{select('施法时间单位',current.unit,v=>change({unit:v}),{action:'动作',bonus:'附赠动作',reaction:'反应',minute:'分钟',hour:'小时'})}{input('施法时间条件',current.condition||'',v=>change({condition:v}))}{r.time.length>1&&<p>另有 {r.time.length-1} 种时间，完整内容可在 JSON 输入中修改。</p>}</>;
 }
 if(k==='range'){
  const range=r.range||{type:'point',distance:{type:'feet',amount:30}},distance=range.distance||{},change=(value:Raw)=>update('range',{...range,...value});
  return <>{select('施法范围形状',range.type,v=>change({type:v}),{point:'点',cone:'锥状',line:'线状',sphere:'球状',cube:'立方',radius:'半径',hemisphere:'半球',cylinder:'柱状',special:'特殊'})}{select('施法距离类型',distance.type,v=>change({distance:{...distance,type:v}}),{feet:'尺',miles:'里',self:'自身',touch:'触及',sight:'视线',unlimited:'无限',special:'特殊'})}{['feet','miles'].includes(distance.type)&&input('施法距离数值',distance.amount,v=>change({distance:{...distance,amount:Number(v)}}),'number',0)}</>;
 }
 if(k==='components'){
  const c=r.components||{},change=(value:Raw)=>update('components',{...c,...value});
  return <><fieldset><legend>法术成分</legend>{[['v','言语 V'],['s','姿势 S'],['m','材料 M']].map(([key,label])=><label key={key}><input type="checkbox" aria-label={label} checked={!!c[key]} onChange={e=>{const next={...c};if(e.target.checked)next[key]=key==='m'?'填写材料':true;else delete next[key];update('components',next);}}/>{label}</label>)}</fieldset>{c.m&&input('材料说明',typeof c.m==='string'?c.m:c.m.text,v=>change({m:typeof c.m==='object'?{...c.m,text:v}:v}))}</>;
 }
 if(k==='duration'){
  const current=r.duration?.[0]||{type:'instant'},change=(value:Raw)=>update('duration',[{...current,...value},...(r.duration?.slice(1)||[])]);
  return <>{select('持续时间类型',current.type,v=>change({type:v,...(v==='timed'&&!current.duration?{duration:{type:'minute',amount:1}}:{})}),{instant:'立即',timed:'计时',permanent:'直至解除',special:'特殊'})}{current.type==='timed'&&<>{input('持续时间数量',current.duration?.amount,v=>change({duration:{...current.duration,amount:Number(v)}}),'number',0)}{select('持续时间单位',current.duration?.type,v=>change({duration:{...current.duration,type:v}}),{round:'轮',minute:'分钟',hour:'小时',day:'天'})}</>}<label><input type="checkbox" aria-label="需要专注" checked={!!current.concentration} onChange={e=>change({concentration:e.target.checked})}/>需要专注</label></>;
 }
 if(k==='classification')return <>{select('怪物体型',Array.isArray(r.size)?r.size[0]:r.size,v=>update('size',[v,...(Array.isArray(r.size)?r.size.slice(1):[])]),sizes)}{select('怪物类型',typeof r.type==='string'?r.type:r.type?.type,v=>update('type',typeof r.type==='object'?{...r.type,type:v}:v),{aberration:'异怪',beast:'野兽',celestial:'天界生物',construct:'构装体',dragon:'龙',elemental:'元素',fey:'妖精',fiend:'邪魔',giant:'巨人',humanoid:'类人生物',monstrosity:'怪兽',ooze:'泥怪',plant:'植物',undead:'亡灵'})}{checks('alignment','阵营',{L:'守序',N:'中立',C:'混乱',G:'善良',E:'邪恶',U:'无阵营',A:'任意阵营'})}</>;
 if(k==='hp')return <>{input('怪物平均 HP',monsterNumber(r,'hp'),v=>p.change(setMonsterNumber(r,'hp',Number(v))),'number',0)}{input('怪物生命骰',r.hp?.formula,v=>update('hp',{...r.hp,formula:v}))}{r.hp?.special&&input('特殊 HP',r.hp.special,v=>update('hp',{...r.hp,special:v}))}</>;
 if(k==='ac'&&p.type==='monster')return input('怪物 AC',monsterNumber(r,'ac'),v=>p.change(setMonsterNumber(r,'ac',Number(v))),'number',0);
 if(ABILITIES.includes(k as any))return <>{number(k,`怪物${ABILITY_LABELS[k as keyof typeof ABILITY_LABELS]}属性`,1,30)}{input('该属性豁免加值',r.save?.[k]??'',v=>{const save={...r.save};if(v.trim())save[k]=v;else delete save[k];update('save',save);})}</>;
 if(k==='speed')return typeof r.speed==='number'?input('步行速度',r.speed,v=>update('speed',Number(v)),'number',0):<>{Object.entries({walk:'步行',fly:'飞行',swim:'游泳',climb:'攀爬',burrow:'掘穴'}).map(([key,label])=>input(`${label}速度`,typeof r.speed?.[key]==='object'?r.speed[key].number:r.speed?.[key]??'',v=>{const next={...r.speed};if(v.trim())next[key]=typeof next[key]==='object'?{...next[key],number:Number(v)}:Number(v);else delete next[key];update('speed',next);},'number',0))}</>;
 if(/^(trait|action|bonus|reaction|legendary|mythic|variant)(\.\d+)?$/.test(k)){const [key,index]=k.split('.');return <TraitRegion value={r[key]||[]} initialIndex={Number(index)||0} change={v=>update(key,v)} report={p.report}/>;}
 if(k==='spellcasting')return <TraitRegion value={r[k]||[]} change={v=>update(k,v)} report={p.report} spellcasting/>;
 if(k==='senses')return <><TextListRegion value={r.senses||[]} change={v=>update('senses',v)} report={p.report}/>{number('passive','被动察觉',0)}</>;
 if(k==='environment'||k==='treasure')return <TextListRegion value={r[k]||[]} change={v=>update(k,v)} report={p.report}/>;
 if(['pb','passive','page','legendaryActions'].includes(k))return number(k,({pb:'熟练加值',passive:'被动察觉',page:'来源页码',legendaryActions:'传奇动作次数'})[k]!);
 if(k==='source')return input('来源',r.source,v=>update(k,v));
 if(['senses','languages','conditionImmune','resist','immune','vulnerable','typicalSpeakers'].includes(k))return <TextListRegion value={r[k]||[]} change={v=>update(k,v)} report={p.report}/>;
 if(k==='hd')return select('职业生命骰',r.hd?.faces,v=>update('hd',{...r.hd,number:r.hd?.number||1,faces:Number(v)}),Object.fromEntries([4,6,8,10,12,20].map(n=>[n,`d${n}`])));
 if(k==='proficiency')return checks('proficiency','职业豁免熟练',ABILITY_LABELS);
 if(k==='size')return select('种族体型',Array.isArray(r.size)?r.size[0]:r.size,v=>update('size',[v,...(Array.isArray(r.size)?r.size.slice(1):[])]),sizes);
 if(k==='value')return input('物品价格（金币）',typeof r.value==='number'?r.value/100:'',v=>update('value',Number(v)*100),'number',0);
 if(k==='weight')return number('weight','物品重量（磅）');
 if(k==='typeRaw')return select(p.type==='weapon'?'武器类型':p.type==='armor'?'护甲类型':'工具类别',r.type,v=>update('type',v),p.type==='weapon'?{M:'近战',R:'远程'}:p.type==='armor'?{LA:'轻甲',MA:'中甲',HA:'重甲',S:'盾牌'}:{AT:'工匠工具',T:'工具',INS:'乐器',GS:'游戏工具'});
 if(k==='weaponCategory')return select('武器熟练类别',r.weaponCategory,v=>update(k,v),{simple:'简易武器',martial:'军用武器'});
 if(k==='dmgType')return select('武器伤害类型',r.dmgType,v=>update(k,v),damageTypes);
 if(['dmg1','className','classSource','script','cr'].includes(k))return input(({dmg1:'武器伤害骰',className:'所属职业名称',classSource:'所属职业来源',script:'语言文字',cr:'怪物挑战等级'})[k]!,typeof r[k]==='object'?r[k]?.cr:r[k],v=>update(k,typeof r[k]==='object'?{...r[k],cr:v}:v));
 if(k==='typeRawLanguage')return select('语言类别',r.type,v=>update('type',v),{standard:'标准',exotic:'异种',secret:'秘密'});
 if(['ac','level'].includes(k)||k==='initiative'&&typeof r.initiative!=='object')return number(k,k==='ac'?'护甲基础值':k==='level'?'获得等级':'先攻',k==='initiative'?-100:0);
 return json(k,'完整区域结构',k==='save'||k==='skill'?{}:[]);
}

function JsonRegion({label,value,change,report}:{label:string;value:unknown;change:(v:any)=>void;report:(message:string)=>void}){
 const [text,setText]=useState(()=>JSON.stringify(value,null,2));
 return <label>{label}<textarea autoFocus aria-label={label} value={text} onChange={e=>{setText(e.target.value);try{const v=JSON.parse(e.target.value);change(v);report('');}catch(error){report(error instanceof SyntaxError?'此区域的 JSON 尚未完整，请修正后完成修改。':error instanceof Error?error.message:String(error));}}}/></label>;
}
function TextListRegion({value,change,report}:{value:unknown[];change:(v:unknown[])=>void;report:(message:string)=>void}){
 if(value.some(v=>typeof v!=='string'))return <JsonRegion label="完整列表结构" value={value} change={change} report={report}/>;
 return <label>每行一项<textarea autoFocus aria-label="每行一项" value={value.join('\n')} onChange={e=>change(e.target.value.split('\n').filter(v=>v.trim()))}/></label>;
}
function TraitRegion({value,change,report,initialIndex=0,spellcasting=false}:{value:any[];change:(v:any[])=>void;report:(message:string)=>void;initialIndex?:number;spellcasting?:boolean}){
 const [index,setIndex]=useState(initialIndex),current=value[index];
 if(current&&typeof current!=='object')return <JsonRegion label="完整特质或动作结构" value={value} change={change} report={report}/>;
 const update=(next:Raw)=>change(value.map((v,i)=>i===index?{...v,...next}:v));
 const proseKey=spellcasting?'headerEntries':'entries';
 return <><nav aria-label="子条目选择">{value.map((v,i)=><button type="button" key={i} aria-pressed={i===index} onClick={()=>setIndex(i)}>{v.name||`第 ${i+1} 项`}</button>)}<button type="button" onClick={()=>{setIndex(value.length);change([...value,{name:'新条目',[proseKey]:['填写完整内容。']}]);}}>＋ 添加</button></nav>{current&&<><label>子条目名称<input autoFocus aria-label="子条目名称" value={current.name||''} onChange={e=>update({name:e.target.value})}/></label><label>子条目正文<textarea aria-label="子条目正文" value={prose(current[proseKey]||(current.entry?[current.entry]:[]))} onChange={e=>{const next={...current,[proseKey]:parseProse(e.target.value)};delete next.entry;change(value.map((v,i)=>i===index?next:v));}}/></label>{spellcasting&&<JsonRegion label="法术频率与列表" value={Object.fromEntries(Object.entries(current).filter(([key])=>key!=='name'&&key!==proseKey))} change={v=>{if(v&&typeof v==='object'&&!Array.isArray(v))change(value.map((row,i)=>i===index?{name:current.name,[proseKey]:current[proseKey],...v}:row));else throw Error('法术频率与列表必须是对象。');}} report={report}/>}<button type="button" onClick={()=>{change(value.filter((_,i)=>i!==index));setIndex(Math.max(0,index-1));}}>删除此子条目</button></>}</>;
}
