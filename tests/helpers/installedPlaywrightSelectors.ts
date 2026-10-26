import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {runInNewContext} from 'node:vm';
import type {Locator} from '@playwright/test';
const require=createRequire(import.meta.url),root=dirname(require.resolve('playwright-core/package.json')),{JSDOM}=require('jsdom');
/** Execute the locked official selector engine in a DOM, not a browser. Only
 * locator-chain transport is represented below; no selector/has/text semantics
 * are reimplemented and no browser, socket or remote process is started. */
export function installedPlaywrightSelectors(html:string){
 const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));if(pkg.version!=='1.63.0')throw Error('Review the installed selector harness for the new Playwright version.');
 const bundle=readFileSync(join(root,'lib/coreBundle.js'),'utf8'),literal=bundle.match(/source4 = ('(?:\\.|[^'\\])*');/);if(!literal)throw Error('Missing installed InjectedScript source.');const source=runInNewContext(literal[1]);
 const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true}),window=dom.window;window.structuredClone=structuredClone;
 const Injected=window.eval('(function(){const module={exports:{}};'+source+';return InjectedScript;})()');
 const engine=new Injected(window,{isUnderTest:false,sdkLanguage:'javascript',testIdAttributeName:'data-testid',frameSeq:1,customEngines:[],stableRafCount:1,browserName:'chromium',isUtilityWorld:false});
 const {escapeForTextSelector}=require(join(root,'lib/coreBundle.js')).iso;
 class SelectorChain{
  constructor(readonly selector:string){}
  locator(selector:string){return new SelectorChain(`${this.selector} >> ${selector}`);}
  filter({has,hasText}:{has?:SelectorChain;hasText?:string|RegExp}){return new SelectorChain(this.selector+(has?` >> internal:has=${JSON.stringify(has.selector)}`:'')+(hasText?` >> internal:has-text=${escapeForTextSelector(hasText,false)}`:''));}
 }
 const query=(selector:string):Element[]=>engine.querySelectorAll(engine.parseSelector(selector),window.document);
 return {dom,query,locator:(selector:string)=>new SelectorChain(selector) as unknown as Locator,elements:(locator:Locator)=>query((locator as unknown as SelectorChain).selector),close:()=>window.close()};
}
