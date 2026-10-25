import type {Locator} from '@playwright/test';
/** Relative native CSS only; the active-paper restriction belongs to the outer locator. */
export function linguistTrainingRow(panel:Locator){return panel.locator('.training-row > dt').filter({hasText:/^语言$/}).locator('..');}
export function linguistControl(panel:Locator){return panel.locator('.detail-feats [data-reviewed-feat-kind="linguist"]');}
