import type {Locator,Page} from '@playwright/test';
/** Relative native CSS only; the active-paper restriction belongs to the outer locator. */
export function linguistTrainingRow(panel:Locator){return panel.locator('.training-row > dt').filter({hasText:/^语言$/}).locator('..');}
export function linguistControl(panel:Locator){return panel.locator('.detail-feats [data-reviewed-feat-kind="linguist"]');}

/** Readiness is source-loading state, not whether the responsive Wiki is open. */
export function linguistCatalogReadyControl(page:Pick<Page,'getByRole'>){return page.getByRole('button',{name:'更新资料',exact:true,includeHidden:true});}
