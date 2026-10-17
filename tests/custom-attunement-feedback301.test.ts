import {it,expect,vi} from 'vitest';
vi.mock('../src/platform/workbench',()=>({inWorkbench:false,composeRoll:()=>{}}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:()=>()=>{},landingWithin:()=>({})}));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCustomEntry} from '../src/core/customEntries';
import {EntryFacts} from '../src/ui/EntryFacts';

it.each([true,'需要施法者同调'])('shows authored attunement %s in the item facts without mutating it',reqAttune=>{
 const entry=createCustomEntry({name:'原创同调饰品',type:'item',body:'原创测试资料。',raw:{reqAttune}}),before=JSON.stringify(entry);
 const restored=JSON.parse(before),html=renderToStaticMarkup(createElement(EntryFacts,{entry:restored,onLink:()=>{}}));
 expect(html).toContain('<dt>同调</dt>');
 expect(html).toContain(typeof reqAttune==='string'?reqAttune:'需要同调');
 expect(JSON.stringify(restored)).toBe(before);
});
