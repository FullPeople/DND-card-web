// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeAll,expect,it} from 'vitest';
import {RacialDarkvisionSummary} from '../src/ui/RacialDarkvisionSummary';
import {evaluate} from '../src/core/engine';
import {racialDarkvisionEntries,racialDarkvisionFixture,racialDarkvisionDigest} from './helpers/racialDarkvisionFixture';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
beforeAll(()=>{racialDarkvisionEntries();});
/** Real evaluator values and React rerenders, not a map/token or App check. */
it('the readonly source summary updates60 to120 and then clears a paused range without retaining a fabricated default or changing saved data',async()=>{
 const first=racialDarkvisionFixture(),second=racialDarkvisionFixture('kiwee:race:xphb:dwarf::::::'),snapshots=[racialDarkvisionDigest(first.c),racialDarkvisionDigest(second.c)],host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(()=>root.render(createElement(RacialDarkvisionSummary,{d:evaluate(first.c)})));expect(host.querySelector('[data-testid=racial-darkvision-range]')?.textContent).toBe('60');await act(()=>root.render(createElement(RacialDarkvisionSummary,{d:evaluate(second.c)})));expect(host.querySelector('[data-testid=racial-darkvision-range]')?.textContent).toBe('120');expect(racialDarkvisionDigest(first.c)).toBe(snapshots[0]);expect(racialDarkvisionDigest(second.c)).toBe(snapshots[1]);second.c.profile.enabledSources=[];const paused=racialDarkvisionDigest(second.c);await act(()=>root.render(createElement(RacialDarkvisionSummary,{d:evaluate(second.c)})));expect(host.querySelector('[data-testid=racial-darkvision-range]')).toBeNull();expect(host.textContent).toContain('不推定默认距离');expect(host.querySelectorAll('input,button,select')).toHaveLength(0);expect(racialDarkvisionDigest(second.c)).toBe(paused);}finally{await act(()=>root.unmount());host.remove();}
});
