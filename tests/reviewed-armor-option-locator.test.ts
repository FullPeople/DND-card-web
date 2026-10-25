import {afterEach,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import type {Locator} from '@playwright/test';
// Use the real Playwright polling implementation offline, with only this unit
// harness's deadline shortened. The browser helper keeps the suite default.
vi.mock('@playwright/test',async importOriginal=>{const actual=await importOriginal<typeof import('@playwright/test')>();return {...actual,expect:actual.expect.configure({timeout:250})};});
import {armorFeatOption} from './e2e/reviewedArmorFeatOptions';

const {JSDOM}=createRequire(import.meta.url)('jsdom');
const css=readFileSync(new URL('../src/ui/automationChoices.css',import.meta.url),'utf8');
const prefix=css.match(/\.choice-option\.is-picked:before\s*\{\s*content:'([^']*)'/)?.[1];
const reference='undefined:entry:kiwee:feat:phb:lightly%20armored::::::';
let dom:any;
afterEach(()=>dom?.window.close());

// Offline DOM adapter, NOT a browser/accessibility engine. Role-name values are
// the actual a7c desktop error-context names ("轻甲运用" / "✓ 轻甲运用")
// and f29e desktop+narrow disabled names. This makes the old live role locator's
// drift reproducible without pretending jsdom renders CSS pseudo-elements.
class DomLocator {
 constructor(readonly resolve:()=>Element[]){}
 all(){return this.resolve();}
 locator(selector:string){return new DomLocator(()=>this.all().flatMap(node=>Array.from(node.querySelectorAll(selector))));}
 getByRole(role:string,{name}:{name:RegExp}){expect(role).toBe('button');return new DomLocator(()=>this.locator('button').all().filter(node=>name.test(node.getAttribute('data-offline-accessible-name')!)));}
 and(other:DomLocator){return new DomLocator(()=>this.all().filter(node=>other.all().includes(node)));}
 async evaluateAll<A,R>(callback:(nodes:Element[],arg:A)=>R,arg:A){return callback(this.all(),arg);}
}
function setup(){dom=new JSDOM('<!doctype html><div id="active"><div class="choice-workspace"></div></div><div id="retained"></div>',{url:'https://example.test/'});return dom.window.document.querySelector('.choice-workspace') as HTMLElement;}
function button(root:HTMLElement,name='轻甲运用',ref=reference,selected=false,hint=''){
 const value=root.ownerDocument.createElement('button');value.className=`choice-option ${selected?'is-picked':''}`;value.setAttribute('data-reference',ref);value.setAttribute('aria-disabled',String(!!hint));value.appendChild(root.ownerDocument.createTextNode(name));if(hint){const small=root.ownerDocument.createElement('small');small.textContent=hint;value.appendChild(small);}root.appendChild(value);state(value,selected);return value;
}
function state(value:HTMLElement,selected:boolean){value.classList.toggle('is-picked',selected);value.setAttribute('aria-pressed',String(selected));const name=Array.from(value.childNodes).filter(node=>node.nodeType===3).map(node=>node.textContent).join(''),hint=value.querySelector('small')?.textContent;value.setAttribute('data-offline-accessible-name',`${selected?prefix:''}${name}${hint?' '+hint:''}`);}
const rootLocator=(root:HTMLElement)=>new DomLocator(()=>Array.from(root.ownerDocument.querySelectorAll('#active .choice-workspace'))) as unknown as Locator;
const elements=(locator:Locator)=>(locator as unknown as DomLocator).all();

it('retains the same actual source identity when CSS adds the checked accessible-name prefix',async()=>{
 expect(prefix).toBe('✓ ');const root=setup(),value=button(root),option=await armorFeatOption(rootLocator(root),'轻甲运用');expect(elements(option)).toEqual([value]);
 state(value,true);expect(value.getAttribute('data-offline-accessible-name')).toBe('✓ 轻甲运用');expect(elements(option)).toEqual([value]);expect(elements(option)[0].getAttribute('aria-pressed')).toBe('true');
});
it.each([false,true])('resolves an already rendered selected=%s option and retains it after cancellation/reselection',async selected=>{
 const root=setup(),value=button(root,'轻甲运用',reference,selected),option=await armorFeatOption(rootLocator(root),'轻甲运用');expect(elements(option)).toEqual([value]);for(const next of [false,true,false,true]){state(value,next);expect(elements(option)).toEqual([value]);expect(elements(option)[0].getAttribute('aria-pressed')).toBe(String(next));}
});
it('resolves exact direct labels despite adjacent disabled SMALL hints and keeps the disabled assertion observable',async()=>{
 const root=setup(),value=button(root,'中甲运用',reference.replace('lightly','moderately'),false,'尚未具备此前授予时有效的轻甲熟练。');const option=await armorFeatOption(rootLocator(root),'中甲运用');expect(value.textContent).toBe('中甲运用尚未具备此前授予时有效的轻甲熟练。');expect(value.getAttribute('data-offline-accessible-name')).toBe('中甲运用 尚未具备此前授予时有效的轻甲熟练。');expect(elements(option)).toEqual([value]);expect(elements(option)[0].getAttribute('aria-disabled')).toBe('true');
});
it('survives workspace close/reopen node replacement and re-resolves the same selected reference',async()=>{
 const root=setup(),original=button(root),option=await armorFeatOption(rootLocator(root),'轻甲运用');state(original,true);root.remove();const replacement=root.ownerDocument.createElement('div');replacement.className='choice-workspace';root.ownerDocument.querySelector('#active')!.appendChild(replacement);const reopened=button(replacement,'轻甲运用',reference,true);expect(reopened).not.toBe(original);expect(replacement).not.toBe(root);expect(elements(option)).toEqual([reopened]);expect(elements(await armorFeatOption(rootLocator(replacement),'轻甲运用'))).toEqual([reopened]);state(reopened,false);expect(elements(option)[0].getAttribute('aria-pressed')).toBe('false');
});
it('keeps source identities separate across replacement/reselection and ignores retained cards and non-option references',async()=>{
 const root=setup(),light=button(root),replacement=button(root,'原创替代记录','undefined:entry:kiwee:feat:phb:authored%20armor%20replacement::::::');button(dom.window.document.querySelector('#retained'));const outside=button(root);outside.className='selected-reference';const first=await armorFeatOption(rootLocator(root),'轻甲运用');state(light,true);const second=await armorFeatOption(rootLocator(root),'原创替代记录');state(light,false);state(replacement,true);expect(elements(first)).toEqual([light]);expect(elements(second)).toEqual([replacement]);state(replacement,false);state(light,true);expect(elements(await armorFeatOption(rootLocator(root),'轻甲运用'))).toEqual([light]);
});
it.each(['missing','same-name-other-source','duplicate-reference','missing-reference'])('rejects %s rather than choosing first, guessing or losing source identity',async kind=>{
 const root=setup(),value=button(root);if(kind==='missing')value.remove();if(kind==='same-name-other-source')button(root,'轻甲运用',reference.replace(':phb:',':xphb:'));if(kind==='duplicate-reference')button(root,'不是轻甲运用',reference);if(kind==='missing-reference')value.removeAttribute('data-reference');await expect(async()=>armorFeatOption(rootLocator(root),'轻甲运用')).rejects.toThrow();
});
it('matches only exact direct labels, never a longer name or a label occurring only in a SMALL hint',async()=>{
 const root=setup(),value=button(root);button(root,'轻甲运用改版',reference+'longer');button(root,'其他记录',reference+'hint',false,'轻甲运用');expect(elements(await armorFeatOption(rootLocator(root),'轻甲运用'))).toEqual([value]);value.remove();await expect(armorFeatOption(rootLocator(root),'轻甲运用')).rejects.toThrow('Waiting for one armor feat option');
});
it('keeps the candidate actual source instead of silently relabelling it PHB',async()=>{
 // This helper is identity-preserving, not a source authenticator. The App's
 // PHB legacy workspace and authored fixture own candidate eligibility.
 const root=setup(),other=button(root,'轻甲运用',reference.replace(':phb:',':xphb:')),option=await armorFeatOption(rootLocator(root),'轻甲运用');expect(elements(option)).toEqual([other]);other.setAttribute('data-reference',reference);expect(elements(option)).toEqual([]);
});

it('waits within the existing expect budget when the workspace opens before its named candidate arrives',async()=>{
 const root=setup();button(root,'其他记录',reference+'other');let settled=false;const pending=armorFeatOption(rootLocator(root),'轻甲运用').then(value=>{settled=true;return value;});await new Promise(resolve=>setTimeout(resolve,20));expect(settled).toBe(false);const late=button(root);expect(elements(await pending)).toEqual([late]);
});
it.each(['same-name','missing-reference','duplicate-reference'])('does not retry an invalid %s identity as if it were still loading',async kind=>{
 const root=setup(),value=button(root);if(kind==='same-name')button(root,'轻甲运用',reference.replace(':phb:',':xphb:'));if(kind==='missing-reference')value.removeAttribute('data-reference');if(kind==='duplicate-reference')button(root,'其他记录',reference);const read=vi.spyOn(DomLocator.prototype,'evaluateAll');try{await expect(armorFeatOption(rootLocator(root),'轻甲运用')).rejects.toThrow();expect(read).toHaveBeenCalledTimes(1);}finally{read.mockRestore();}
});
