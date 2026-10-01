import {useId,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {CUSTOM_TYPES} from '../core/customEntries';
import './customFieldHelp.css';

export const AUTHORING_GUIDE=['如果要做出完美的甚至有实际效果的东西，让 AI 代劳是必不可少的。你有两种创作方式：','① 复制创作提示词并打开 AI，把提示词和你想做的东西发给他。他会返回可以直接导入的 JSON，复制粘贴过来即可。','② 自行创作：点击下面的「填充格式示例」，然后自行修改。','③ 如果需要大量导入，不妨前往「规则与扩展」，在那里进行整体扩展包的导入。'];
export const AUTHORING_ADVICE='手写严谨的JSON文件是一个复杂的过程。强烈建议复制创作提示词让AI帮你创作合适的格式文本。';
export const FIELD_EXAMPLES:Record<string,string[]>={
 名称:['星火护符','霜光术'],类型:['物品：通用道具','法术：有环阶、学派与施法信息'],英文名:['Frostlight','Starfire Charm'],适用版本:['2014：仅用于 2014 规则','2024：仅用于 2024 规则','通用：两个版本均可使用'],
 '价格（金币）':['1 = 1 金币','0.5 = 5 银币','0 = 没有价格'], '重量（磅）':['2 = 2 磅','0.5 = 半磅','0 = 不计重量'],
 正文:['直接填写规则说明，段落之间留空行。','引用：{@spell 火球术|PHB}；骰子：{@dice 1d6}。','子内容：{"type":"entries","name":"使用方式","entries":["填写规则说明。"]}'],
 结构字段:['填写 JSON 对象，例如物品：{"weight":1,"value":100}。','法术：{"level":1,"school":"A","time":[{"number":1,"unit":"action"}],"range":{"type":"point","distance":{"type":"self"}},"components":{"v":true},"duration":[{"type":"instant"}]}'],
 '完整 JSON':['使用右侧“查看参考格式”查各字段，再用“填充格式示例”取得完整模板。','两种输入方式会自动同步；点击保存后才加入自定义资料。'],
 职业生命骰:['d6：每级一枚六面骰','d10：每级一枚十面骰'], '职业豁免熟练（必填）':['例如：力量、体质','例如：智力、感知；勾选实际授予的熟练项'],
 法术环阶:['0：戏法','1：一环法术','9：九环法术'],法术学派:['防护（A）','塑能（V）','变化（T）'],
 施法时间:['1 动作：[{"number":1,"unit":"action"}]','1 附赠动作：[{"number":1,"unit":"bonus"}]','1 反应：[{"number":1,"unit":"reaction","condition":"受到伤害时"}]','1 分钟：[{"number":1,"unit":"minute"}]'],
 施法距离:['自身：{"type":"point","distance":{"type":"self"}}','接触：{"type":"point","distance":{"type":"touch"}}','60 尺：{"type":"point","distance":{"type":"feet","amount":60}}','15 尺锥形：{"type":"cone","distance":{"type":"feet","amount":15}}'],
 法术成分:['言语和姿势：{"v":true,"s":true}','材料：{"v":true,"s":true,"m":"一根羽毛"}','有价且消耗的材料：{"m":{"text":"价值 50 金币的宝石","cost":5000,"consume":true}}','无成分：{}'],
 持续时间:['立即：[{"type":"instant"}]','1 小时：[{"type":"timed","duration":{"type":"hour","amount":1}}]','专注 1 分钟：[{"type":"timed","duration":{"type":"minute","amount":1},"concentration":true}]','直到被解除：[{"type":"permanent","ends":["dispel"]}]'],
 武器熟练类别:['简易武器','军用武器'],武器类型:['近战','远程'],武器伤害骰:['1d6','2d6','1d8'],武器伤害类型:['穿刺','挥砍','钝击'],护甲类型:['轻甲','中甲','重甲','盾牌'],护甲基础值:['11：基础 AC 11','16：基础 AC 16；额外规则请写在正文'],工具类别:['工匠工具','工具','乐器','游戏工具'],所属职业名称:['填写目录中职业的准确名称，例如法师','也可填写自定义主职的名称'],所属职业来源:['PHB：2014 玩家手册','XPHB：2024 玩家手册','自定义职业：使用该职业真实的来源标识'],种族体型:['小型（S）','中型（M）'],步行速度:['30：30 尺','25：25 尺'],语言类别:['标准','异种','秘密'],语言文字:['通用文字','精灵文字','无文字'],
};

export function FieldHelp({label,examples=FIELD_EXAMPLES[label]||[],trigger}: {label:string;examples?:string[];trigger?:string}){
 const id=useId(),popover=useRef<HTMLDivElement>(null);
 const show=(button:HTMLButtonElement)=>{const node=popover.current;if(!node)return;node.showPopover();const b=button.getBoundingClientRect(),width=Math.min(430,innerWidth-24);node.style.width=`${width}px`;node.style.left=`${Math.max(12,Math.min(b.right-width,innerWidth-width-12))}px`;node.style.top=`${Math.max(8,Math.min(b.bottom+8,innerHeight-node.offsetHeight-8))}px`;};
 return <span className="custom-help"><button type="button" className={trigger?'custom-help-guide':'custom-help-icon'} aria-label={`${label}填写帮助`} aria-describedby={id} onMouseEnter={e=>show(e.currentTarget)} onMouseLeave={()=>popover.current?.hidePopover()} onFocus={e=>show(e.currentTarget)} onBlur={()=>popover.current?.hidePopover()} onClick={e=>show(e.currentTarget)}>{trigger||'?'}</button><div ref={popover} id={id} popover="manual" className="custom-help-popover" role="tooltip"><strong>{label}</strong>{examples.map(example=><p key={example}>{example}</p>)}</div></span>;
}
export function FieldLabel({label,children}: {label:string;children:ReactNode}){return <label><span className="custom-field-caption">{label}<FieldHelp label={label}/></span>{children}</label>;}

export function CustomFormatReference({type}:{type:string}){
 const dialog=useRef<HTMLDialogElement>(null);
 const common=['名称','类型','英文名','适用版本','正文','结构字段'];
 const fields=type==='spell'?['法术环阶','法术学派','施法时间','施法距离','法术成分','持续时间']:type==='class'?['职业生命骰','职业豁免熟练（必填）']:type==='subclass'?['所属职业名称','所属职业来源']:type==='race'?['种族体型','步行速度']:type==='language'?['语言类别','语言文字']:CUSTOM_TYPES[type]?.kind==='item'?['价格（金币）','重量（磅）',...(type==='weapon'?['武器熟练类别','武器类型','武器伤害骰','武器伤害类型']:type==='armor'?['护甲类型','护甲基础值']:type==='tool'?['工具类别']:[])]:[];
 return <><button type="button" className="custom-reference-button" onClick={()=>dialog.current?.showModal()}>查看参考格式</button>{createPortal(<dialog ref={dialog} className="custom-format-reference" aria-label="自定义条目参考格式"><header><h2>{CUSTOM_TYPES[type]?.label}参考格式</h2><button type="button" aria-label="关闭参考格式" onClick={()=>dialog.current?.close()}>×</button></header><p>下面是各输入框可直接参考的写法。标有 JSON 的框需要完整的数组或对象，不能只填动作名称。</p>{[...common,...fields].map(label=><section key={label}><h3>{label}</h3>{FIELD_EXAMPLES[label].map(example=><pre key={example}>{example}</pre>)}</section>)}</dialog>,document.body)}</>;
}
