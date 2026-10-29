import {expect,type Locator,type Page} from '@playwright/test';
export {observantCatalogReadyControl as ordinaryCatalogReadyControl} from './reviewedObservantLocators';
/** The same exact whole Reference payload contract as the accepted helpers. */
export async function assertOrdinaryReference(node:Locator,entryId:string){await expect(node).toHaveCount(1);const reference=await node.getAttribute('data-reference');expect(reference).not.toBeNull();const separator=reference!.indexOf(':');expect(separator).toBeGreaterThan(0);expect(reference!.slice(separator+1)).toBe(`entry:${entryId}`);}
export async function ordinaryCatalogRow(page:Page,entryId:string){const row=page.locator(`.catalog-row[data-entry-id=${JSON.stringify(entryId)}]`);await expect(row).toHaveCount(1);await expect(row).toBeVisible();return row;}
export const ordinaryActionControl=(page:Page)=>page.getByRole('dialog').locator('[data-ordinary-spell-actions]');
