import {useUiLanguage} from './UiLanguage';
import type {UiLanguage} from './uiText';
import './uiLanguage.css';
export const FEEDBACK_URL='https://github.com/FullPeople/obr-suite/issues';
export function LanguageSelector(){const {language,setLanguage,t}=useUiLanguage();return <label className="ui-language-selector"><span>{t('language')}</span><select data-testid="ui-language" aria-label="界面语言 / Interface language" value={language} onChange={event=>setLanguage(event.target.value as UiLanguage)}><option value="zh">中文</option><option value="en">English</option></select></label>;}
export function FeedbackSection({mode='card'}:{mode?:'card'|'announcement'}){const {t}=useUiLanguage();return <section className={mode==='card'?'card-feedback':'announcement-feedback'} data-feedback={mode}><h3>{t('feedbackTitle')}</h3><p>{t('feedbackHelp')}</p><a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">GitHub Issues</a></section>;}
