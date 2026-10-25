import type {Locator} from '@playwright/test';
/** Native relative CSS: the active paper stays only on the outer locator. */
export function skilledSkillRow(panel:Locator,name:string){return panel.locator(`.ability-skill:has(> span[title=${JSON.stringify(name)}])`);}
/** Resolve the exact direct DT first, then its row; never put a panel-prefixed
 * locator into Playwright's relative `has` query. */
export function skilledTrainingRow(panel:Locator,name:'工具'|'语言'){return panel.locator('.training-row > dt').filter({hasText:new RegExp(`^${name}$`)}).locator('..');}
