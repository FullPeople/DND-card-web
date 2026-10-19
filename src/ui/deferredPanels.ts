import {deferredComponent} from './deferredComponent';
// Keep the notice shell styled even when its optional progress page is unavailable.
import './uiLanguage.css';
import './authorSupport.css';
import './supporterMarquee.css';

export const ruleOptionsPanel=deferredComponent<Parameters<typeof import('./RuleOptions').RuleOptions>[0]>(()=>import('./RuleOptions').then(module=>({default:module.RuleOptions})));
export const sourceSettingsPanel=deferredComponent<Parameters<typeof import('./SourceSettings').SourceSettings>[0]>(()=>import('./SourceSettings').then(module=>({default:module.SourceSettings})));
export const roomRulesPanel=deferredComponent<Parameters<typeof import('./RoomRulesSummary').RoomRulesSummary>[0]>(()=>import('./RoomRulesSummary').then(module=>({default:module.RoomRulesSummary})));
export const transferPanel=deferredComponent<Parameters<typeof import('./TransferPanel').TransferPanel>[0]>(()=>import('./TransferPanel').then(module=>({default:module.TransferPanel})));
export const announcementPanel=deferredComponent<Parameters<typeof import('./Announcement').Announcement>[0]>(()=>import('./Announcement').then(module=>({default:module.Announcement})));
export const preloadRulesPanel=()=>Promise.all([ruleOptionsPanel.preload(),sourceSettingsPanel.preload(),roomRulesPanel.preload()]);

/** Intent warming never opens a dialog or changes a character. */
export function warmPanel(load:()=>Promise<unknown>){void load().catch(()=>{});}
