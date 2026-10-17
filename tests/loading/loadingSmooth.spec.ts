import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from '../e2e/fixtures';
test.beforeEach(async({page})=>{await mockSource(page);await suppressAnnouncement(page);});

test('a delayed destination page keeps the existing card visible until it is ready',async({page})=>{
 let release!:()=>void;const waiting=new Promise<void>(resolve=>release=resolve);
 await page.route('**/assets/CharacterPages-*.js',async route=>{await waiting;await route.continue();});
 await page.goto('/?intro=0');await expect(page.locator('html')).toHaveAttribute('data-card-startup','complete');
 await expect(page.locator('.overview-sheet')).toBeVisible();
 await page.getByRole('button',{name:'特性',exact:true}).click();await page.waitForTimeout(250);
 await expect(page.locator('.overview-sheet')).toBeVisible();await expect(page.locator('.loading-panel')).toHaveCount(0);
 release();await expect(page.locator('.sheet-details')).toBeVisible();await expect(page.locator('.overview-sheet')).toHaveCount(0);
});

test('a delayed modal does not open a temporary empty dialog',async({page})=>{
 let release!:()=>void;const waiting=new Promise<void>(resolve=>release=resolve);
 await page.route('**/assets/TransferPanel-*.js',async route=>{await waiting;await route.continue();});
 await page.goto('/?intro=0');await expect(page.locator('html')).toHaveAttribute('data-card-startup','complete');
 await page.getByRole('button',{name:/导入.*导出|导入与导出/}).first().click();await page.waitForTimeout(250);
 await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page.locator('.paper')).toBeVisible();
 release();await expect(page.locator('dialog[open]')).toBeVisible();await expect(page.locator('dialog[open] .loading-panel')).toHaveCount(0);
});

test('a skip-intro visit has a real status while its entry is downloading',async({page})=>{
 let release!:()=>void;const waiting=new Promise<void>(resolve=>release=resolve);
 await page.route('**/assets/App-*.js',async route=>{await waiting;await route.continue();});
 await page.goto('/?intro=0',{waitUntil:'commit'});await expect(page.locator('#startup')).toBeVisible();await expect(page.locator('#root')).toHaveCSS('visibility','hidden');
 release();await expect(page.locator('html')).toHaveAttribute('data-card-startup','complete');await expect(page.locator('.paper')).toBeVisible();
});
