// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {describe,expect,it} from 'vitest';
import {ClassChoiceRecords} from '../src/ui/ClassChoiceRecords';
import {evaluate} from '../src/core/engine';
import {alertDirectory,alertSnapshot,setupAlert} from './helpers/reviewedAlertCore';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
describe.skipIf(!alertDirectory)('prebatch actual React Alert missing-control regression',()=>{
 it('real selected PHB Wizard4 Alert stays ungranted and exposes the required opt-in control',async()=>{
  const s=setupAlert();s.select();const before=alertSnapshot(s.c),host=document.createElement('div'),root=createRoot(host);
  try{
   await act(()=>root.render(createElement(ClassChoiceRecords,{c:s.c,catalog:s.entries,mode:'feat',edit:()=>{}})));
   expect(evaluate(s.c).initiative).toBe(2);expect(alertSnapshot(s.c)).toBe(before);
   expect(host.querySelectorAll('[data-reviewed-feat-kind=alert]')).toHaveLength(1);
   expect(host.querySelector('input[aria-label="确认警觉先攻加值未计入手工值"]')).not.toBeNull();
  }finally{await act(()=>root.unmount());}
 });
});
