import {afterEach,expect,it,vi} from 'vitest';
import {registerOffline} from '../src/platform/offline';

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

it('a browser that suppresses registration installs no download observer',async()=>{
  vi.stubEnv('PROD',true);
  const observe=vi.fn(),listen=vi.fn();
  vi.stubGlobal('navigator',{serviceWorker:{register:async()=>undefined,addEventListener:listen}});
  vi.stubGlobal('PerformanceObserver',class{observe=observe;});
  await registerOffline(vi.fn());
  expect(observe).not.toHaveBeenCalled();
  expect(listen).not.toHaveBeenCalled();
});

it('a tool completed after worker activation is cached once, while inactive downloads stay harmless',async()=>{
  vi.stubEnv('PROD',true);
  const postMessage=vi.fn();
  const registration:{active?:{postMessage:typeof postMessage};addEventListener:ReturnType<typeof vi.fn>}={addEventListener:vi.fn()};
  let completed!:(list:{getEntries:()=>{name:string}[]})=>void;
  vi.stubGlobal('navigator',{serviceWorker:{register:async()=>registration,addEventListener:vi.fn()}});
  vi.stubGlobal('performance',{getEntriesByType:()=>[]});
  vi.stubGlobal('PerformanceObserver',class{constructor(callback:typeof completed){completed=callback;}observe(){}});
  await registerOffline(vi.fn());
  const download={getEntries:()=>[{name:'https://example.test/assets/SpellsPage-current.js'}]};
  completed(download);expect(postMessage).not.toHaveBeenCalled();
  registration.active={postMessage};
  completed(download);completed(download);
  expect(postMessage).toHaveBeenCalledExactlyOnceWith({type:'cache-used-assets',urls:['https://example.test/assets/SpellsPage-current.js']});
});
