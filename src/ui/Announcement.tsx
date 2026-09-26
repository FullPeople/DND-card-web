import {RELEASE_DATE,RELEASE_NOTES} from '../platform/releaseNotes';
import {useEffect,useRef,useState} from 'react';
import {APP_VERSION,announcementPending,forgetAnnouncementVersion,readAnnouncementVersion,rememberAnnouncementVersion,type AnnouncementMode} from '../platform/announcement';
import './announcement.css';

const QUESTIONS: [string, string][] = [
  ['可以车20145e/20245r的卡吗？', '可以的，在右上角规则与扩展中切换'],
  ['所有扩展都有吗？第三方也有吗？', '都有啊都有，目前数据来源是来自5etool网站，kiwee老师那边有什么我这边就有什么（他们那边翻译有问题我这边翻译也会同样有问题x）'],
  ['可以单独设置某扩展吗？', '当然可以！你可以在右上角规则与扩展中单独选择开启和禁用某扩展/禁用某扩展的特定内容（比如，打开玩家手册2014，在种族中找到矮人，选择取消勾选）'],
  ['我填了xxx，我的数据怎么没反应？', '该卡没有任何自动化组件！但是马上就有了！携手kiwee老师和fvtt的自动化插件的源码，会在不久的将来实装自动化功能！真的不久！'],
];

// 只有“我知道了”能关闭：Esc 与点击遮罩都不生效，确认前挡住角色卡操作。
// 高度固定，展开答案只滚动正文区；展开后把该条滑入可见范围，手机上纵向滑动照常。
export function Announcement({close,mode='standalone'}:{close:()=>void;mode?:AnnouncementMode}){
  const ref=useRef<HTMLDialogElement>(null);
  const confirmRef=useRef<HTMLButtonElement>(null);
  const [remember,setRemember]=useState(()=>!announcementPending(readAnnouncementVersion(mode)));
  useEffect(()=>{ref.current?.showModal();confirmRef.current?.focus();},[]);
  const confirm=()=>{
    if(remember)rememberAnnouncementVersion(APP_VERSION,mode);
    else forgetAnnouncementVersion(mode);
    ref.current?.close();close();
  };
  const reveal=(event:React.SyntheticEvent<HTMLDetailsElement>)=>{
    if(event.currentTarget.open)event.currentTarget.scrollIntoView({block:'nearest',behavior:'smooth'});
  };
  return <dialog className="announcement" ref={ref} aria-labelledby="announcement-title" onCancel={event=>event.preventDefault()}>
    <header className="announcement-head"><h2 id="announcement-title">{mode==='suite'?'欢迎使用 Full Suite 枭熊工作台！':'欢迎使用这款开源禁商用车卡/Wiki网站！'}</h2><p className="announcement-version">版本 v{APP_VERSION}</p></header>
    <div className="announcement-body">
      {mode==='suite'&&<details className="announcement-owner" onToggle={reveal}><summary>关于设置玩家单独权限的重要说明</summary><p>由 DM 完成下面两步，每位玩家就能操作自己的角色。DM 仍可管理所有角色。</p><ol><li>打开 Players 面板，点击盾牌权限按钮，展开 Map → Character，勾选 Owner Only，再点击 SAVE。<img src="./owner-step1.png" alt="Players 面板中的盾牌权限按钮"/><img src="./owner-step2.png" alt="Map 的 Character 权限勾选 Owner Only 后保存"/></li><li>在地图上选中角色 Token，点击悬浮工具栏的人形 Set Owner，指定所属玩家。<img src="./owner-step3.png" alt="选择角色棋子后通过 Set Owner 指定所属玩家"/></li></ol><p>设置后玩家可以掷自己的先攻、修改加值并结束自己的回合。未指定所属玩家时，玩家可能无法修改角色。</p></details>}
      {mode==='suite'&&<p><a href="https://obr.dnd.center/card/" target="_blank" rel="noreferrer">进入独立车卡网站</a></p>}
      <h3>{RELEASE_DATE} · 更新与修复</h3>
      <ul className="announcement-issues">{RELEASE_NOTES.map(issue=><li key={issue}>{issue}</li>)}</ul>
      <details className="announcement-faq" open><summary>以下是可能用到的Q&amp;A</summary>
        {QUESTIONS.map(([question,answer])=><details key={question} onToggle={reveal}><summary>{question}</summary><p>{answer}</p></details>)}
      </details>
    </div>
    <footer className="announcement-foot">
      <label><input type="checkbox" checked={remember} onChange={event=>setRemember(event.target.checked)}/>下次版本更新之前不再弹出</label>
      <button ref={confirmRef} className="primary" onClick={confirm}>我知道了</button>
    </footer>
  </dialog>;
}
