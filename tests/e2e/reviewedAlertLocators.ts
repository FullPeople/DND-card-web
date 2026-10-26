// Reuse the already rendered-and-verified whole Reference identity contract;
// no guessed preview-kind prefix, suffix match, first hit or name fallback.
export {observantFeatOption as alertFeatOption,observantCatalogReadyControl as alertCatalogReadyControl} from './reviewedObservantLocators';
import type {Locator} from '@playwright/test';
export const alertControl=(panel:Locator)=>panel.locator('.detail-feats [data-reviewed-feat-kind="alert"]');
