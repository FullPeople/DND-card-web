import {createElement,Suspense} from 'react';
import {renderToString} from 'react-dom/server';
import {expect,test,vi} from 'vitest';
import {deferredComponent} from '../src/ui/deferredComponent';

const Panel=({name}:{name:string})=>createElement('p',null,name);

test('a preloaded dialog renders its actual content on the first render without a suspense shell',async()=>{
 const load=vi.fn(async()=>({default:Panel})),panel=deferredComponent(load);
 await panel.preload();
 const html=renderToString(createElement(Suspense,{fallback:'loading-shell'},createElement(panel.Component,{name:'complete-content'})));
 expect(html).toContain('<p>complete-content</p>');expect(html).not.toContain('loading-shell');expect(load).toHaveBeenCalledOnce();
});

test('idle warming, focus and click share one in-flight download and keep current props',async()=>{
 let release!:(module:{default:typeof Panel})=>void;
 const load=vi.fn(()=>new Promise<{default:typeof Panel}>(done=>{release=done;})),panel=deferredComponent(load);
 const warming=panel.preload(),click=panel.preload();expect(click).toBe(warming);expect(load).toHaveBeenCalledOnce();
 release({default:Panel});await click;
 expect(renderToString(createElement(panel.Component,{name:'current-character'}))).toBe('<p>current-character</p>');
 expect(await panel.preload()).toEqual({default:Panel});expect(load).toHaveBeenCalledOnce();
});

test('a failed background download can be retried by an explicit open',async()=>{
 const load=vi.fn<()=>Promise<{default:typeof Panel}>>().mockRejectedValueOnce(Error('offline')).mockResolvedValue({default:Panel});
 const panel=deferredComponent(load);await expect(panel.preload()).rejects.toThrow('offline');await panel.preload();
 const html=renderToString(createElement(Suspense,{fallback:'loading-shell'},createElement(panel.Component,{name:'recovered'})));
 expect(html).toContain('<p>recovered</p>');expect(html).not.toContain('loading-shell');expect(load).toHaveBeenCalledTimes(2);
});
