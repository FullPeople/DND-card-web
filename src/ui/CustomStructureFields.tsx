import {ABILITIES,ABILITY_LABELS,type Raw} from '../core/model';

/** Common authored fields, shared by Wiki and card-local entry forms. */
export function CustomStructureFields({type,raw,change}:{type:string;raw:Raw|undefined;change:(raw:Raw)=>void}){
 if(!raw)return <p role="status">结构字段不是有效 JSON，请先修正。</p>;
 const update=(key:string,value:unknown)=>change({...raw,[key]:value});
 const text=(key:string,label:string)=> <label>{label}<input aria-label={label} required value={raw[key]??''} onChange={e=>update(key,e.target.value)}/></label>;
 const number=(key:string,label:string,max=9999)=> <label>{label}<input aria-label={label} type="number" required min="0" max={max} value={raw[key]??''} onChange={e=>update(key,e.target.value===''?undefined:Number(e.target.value))}/></label>;
 const select=(key:string,label:string,options:Record<string,string>)=><label>{label}<select required aria-label={label} value={raw[key]??''} onChange={e=>update(key,e.target.value)}><option value="">请选择</option>{Object.entries(options).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>;
 return <div className="custom-fields custom-required-fields">
 {type==='class'&&<><label>职业生命骰<select required aria-label="职业生命骰" value={raw.hd?.faces||''} onChange={e=>update('hd',{number:1,faces:Number(e.target.value)})}><option value="">请选择</option>{[4,6,8,10,12,20].map(faces=><option key={faces} value={faces}>d{faces}</option>)}</select></label><fieldset><legend>职业豁免熟练（必填）</legend>{ABILITIES.map(a=><label key={a}><input type="checkbox" aria-label={`职业${ABILITY_LABELS[a]}豁免熟练`} checked={raw.proficiency?.includes(a)||false} onChange={e=>update('proficiency',e.target.checked?[...(raw.proficiency||[]),a]:(raw.proficiency||[]).filter((value:string)=>value!==a))}/>{ABILITY_LABELS[a]}</label>)}</fieldset></>}
 {type==='spell'&&<>{number('level','法术环阶',9)}{select('school','法术学派',{A:'防护',C:'咒法',D:'预言',E:'惑控',V:'塑能',I:'幻术',N:'死灵',T:'变化'})}{(['time','range','components','duration'] as const).map(key=><label key={key}>{({time:'施法时间',range:'施法距离',components:'法术成分',duration:'持续时间'})[key]}（JSON）<input aria-label={`法术${key}结构`} required value={typeof raw[key]==='string'?raw[key]:JSON.stringify(raw[key])||''} onChange={e=>{try{update(key,JSON.parse(e.target.value));}catch{update(key,e.target.value);}}}/></label>)}</>}
 {type==='weapon'&&<>{select('weaponCategory','武器熟练类别',{simple:'简易武器',martial:'军用武器'})}{select('type','武器类型',{M:'近战',R:'远程'})}{text('dmg1','武器伤害骰')}{select('dmgType','武器伤害类型',{B:'钝击',P:'穿刺',S:'挥砍',A:'强酸',C:'寒冷',F:'火焰',O:'力场',L:'闪电',N:'暗蚀',I:'毒素',Y:'心灵',R:'光耀',T:'雷鸣'})}</>}
 {type==='armor'&&<>{select('type','护甲类型',{LA:'轻甲',MA:'中甲',HA:'重甲',S:'盾牌'})}{number('ac','护甲基础值')}</>}
 {type==='tool'&&select('type','工具类别',{AT:'工匠工具',T:'工具',INS:'乐器',GS:'游戏工具'})}
 {type==='subclass'&&<>{text('className','所属职业名称')}{text('classSource','所属职业来源')}</>}
 {type==='race'&&<><label>种族体型<select required aria-label="种族体型" value={raw.size?.[0]||''} onChange={e=>update('size',[e.target.value])}><option value="">请选择</option>{Object.entries({T:'微型',S:'小型',M:'中型',L:'大型',H:'巨型',G:'超巨型'}).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>步行速度<input aria-label="种族步行速度" required type="number" min="0" value={typeof raw.speed==='number'?raw.speed:raw.speed?.walk??''} onChange={e=>update('speed',typeof raw.speed==='object'?{...raw.speed,walk:Number(e.target.value)}:Number(e.target.value))}/></label></>}
 {type==='language'&&<>{select('type','语言类别',{standard:'标准',exotic:'异种',secret:'秘密'})}{text('script','语言文字')}</>}
 </div>;
}
