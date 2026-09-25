import {useEffect,useRef,useState} from 'react';
import {APP_VERSION,announcementPending,forgetAnnouncementVersion,readAnnouncementVersion,rememberAnnouncementVersion} from '../platform/announcement';
import './announcement.css';

const ISSUES = [
  '已修复主卡预备法术更新、旧卡施法制度识别与导入版本核对。',
  '已修复玩家绑定棋子的编辑权限与职业、子职资料解析。',
  '新增卡内自定义条目、集中调整职业等级与独立分类搜索。',
  '生命值支持固定平均值、逐级骰值和手填上限；同一职业重复拖入升一级。',
  '施法属性跟随职业，法术页可单独调整；生命骰使用原插件素材。',
];
const QUESTIONS: [string, string][] = [
  ['可以车20145e/20245r的卡吗？', '可以的，在右上角规则与扩展中切换'],
  ['所有扩展都有吗？第三方也有吗？', '都有啊都有，目前数据来源是来自5etool网站，kiwee老师那边有什么我这边就有什么（他们那边翻译有问题我这边翻译也会同样有问题x）'],
  ['可以单独设置某扩展吗？', '当然可以！你可以在右上角规则与扩展中单独选择开启和禁用某扩展/禁用某扩展的特定内容（比如，打开玩家手册2014，在种族中找到矮人，选择取消勾选）'],
  ['我填了xxx，我的数据怎么没反应？', '该卡没有任何自动化组件！但是马上就有了！携手kiwee老师和fvtt的自动化插件的源码，会在不久的将来实装自动化功能！真的不久！'],
];

// 只有“我知道了”能关闭：Esc 与点击遮罩都不生效，确认前挡住角色卡操作。
// 高度固定，展开答案只滚动正文区；展开后把该条滑入可见范围，手机上纵向滑动照常。
export function Announcement({close}:{close:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  const confirmRef=useRef<HTMLButtonElement>(null);
  const [remember,setRemember]=useState(()=>!announcementPending(readAnnouncementVersion()));
  useEffect(()=>{ref.current?.showModal();confirmRef.current?.focus();},[]);
  const confirm=()=>{
    if(remember)rememberAnnouncementVersion();
    else forgetAnnouncementVersion();
    ref.current?.close();close();
  };
  const reveal=(event:React.SyntheticEvent<HTMLDetailsElement>)=>{
    if(event.currentTarget.open)event.currentTarget.scrollIntoView({block:'nearest',behavior:'smooth'});
  };
  return <dialog className="announcement" ref={ref} aria-labelledby="announcement-title" onCancel={event=>event.preventDefault()}>
    <header className="announcement-head"><h2 id="announcement-title">欢迎使用这款开源禁商用车卡/Wiki网站！</h2><p className="announcement-version">版本 v{APP_VERSION}</p></header>
    <div className="announcement-body">
      <p>目前还有诸多没有完善的内容。携手各位dnd领域的大佬和热心测试的网友们，目前还在修复各种各样的问题。</p>
      <h3>本次更新：</h3>
      <ul className="announcement-issues">{ISSUES.map(issue=><li key={issue}>{issue}</li>)}</ul>
      <p>遇到问题请继续反馈。</p>
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
