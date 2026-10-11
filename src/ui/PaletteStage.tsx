import type {CSSProperties,ReactNode} from 'react';
import type {Character} from '../core/model';
import {CARD_COMPONENTS,sheetPaletteStyle,type CardColor,type CardComponent} from '../core/palette';
import {BookIcon,GearIcon,LockClosedIcon,PaletteIcon,SearchIcon,SwordsIcon,UserIcon} from './icons';
import './paletteStage.css';

/** The example screen inside the palette drawer. Every colour token has a
 * visible home here, so hovering a swatch always has something to point at,
 * even when the real page shows no selection, no Wiki table or no portrait.
 * The stage reads the same CSS variables the live page uses, so it previews
 * a drag in the picker as well. */
export type PaletteHot={group:'ui'|'wiki'|'card';key:string;component?:CardComponent};
const names:Record<CardComponent,string>={all:'整张卡',identity:'身份',abilities:'属性',skills:'技能',vitals:'生命',features:'特性',spells:'法术',inventory:'背包',background:'背景',resources:'资源',portrait:'立绘'};
type MarkProps={group:'ui'|'wiki';keys:string|string[];hot?:PaletteHot;className?:string;children?:ReactNode;style?:CSSProperties;as?:'div'|'span'|'b'|'i'|'td'|'th'|'tr'|'table'|'tbody'|'thead'|'a'|'small'|'strong'};
type MarkInner=Omit<MarkProps,'group'|'hot'>;
function Mark({group,keys,hot,className,children,style,as:Tag='div'}:MarkProps){
 const list=Array.isArray(keys)?keys:[keys],on=!!hot&&hot.group===group&&list.includes(hot.key);
 return <Tag className={`${className||''}${on?' is-hot':''}`} data-pt={list.join(' ')} style={style}>{children}</Tag>;
}
function UiStage({hot}:{hot?:PaletteHot}){
 const M=(p:MarkInner)=><Mark group="ui" hot={hot} {...p}/>;
 return <div className="pstage pstage-ui" data-pt="background">
  <M keys="background" className="ps-page">
   <M keys="heading" className="ps-header"><M keys="ink" as="b" className="ps-brand">Full Suite</M><span className="ps-spacer"/><M keys={['button','buttonInk','buttonLine']} className="ps-btn"><BookIcon/>角色簿</M><M keys={['selected','selectedInk']} className="ps-btn is-selected">导入与导出</M><M keys={['button','buttonInk','buttonLine']} className="ps-btn is-icon"><PaletteIcon/></M></M>
   <M keys="heading" className="ps-toolbar"><M keys="ink" as="span">角色卡</M><M keys="line" as="i" className="ps-sep"/><M keys="muted" as="span">已保存 · 刚刚</M><span className="ps-spacer"/><M keys={['button','buttonInk','buttonLine']} className="ps-btn is-small"><GearIcon/>设置</M></M>
   <div className="ps-row">
    <M keys="surface" className="ps-surface">
     <M keys={['band','bandInk']} className="ps-band">切角标题带</M>
     <M keys="ink" className="ps-text">正文文字：艾琳 · 游侠 5 级</M>
     <M keys="muted" className="ps-text is-muted">次要文字：上次修改 3 分钟前</M>
     <M keys="line" as="i" className="ps-line"/>
     <M keys="accent" as="a" className="ps-link">链接与强调 →</M>
    </M>
    <M keys="surface" className="ps-surface ps-side">
     <M keys={['selected','selectedInk']} className="ps-tab is-selected">当前角色</M>
     <M keys={['button','buttonInk','buttonLine']} className="ps-tab">另一张卡</M>
     <M keys="line" as="i" className="ps-line"/>
     <M keys="muted" className="ps-text is-muted">分隔线与次要文字</M>
    </M>
   </div>
  </M>
 </div>;
}
function WikiStage({hot}:{hot?:PaletteHot}){
 const M=(p:MarkInner)=><Mark group="wiki" hot={hot} {...p}/>;
 return <div className="pstage pstage-wiki">
  <M keys="background" className="ps-page">
   <M keys={['area','line']} className="ps-wiki-head"><M keys="title" as="b">法术 · 条目列表</M><span className="ps-spacer"/><M keys={['area','line']} className="ps-btn is-small"><SearchIcon/>搜索</M></M>
   <div className="ps-row">
    <M keys={['area','line']} className="ps-wiki-list">
     <M keys={['entry','entryInk','line']} className="ps-entry">火球术 <M keys="muted" as="small">PHB</M></M>
     <M keys={['selected','selectedInk','line']} className="ps-entry is-selected">魔法飞弹 <small>选中条目</small></M>
     <M keys={['entry','entryInk','line']} className="ps-entry">护盾术 <M keys="muted" as="small">PHB</M></M>
    </M>
    <M keys="background" className="ps-wiki-detail">
     <M keys="title" as="b" className="ps-wiki-title">魔法飞弹</M>
     <M keys="muted" as="small" className="ps-text is-muted">来源与次要文字 · 1 环塑能</M>
     <M keys="ink" className="ps-text">正文文字：你创造三枚闪光的魔力飞镖。每枚飞镖对目标造成 <M keys="link" as="a" className="ps-link">1d4+1</M> 力场伤害。</M>
     <M keys={['feature','featureInk','line']} className="ps-feature">特性与引文底色：升环施法时每高一环多一枚飞镖。</M>
     <M keys={['tableLine']} as="table" className="ps-table"><M keys="tableLine" as="tbody"><M as="tr" keys="tableLine"><M keys={['tableHeading','tableHeadingInk']} as="th">环阶</M><M keys={['tableHeading','tableHeadingInk']} as="th">飞镖</M></M><M as="tr" keys="tableLine"><M keys={['tableCell','tableInk']} as="td">1</M><M keys={['tableCell','tableInk']} as="td">3</M></M><M as="tr" keys="tableLine"><M keys={['tableAlternate','tableInk']} as="td">2</M><M keys={['tableAlternate','tableInk']} as="td">4</M></M></M></M>
    </M>
   </div>
  </M>
 </div>;
}
const parts:Record<CardColor,string>={paper:'paper',surface:'surface',frame:'frame',heading:'heading',headingInk:'headingInk',ink:'ink',badge:'badge'};
function CardStage({hot,character}:{hot?:PaletteHot;character?:Character}){
 const vars=sheetPaletteStyle(character?.palette,character?.componentPalette) as CSSProperties;
 const on=(component:CardComponent,part:CardColor)=>!!hot&&hot.group==='card'&&hot.key===part&&(hot.component==='all'||hot.component===component);
 const cell=(component:Exclude<CardComponent,'all'>,title:string,body:ReactNode,extra?:string)=>{
  const style={'--ps-surface':`var(--card-${component}-surface,var(--card-all-surface))`,'--ps-frame':`var(--card-${component}-frame,var(--card-all-frame))`,'--ps-heading':`var(--card-${component}-heading,var(--card-all-heading))`,'--ps-headingInk':`var(--card-${component}-headingInk,var(--card-all-headingInk))`,'--ps-ink':`var(--card-${component}-ink,var(--card-all-ink))`,'--ps-badge':`var(--card-${component}-badge,var(--card-all-badge))`} as CSSProperties;
  return <div key={component} className={`ps-cell ps-${component}${extra?' '+extra:''}${on(component,'frame')?' is-hot':''}`} data-pc={component} style={style} title={names[component]}>
   <div className={`ps-cell-heading${on(component,'heading')?' is-hot':''}`}><span className={on(component,'headingInk')?'is-hot':undefined}>{title}</span><i className={`ps-badge${on(component,'badge')?' is-hot':''}`} aria-hidden="true"><SwordsIcon/></i></div>
   <div className={`ps-cell-content${on(component,'surface')?' is-hot':''}`}><span className={`ps-cell-ink${on(component,'ink')?' is-hot':''}`}>{body}</span></div>
  </div>;
 };
 const allHot=!!hot&&hot.group==='card'&&hot.component==='all';
 return <div className="pstage pstage-card">
  <div className={`ps-sheet${on('identity','paper')||allHot&&hot?.key==='paper'?' is-hot':''}`} style={vars} data-palette-stage="card">
   <div className="ps-sheet-grid">
    {cell('identity','身份与职业',<>艾琳 · 精灵游侠 5 级</>,'ps-wide')}
    {cell('portrait','立绘',<i className="ps-portrait"><UserIcon/></i>)}
    {cell('abilities','六项属性',<span className="ps-dots">{['力','敏','体','智','感','魅'].map(k=><b key={k}>{k}</b>)}</span>)}
    {cell('skills','技能与豁免',<>隐匿 +7 · 察觉 +5</>)}
    {cell('vitals','生命与数值',<>HP 38/42 · AC 16</>)}
    {cell('features','特性',<>宿敌 · 天生探险家</>)}
    {cell('spells','法术',<>猎人印记 · 治愈伤口</>)}
    {cell('inventory','背包',<>长弓 · 皮甲 · 绳索</>)}
    {cell('background','背景',<>流浪者 · 性格特点</>)}
    {cell('resources','快捷栏与资源',<><LockClosedIcon/> 法术位 2/4</>,'ps-wide')}
   </div>
  </div>
  <p className="ps-caption">{hot&&hot.group==='card'?`${names[hot.component||'all']} · ${({paper:'纸张',surface:'内容底色',frame:'组件描边',heading:'标题栏',headingInk:'标题文字',ink:'文字',badge:'图标'} as Record<string,string>)[hot.key]||hot.key}`:'示例角色卡：悬停左侧色钮，对应组件会在这里亮起'}</p>
 </div>;
}
export function PaletteStage({group,hot,character}:{group:'ui'|'wiki'|'card';hot?:PaletteHot;character?:Character}){
 return <section className="palette-stage" aria-label="配色示例界面" aria-hidden="true">{group==='ui'?<UiStage hot={hot}/>:group==='wiki'?<WikiStage hot={hot}/>:<CardStage hot={hot} character={character}/>}</section>;
}
export const stageComponents=CARD_COMPONENTS;
export const stageParts=parts;
