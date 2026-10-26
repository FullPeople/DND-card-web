import type {Locator,Page} from '@playwright/test';
export function observantControl(panel:Locator){return panel.locator('.detail-feats [data-reviewed-feat-kind="observant"]');}
export function observantSkillRow(panel:Locator,name:'察觉'|'调查'){return panel.locator(`.ability-skill:has(> span[title=${JSON.stringify(name)}])`);}
/** The Wiki stays mounted but is hidden while a narrow screen shows the card. */
export function observantCatalogReadyControl(page:Pick<Page,'getByRole'>){return page.getByRole('button',{name:'更新资料',exact:true,includeHidden:true});}
