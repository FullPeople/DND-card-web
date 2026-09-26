import {ABILITIES,type Entry,type Raw} from './model';
import {CUSTOM_TYPES,createCustomEntry} from './customEntries';
import {parseFile,validateEntryContent} from './validation';

const object=(v:unknown):v is Raw=>!!v&&typeof v==='object'&&!Array.isArray(v);
const nonnegative=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const examples:Record<string,Raw>={
 item:{weight:1,value:100},weapon:{weight:2,value:100,type:'M',weaponCategory:'simple',dmg1:'1d6',dmgType:'P'},armor:{weight:10,value:1000,type:'LA',ac:11},tool:{weight:1,value:100,type:'AT'},
 spell:{level:1,school:'A',time:[{number:1,unit:'action'}],range:{type:'point',distance:{type:'feet',amount:30}},components:{v:true,s:true},duration:[{type:'instant'}]},
 class:{hd:{number:1,faces:8},proficiency:['str','con'],startingProficiencies:{skills:[{choose:{from:['athletics','perception'],count:1}}]}},subclass:{className:'所属职业名称',classSource:'XPHB'},
 race:{size:['M'],speed:30},language:{type:'standard',script:'自定文字'},feat:{},background:{},feature:{},condition:{},weaponProperty:{},weaponMastery:{},rule:{}
};
export function customEntryExample(type:string){return {name:'自定义条目',type,edition:'both',entries:['填写完整内容。规则引用采用 {@spell 法术名称|XPHB} 或 {@item 物品名称|XPHB}。',{type:'entries',name:'子内容',entries:['填写子内容。']}],raw:structuredClone(examples[type]||{})};}
/** Strict authoring boundary; existing imported snapshots remain readable. */
export function validateCustomFields(type:string,raw:Raw,entries?:unknown[]){
 const require=(condition:unknown,message:string)=>{if(!condition)throw Error(message);};
 require(!!CUSTOM_TYPES[type]&&object(raw),'请选择有效类型并填写结构字段对象');
 if(entries)require(entries.length>0,'请填写正文或结构化子内容');
 if(CUSTOM_TYPES[type].kind==='item'){require(nonnegative(raw.weight),'请填写非负的物品重量（磅）');require(nonnegative(raw.value),'请填写非负的物品价格（铜币）');}
 if(type==='weapon'){require(['simple','martial'].includes(raw.weaponCategory),'请选择简易或军用武器');require(['M','R'].includes(raw.type),'请选择近战或远程武器');require(typeof raw.dmg1==='string'&&raw.dmg1.trim(),'请填写武器伤害骰');require(typeof raw.dmgType==='string'&&raw.dmgType.trim(),'请填写武器伤害类型');}
 if(type==='armor'){require(['LA','MA','HA','S'].includes(raw.type),'请选择护甲类别');require(nonnegative(raw.ac),'请填写护甲基础值');}
 if(type==='class'){require([4,6,8,10,12,20].includes(raw.hd?.faces),'请选择职业生命骰');require(Array.isArray(raw.proficiency)&&raw.proficiency.length>0&&raw.proficiency.every((a:any)=>ABILITIES.includes(a))&&new Set(raw.proficiency).size===raw.proficiency.length,'请选择职业豁免熟练项');}
 if(type==='subclass')require(typeof raw.className==='string'&&raw.className.trim()&&typeof raw.classSource==='string'&&raw.classSource.trim(),'请填写所属职业名称与来源标识');
 if(type==='race'){require(Array.isArray(raw.size)&&raw.size.length>0&&raw.size.every((s:any)=>['T','S','M','L','H','G'].includes(s)),'请选择种族体型');require(nonnegative(raw.speed)||object(raw.speed)&&nonnegative(raw.speed.walk),'请填写种族步行速度');}
 if(type==='spell'){require(Number.isInteger(raw.level)&&raw.level>=0&&raw.level<=9,'法术环阶必须为 0 至 9');require(['A','C','D','E','V','I','N','T'].includes(raw.school),'请选择法术学派');require(Array.isArray(raw.time)&&raw.time.length>0&&raw.time.every((t:any)=>object(t)&&nonnegative(t.number)&&t.number>0&&typeof t.unit==='string'&&t.unit),'请填写施法时间');require(object(raw.range)&&typeof raw.range.type==='string'&&raw.range.type,'请填写施法距离');require(object(raw.components),'请填写法术成分对象，无成分可填 {}');require(Array.isArray(raw.duration)&&raw.duration.length>0&&raw.duration.every((d:any)=>object(d)&&typeof d.type==='string'&&d.type),'请填写法术持续时间');}
 if(type==='language')require(typeof raw.type==='string'&&raw.type&&typeof raw.script==='string'&&raw.script,'请填写语言类别与文字');
}
export function parseCustomEntryJson(text:string,fallbackType='feature'):Entry{
 if(text.length>1_000_000)throw Error('自定义条目 JSON 超过 1 MB');
 const input=parseFile(text);if(!object(input))throw Error('自定义条目 JSON 必须是一个对象');
 if(object(input.raw)&&input.type!==undefined&&!CUSTOM_TYPES[input.type])throw Error(`不支持的自定义类型：${String(input.type)}`);
 const type=String(input.type&&CUSTOM_TYPES[input.type]?input.type:input.raw?._customType||fallbackType);
 const entries=input.entries;if(!Array.isArray(entries))throw Error('entries 必须是包含正文与子内容的数组');
 const raw=object(input.raw)?input.raw:Object.fromEntries(Object.entries(input).filter(([key])=>!['name','english','ENG_name','entries','id','kind','source','packId','revision','edition'].includes(key)));
 if(!object(input.raw)&&input.type===type)delete raw.type;
 validateEntryContent(entries);
 validateCustomFields(type,raw,entries);
 const entry=createCustomEntry({name:String(input.name||''),type,body:'',entries,raw,edition:['2014','2024','both'].includes(input.edition)?input.edition:'both'});
 if(typeof input.english==='string'||typeof input.ENG_name==='string')entry.english=input.english||input.ENG_name;
 return entry;
}
export function customCreationPrompt(type:string){return `请创作 DND Card Web 的「${CUSTOM_TYPES[type]?.label||type}」自定义条目。只输出一个合法 JSON 对象，不要代码围栏。保留 type、name、edition、entries、raw；edition 必须为 2014、2024 或 both。身份来源由编辑器管理，不伪装官方资料。\nentries 为字符串或 {"type":"entries","name":"子标题","entries":[...]} 数组，可嵌套子内容、list 和 table。可点击引用采用 {@spell 名称|来源}、{@item 名称|来源}、{@condition 名称|来源}、{@variantrule 名称|来源}；使用真实匹配的名称和来源，不编造现存条目。引用文字不会自动授予内容或执行规则。骰子使用 {@dice 1d6}，伤害用 {@damage 2d6}。不要 HTML、脚本或外部执行代码。\n物品 weight 单位为磅、value 单位为铜币（1 金币=100 铜币），允许明确填 0，不省略未知必填字段；职业填写 hd.faces 和 proficiency 数组（str/dex/con/int/wis/cha）；法术填写 level、school、time、range、components、duration；子职填写准确的 className/classSource。所有特殊效果应在正文完整说明，不声称系统已自动执行。\n按此结构替换示例内容：\n${JSON.stringify(customEntryExample(type),null,2)}`;}
