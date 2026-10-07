import {releaseLogFor,type ReleaseSection} from '../platform/releaseNotes';
import {Fragment,lazy,Suspense,useEffect,useRef,useState} from 'react';
import {announcementVersionFor,announcementPending,forgetAnnouncementVersion,readAnnouncementVersion,rememberAnnouncementVersion,type AnnouncementMode} from '../platform/announcement';
import './announcement.css';
import {useUiLanguage} from './UiLanguage';
import {FeedbackSection} from './UiControls';
import {AuthorSupport} from './AuthorSupport';
import {SupporterMarquee} from './SupporterMarquee';
import {ToolBoundary} from './ToolBoundary';
import './automationProgress.css';
const AutomationProgress=lazy(()=>import('./AutomationProgress'));

const QUESTIONS=[['faqEditionQ','faqEditionA'],['faqSourcesQ','faqSourcesA'],['faqSourceControlQ','faqSourceControlA'],['faqAutomationQ','faqAutomationA']] as const;

// 只有“我知道了”能关闭：Esc 与点击遮罩都不生效，确认前挡住角色卡操作。
// 高度固定，展开答案只滚动正文区；展开后把该条滑入可见范围，手机上纵向滑动照常。
export function Announcement({close,mode='standalone'}:{close:()=>void;mode?:AnnouncementMode}){
  const {language,t}=useUiLanguage();
  const version=announcementVersionFor(mode);
  const [release,setRelease]=useState<unknown>();
  const [tab,setTab]=useState(0);
  const [progressOpened,setProgressOpened]=useState(false);
  const releases=releaseLogFor(mode);
  const tabs=['公告内容','自动化进度','更新日志'];
  const englishTabs=['Notice','Automation progress','Changelog'];
  const bodyRef=useRef<HTMLDivElement>(null);
  const tabRefs=useRef<(HTMLButtonElement|null)[]>([]);
  const selectTab=(index:number)=>{setTab(index);if(index===1)setProgressOpened(true);if(bodyRef.current)bodyRef.current.scrollTop=0;};
  const releaseValue=release as {version?:unknown}|undefined;
  const releaseVersion=typeof releaseValue?.version==='string'&&/^(?:standalone-)?\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(releaseValue.version)?releaseValue.version:undefined;
  useEffect(()=>{if(mode!=='standalone')return;let current=true;void fetch('./release.json',{cache:'no-store'}).then(response=>response.ok?response.json():undefined).then(value=>{if(current)setRelease(value);}).catch(()=>{});return()=>{current=false;};},[mode]);
  const ref=useRef<HTMLDialogElement>(null);
  const confirmRef=useRef<HTMLButtonElement>(null);
  const [remember,setRemember]=useState(()=>!announcementPending(readAnnouncementVersion(mode),version));
  useEffect(()=>{ref.current?.showModal();confirmRef.current?.focus();},[]);
  const confirm=()=>{
    if(remember)rememberAnnouncementVersion(version,mode);
    else forgetAnnouncementVersion(mode);
    ref.current?.close();close();
  };
  const reveal=(event:React.SyntheticEvent<HTMLDetailsElement>)=>{
    if(event.currentTarget.open)event.currentTarget.scrollIntoView({block:'nearest',behavior:'smooth'});
  };
  const sections=(values:ReleaseSection[])=>values.map((section,index)=><Fragment key={section.title}>{index>0&&<hr/>}<section className="announcement-section"><h4>{section.title}</h4><ul>{section.items.map(issue=><li key={issue}>{issue}</li>)}</ul></section></Fragment>);
  // Translate this published notice only; older and future unmatched notes
  // remain explicitly marked as original text instead of showing stale claims.
  const englishCurrent:ReleaseSection[]=[
    {title:t('releaseAutomation'),items:[t('releaseAutomation1'),t('releaseAutomation2'),t('releaseAutomation3'),t('releaseAutomation4')]},
    {title:t('releaseSpells'),items:[t('releaseSpells1'),t('releaseSpells2'),t('releaseSpells3'),t('releaseSpells4')]},
    {title:t('releasePending'),items:[t('releasePending1')]},
    ...(mode==='suite'?[{title:t('releaseSuite'),items:[t('releaseSuite1')]},{title:t('releaseInvestigating'),items:[t('releaseInvestigating1')]}]:[]),
  ];
  return <dialog className="announcement" ref={ref} aria-labelledby="announcement-title" onCancel={event=>event.preventDefault()}>
    <SupporterMarquee fullScreen/>
    <div className="announcement-panel">
    <header className="announcement-head"><div className="announcement-heading-row"><h2 id="announcement-title">{t(mode==='suite'?'welcomeSuite':'welcomeSite')}</h2></div><p className="announcement-version">{releaseVersion ? t('version',{version:releaseVersion}) : t('version',{version})}{releaseVersion&&<small> · {language==='en'?'Notice':'公告'} {version}</small>}</p></header>
    <nav className="announcement-tabs" role="tablist" aria-label="公告、自动化进度与更新日志">{tabs.map((label,index)=><button key={label} ref={node=>{tabRefs.current[index]=node;}} id={`announcement-tab-${index}`} role="tab" aria-selected={tab===index} aria-controls={`announcement-panel-${index}`} tabIndex={tab===index?0:-1} onClick={()=>selectTab(index)} onKeyDown={event=>{let next:number|undefined;if(event.key==='ArrowLeft'||event.key==='ArrowRight')next=(tab+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();selectTab(next);tabRefs.current[next]?.focus();}}}>{language==='en'?englishTabs[index]:label}</button>)}</nav>
    <div className="announcement-body" ref={bodyRef}>
      <section id="announcement-panel-0" role="tabpanel" aria-labelledby="announcement-tab-0" hidden={tab!==0}>
      <FeedbackSection/><AuthorSupport/>
      {mode==='suite'&&<details className="announcement-owner" onToggle={reveal}><summary>{t('ownerTitle')}</summary><p>{t('ownerIntro')}</p><ol><li>{t('ownerStep1')}<img src="./owner-step1.png" alt={t('ownerImage1')}/><img src="./owner-step2.png" alt={t('ownerImage2')}/></li><li>{t('ownerStep2')}<img src="./owner-step3.png" alt={t('ownerImage3')}/></li></ol><p>{t('ownerFinish')}</p></details>}
      {mode==='suite'&&<p>{t('assignCard')}<a href="https://obr.dnd.center/card/" target="_blank" rel="noreferrer">{t('independentSite')}</a></p>}
      <details className="announcement-faq" open><summary>{t('faq')}</summary>
        {QUESTIONS.map(([question,answer])=><details key={question} onToggle={reveal}><summary>{t(question)}</summary><p>{t(answer)}</p></details>)}
      </details>
      </section>
      <section id="announcement-panel-1" role="tabpanel" aria-labelledby="announcement-tab-1" hidden={tab!==1}>{progressOpened&&<ToolBoundary label="自动化进度" close={confirm}><Suspense fallback={<p role="status">正在读取自动化进度…</p>}><AutomationProgress release={release} mode={mode}/></Suspense></ToolBoundary>}</section>
      <section id="announcement-panel-2" className="announcement-changelog" role="tabpanel" aria-labelledby="announcement-tab-2" hidden={tab!==2}>{releases.map((release,index)=><section className={`announcement-log-day ${index===0?'announcement-current':'announcement-history'}`} key={release.title}><h3>{release.title}{language==='en'&&release.title!=='2026-09-28'&&` · ${t('chineseOriginal')}`}</h3>{sections(language==='en'&&release.title==='2026-09-28'?englishCurrent:release.sections)}</section>)}</section>
    </div>
    <footer className="announcement-foot">
      <label><input type="checkbox" checked={remember} onChange={event=>setRemember(event.target.checked)}/>{t('rememberVersion')}</label>
      <button ref={confirmRef} className="primary" onClick={confirm}>{t('gotIt')}</button>
    </footer>
    </div>
  </dialog>;
}
