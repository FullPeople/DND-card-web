import {releaseHistoryFor,type ReleaseSection} from '../platform/releaseNotes';
import {Fragment,useEffect,useRef,useState} from 'react';
import {announcementVersionFor,announcementPending,forgetAnnouncementVersion,readAnnouncementVersion,rememberAnnouncementVersion,type AnnouncementMode} from '../platform/announcement';
import './announcement.css';
import {useUiLanguage} from './UiLanguage';
import {FeedbackSection} from './UiControls';
import {AuthorSupport} from './AuthorSupport';
import {SupporterMarquee} from './SupporterMarquee';

const QUESTIONS=[['faqEditionQ','faqEditionA'],['faqSourcesQ','faqSourcesA'],['faqSourceControlQ','faqSourceControlA'],['faqAutomationQ','faqAutomationA']] as const;

// 只有“我知道了”能关闭：Esc 与点击遮罩都不生效，确认前挡住角色卡操作。
// 高度固定，展开答案只滚动正文区；展开后把该条滑入可见范围，手机上纵向滑动照常。
export function Announcement({close,mode='standalone'}:{close:()=>void;mode?:AnnouncementMode}){
  const {language,t}=useUiLanguage();
  const version=announcementVersionFor(mode);
  const [releaseVersion,setReleaseVersion]=useState<string>();
  useEffect(()=>{if(mode!=='standalone')return;let current=true;void fetch('./release.json',{cache:'no-store'}).then(response=>response.ok?response.json():undefined).then(value=>{if(current&&typeof value?.version==='string'&&/^(?:standalone-)?\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(value.version))setReleaseVersion(value.version);}).catch(()=>{});return()=>{current=false;};},[mode]);
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
    <div className="announcement-body">
      <FeedbackSection/><AuthorSupport/>
      {mode==='suite'&&<details className="announcement-owner" onToggle={reveal}><summary>{t('ownerTitle')}</summary><p>{t('ownerIntro')}</p><ol><li>{t('ownerStep1')}<img src="./owner-step1.png" alt={t('ownerImage1')}/><img src="./owner-step2.png" alt={t('ownerImage2')}/></li><li>{t('ownerStep2')}<img src="./owner-step3.png" alt={t('ownerImage3')}/></li></ol><p>{t('ownerFinish')}</p></details>}
      {mode==='suite'&&<p>{t('assignCard')}<a href="https://obr.dnd.center/card/" target="_blank" rel="noreferrer">{t('independentSite')}</a></p>}
      <details className="announcement-issues" onToggle={reveal}><summary>{language==='en'?'Version updates':'版本更新'}</summary>{releaseHistoryFor(mode).map((release,index)=>index===0?<section className="announcement-current" key={release.title}><h3>{release.title}{language==='en'&&release.title!=='2026-09-28'&&` · ${t('chineseOriginal')}`}</h3>{sections(language==='en'&&release.title==='2026-09-28'?englishCurrent:release.sections)}</section>:<details className="announcement-history" key={release.title}><summary>{release.title}{language==='en'&&` · ${t('chineseOriginal')}`}</summary>{sections(release.sections)}</details>)}</details>
      <details className="announcement-faq" open><summary>{t('faq')}</summary>
        {QUESTIONS.map(([question,answer])=><details key={question} onToggle={reveal}><summary>{t(question)}</summary><p>{t(answer)}</p></details>)}
      </details>
    </div>
    <footer className="announcement-foot">
      <label><input type="checkbox" checked={remember} onChange={event=>setRemember(event.target.checked)}/>{t('rememberVersion')}</label>
      <button ref={confirmRef} className="primary" onClick={confirm}>{t('gotIt')}</button>
    </footer>
    </div>
  </dialog>;
}
