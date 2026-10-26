import {afterEach,expect,it} from 'vitest';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {runInNewContext} from 'node:vm';
import type {Locator} from '@playwright/test';
import {weaponAttackSummary} from './e2e/reviewedWeaponMasterLocators';
const require=createRequire(import.meta.url),{JSDOM}=require('jsdom');
let dom:any;
afterEach(()=>dom?.window.close());
class DomLocator{
 constructor(readonly resolve:()=>Element[]){}
 all(){return this.resolve();}
 locator(selector:string){return new DomLocator(()=>this.all().flatMap(node=>Array.from(node.querySelectorAll(selector))));}
 filter({hasText}:{hasText:string|RegExp}){return new DomLocator(()=>this.all().filter(node=>typeof hasText==='string'?node.textContent!.includes(hasText):hasText.test(node.textContent!)));}
}
const elements=(value:Locator)=>(value as unknown as DomLocator).all();
function setup(html:string){dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only'});return new DomLocator(()=>[dom.window.document.body]) as unknown as Locator;}
it.each([[1,'1d8+1'],[7,'1d8+5']])('targets the ordinary Longsword rather than its prefixed magical title at attack %i', (bonus,damage)=>{
 // These are the actual first and second narrow failure summary titles. The
 // original substring locator resolves two nodes before any formula assertion.
 const panel=setup(`<details><summary>长剑 · 近战：命中 ${bonus}，伤害 ${damage}</summary></details><details><summary>原创魔法长剑 · 近战：命中 ${bonus+1}，伤害 1d8+2</summary></details>`),value=weaponAttackSummary(panel,'长剑 · 近战');expect(elements(value)).toHaveLength(1);expect(elements(value)[0].textContent).toBe(`长剑 · 近战：命中 ${bonus}，伤害 ${damage}`);expect(elements(weaponAttackSummary(panel,'原创魔法长剑 · 近战'))).toHaveLength(1);
});
it('keeps item and mode boundaries exact, with regex punctuation escaped and numeric assertions independent',()=>{
 const panel=setup('<summary>剑 (+1) · 近战：命中 4，伤害 1d8+2</summary><summary>剑 (+1) · 双手：命中 4，伤害 1d10+2</summary><summary>前缀剑 (+1) · 近战：命中 9，伤害 1d8+2</summary><summary>剑 (+1) · 近战附赠：命中 9，伤害 1d8+2</summary>');expect(elements(weaponAttackSummary(panel,'剑 (+1) · 近战'))).toHaveLength(1);
});
it('replays the locked Playwright OPTION-label retarget against the real injected implementation, independently of native disabled state',()=>{
 setup('<label>武器 4<select aria-label="武器大师武器 4"><option value="Net|PHB">捕网 · PHB</option><option value="Pistol|DMG" disabled selected>手枪 · DMG</option></select></label>');
 const root=dirname(require.resolve('playwright-core/package.json')),pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));expect(pkg.version).toBe('1.63.0');
 // Evaluate only the installed official package's embedded injection module in
 // jsdom. No browser/process/socket is launched, and no engine is reimplemented.
 const bundle=readFileSync(join(root,'lib/coreBundle.js'),'utf8'),literal=bundle.match(/source4 = ('(?:\\.|[^'\\])*');/);expect(literal).not.toBeNull();const source=runInNewContext(literal![1]);expect(source).toContain('// packages/injected/src/injectedScript.ts');dom.window.module={exports:{}};dom.window.eval(source);const Injected=dom.window.module.exports.InjectedScript(),injected=Object.create(Injected.prototype),option=dom.window.document.querySelector('option[value="Pistol|DMG"]'),select=dom.window.document.querySelector('select');
 expect(option.disabled).toBe(true);expect(option.getAttribute('disabled')).toBe('');expect(option.matches(':disabled')).toBe(true);expect(option.selected).toBe(true);expect(select.disabled).toBe(false);expect(injected.retarget(option,'follow-label')).toBe(select);expect(injected.elementState(option,'disabled')).toEqual({matches:false,received:'enabled'});
 // Removing the native restriction must fail the replacement assertions even
 // though the old label-retargeted matcher still reports the identical state.
 option.removeAttribute('disabled');expect(option.disabled).toBe(false);expect(option.getAttribute('disabled')).toBeNull();expect(injected.elementState(option,'disabled')).toEqual({matches:false,received:'enabled'});
 select.disabled=true;expect(option.disabled).toBe(false);expect(injected.elementState(option,'disabled')).toEqual({matches:true,received:'disabled'});
});
