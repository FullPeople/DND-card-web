import {useUiLanguage} from './UiLanguage';
import './uiLanguage.css';
export const FEEDBACK_URL='https://github.com/FullPeople/DND-card/issues';
export const FEEDBACK_EMAIL='1763086701psw@gmail.com';
export function FeedbackSection(){const {t}=useUiLanguage();return <section className="announcement-feedback" data-feedback="announcement"><h3>{t('feedbackTitle')}</h3><p>如果遇到bug或者反馈，请附带使用版本，复现步骤，截图以及描述，提交到以下地方！</p><a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">GitHub Issues</a><a href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a></section>;}
