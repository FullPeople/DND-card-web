import {test,expect} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {newCharacter,type Entry} from '../../src/core/model';
import {CONDITION_VISUALS,conditionVisual} from '../../src/ui/conditionVisuals';
import {visualConditions} from '../../src/ui/cardVisualState';
import {mockSource} from './fixtures';

const original=['blinded','charmed','deafened','exhaustion','frightened','grappled','incapacitated','invisible','paralyzed','petrified','poisoned','prone','restrained','stunned','unconscious','bloodied','concentration','surprised'];
const excluded=['bless','death_saves','haste','hunters_mark','bardic_inspiration','guidance','resistance','shield','shield_of_faith','mage_armor','protection_from_evil_and_good','aid','heroism','death_ward','freedom_of_movement','fly','levitate','enhanced_ability','enlarge','reduce','mirror_image','blur','warding_bond','raging','hex','advantage','disadvantage','temporary_hp'];
const status=(id:string):Entry=>({id:'test:release:'+id,name:CONDITION_VISUALS[id as keyof typeof CONDITION_VISUALS]?.name||id,english:id,kind:'condition',source:'XPHB',edition:'2024',packId:'release-test',revision:'1',entries:['发布范围验收用状态。'],raw:{}});
const out='F:/CodexWork/2026-09-20/w-xu/release182-fixes/screenshots';

test('candidate retains exactly the original 18 status visual identities and excludes the 28 new ones',async()=>{
 expect(Object.keys(CONDITION_VISUALS).sort()).toEqual([...original].sort());
 for(const id of original)expect(conditionVisual(status(id))).toBe(id);
 for(const id of excluded)expect(conditionVisual({...status(id),raw:{visual:{condition:id}}})).toBeUndefined();
 const c=newCharacter();c.runtime.deathSaves={success:1,failure:1};expect(visualConditions(c).active.size).toBe(0);
 for(const name of ['BuffAtmosphere.tsx','BuffArt.tsx','buffAtmosphere.css','buffArt.css'])expect(existsSync(new URL('../../src/ui/'+name,import.meta.url))).toBe(false);
 expect(existsSync(new URL('../../src/data/buffVisualEntries.ts',import.meta.url))).toBe(false);
 const catalog=readFileSync(new URL('../../src/data/catalog.ts',import.meta.url),'utf8');expect(catalog).not.toContain('LOCAL-BUFFS');expect(catalog).not.toContain('buffVisualEntries');
});

test('actual candidate card keeps original status effects on wide and narrow pages with no new buff layer',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await mockSource(page);await page.emulateMedia({reducedMotion:'reduce'});
 const c=newCharacter();c.name='发布候选·原有状态';c.baseHp=24;c.runtime.hp=18;
 c.selections=original.map(id=>({id:'row:'+id,entry:status(id),level:id==='exhaustion'?2:1,quantity:1,equipped:false}));
 await page.goto('/');expect(new URL(page.url()).port).toBe('5182');await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'release-statuses.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await expect(page.locator('.status-strip .feature-bubble')).toHaveCount(18);for(const id of original)await expect(page.locator('.paper')).toHaveClass(new RegExp(`condition-${id}(?: |$)`));
 await expect(page.locator('[data-card-effect=charmed]')).toHaveCount(1);await expect(page.locator('[data-card-effect=restrained]')).toHaveCount(1);await expect(page.locator('[data-buff-atmosphere],[data-buff-effect]')).toHaveCount(0);
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await expect(page.locator('.paper')).not.toHaveClass(/condition-/);await page.waitForTimeout(1100);await page.screenshot({path:out+'/candidate-original-statuses-wide.png'});
 await page.setViewportSize({width:390,height:900});await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await expect(page.locator('.paper')).toHaveClass(/adaptive-condition-poisoned/);await expect(page.locator('[data-adaptive-effect=charmed][data-phase=present]')).toHaveCount(1);await expect(page.locator('[data-buff-atmosphere],[data-buff-effect]')).toHaveCount(0);await page.screenshot({path:out+'/candidate-original-statuses-narrow.png',fullPage:true});
 await page.getByRole('tab',{name:'背包',exact:true}).click();await expect(page.locator('.paper')).toHaveClass(/adaptive-condition-poisoned/);await expect(page.locator('[data-buff-atmosphere],[data-buff-effect]')).toHaveCount(0);expect(errors).toEqual([]);
});

test('custom status editor has no new visual template picker',async({page})=>{
 await page.route('**/release-custom-editor',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/tests/e2e/releaseCustom181.harness.jsx"></script>`}));
 await page.goto('/release-custom-editor');await page.getByLabel('自定义条目类型').selectOption('condition');await expect(page.getByLabel('自定义条目名称')).toBeVisible();await expect(page.getByLabel('自定义条目正文')).toBeVisible();await expect(page.locator('.custom-visual-picker,.custom-visual-options')).toHaveCount(0);await expect(page.getByRole('radiogroup',{name:'卡片特效'})).toHaveCount(0);await page.screenshot({path:out+'/candidate-custom-status-no-template.png'});
});
