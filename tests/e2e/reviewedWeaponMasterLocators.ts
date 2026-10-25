import type {Locator} from '@playwright/test';

// The automation view has no item-id attribute. Keep its exact visible item +
// attack-mode title, separate from the numeric result being asserted afterward.
export function weaponAttackSummary(panel:Locator,title:string):Locator{
 const escaped=title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return panel.locator('summary').filter({hasText:new RegExp(`^${escaped}：`)});
}
