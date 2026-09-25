// 单机网站公告以这个版本号为准：勾选“下次版本更新之前不再弹出”后，
// 只有版本号变化才会再次弹出。发布时与 package.json 的 version 一起修改。
export const APP_VERSION = '1.0.195';
export const ANNOUNCEMENT_KEY = 'dnd-card:announcement-ack';

export const announcementPending = (stored: string, version = APP_VERSION) => stored !== version;

export function readAnnouncementVersion(): string {
  try { return localStorage.getItem(ANNOUNCEMENT_KEY) || ''; } catch { return ''; }
}
export function rememberAnnouncementVersion(version = APP_VERSION) {
  try { localStorage.setItem(ANNOUNCEMENT_KEY, version); } catch { /* 隐私模式下无法记忆，下次打开会再次提示。 */ }
}
export function forgetAnnouncementVersion() {
  try { localStorage.removeItem(ANNOUNCEMENT_KEY); } catch { /* 同上。 */ }
}
