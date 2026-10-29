import {expect,type Locator,type Page} from '@playwright/test';
import {armorFeatOption} from './reviewedArmorFeatOptions';
export async function observantFeatOption(workspace:Locator,name:string,entryId:string):Promise<Locator>{
 // Reuse the verified DOM identity resolver, including selected/disabled labels.
 // Reference prefixes its optional preview kind; that decoration is not an ID.
 // Check the complete entry payload, never a suffix, guessed wrapper or first hit.
 const option=await armorFeatOption(workspace,name),reference=await option.getAttribute('data-reference');
 expect(reference).not.toBeNull();const separator=reference!.indexOf(':');expect(separator).toBeGreaterThan(0);
 expect(reference!.slice(separator+1)).toBe(`entry:${entryId}`);
 return option;
}
export function observantControl(panel:Locator){return panel.locator('.detail-feats [data-reviewed-feat-kind="observant"]');}
export function observantSkillRow(panel:Locator,name:'察觉'|'调查'){return panel.locator(`.ability-skill:has(> span[title=${JSON.stringify(name)}])`);}
/** The Wiki stays mounted but is hidden while a narrow screen shows the card. */
export function observantCatalogReadyControl(page:Pick<Page,'getByRole'>){return page.getByRole('button',{name:'更新资料',exact:true,includeHidden:true});}
