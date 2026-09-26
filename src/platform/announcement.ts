// 单机网站公告以这个版本号为准：勾选“下次版本更新之前不再弹出”后，
// 只有版本号变化才会再次弹出。发布时与 package.json 的 version 一起修改。
export const APP_VERSION = '0.1.6';
export const ANNOUNCEMENT_KEY = 'dnd-card:announcement-ack';

export const announcementPending = (stored: string, version = APP_VERSION) => stored !== version;

export type AnnouncementMode='standalone'|'suite';
const keyFor=(mode:AnnouncementMode)=>mode==='suite'?`${ANNOUNCEMENT_KEY}:suite`:ANNOUNCEMENT_KEY;
export function readAnnouncementVersion(mode:AnnouncementMode='standalone'): string {
  try { return localStorage.getItem(keyFor(mode)) || ''; } catch { return ''; }
}
export function rememberAnnouncementVersion(version = APP_VERSION,mode:AnnouncementMode='standalone') {
  try { localStorage.setItem(keyFor(mode), version); } catch { /* 隐私模式下无法记忆，下次打开会再次提示。 */ }
}
export function forgetAnnouncementVersion(mode:AnnouncementMode='standalone') {
  try { localStorage.removeItem(keyFor(mode)); } catch { /* 同上。 */ }
}
