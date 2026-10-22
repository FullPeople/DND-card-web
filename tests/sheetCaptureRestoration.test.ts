import {afterEach,expect,it,vi} from 'vitest';

const capture=vi.hoisted(()=>({active:0,toSvg:vi.fn()}));
vi.mock('../src/platform/storage',()=>({downloadBlob:vi.fn()}));
vi.mock('../src/ui/sheetDisplay',()=>({beginSheetCapture:()=>{capture.active++;let released=false;return()=>{if(!released){released=true;capture.active--;}};}}));
vi.mock('html-to-image',()=>({toSvg:capture.toSvg}));
import {captureSheet} from '../src/platform/sheetImage';

afterEach(()=>{vi.unstubAllGlobals();capture.toSvg.mockReset();expect(capture.active).toBe(0);});

function setup(){
 const classes=new Set<string>();
 const scroll={isConnected:true,scrollTop:205,scrollLeft:7};
 const control={attribute:null as string|null,getAttribute:()=>control.attribute,setAttribute:(_key:string,value:string)=>{control.attribute=value;},removeAttribute:()=>{control.attribute=null;},style:{setProperty:()=>{control.attribute='visibility: hidden !important;';}}};
 const portrait={...control,attribute:'opacity: .6;' as string|null,getAttribute:()=>portrait.attribute,setAttribute:(_key:string,value:string)=>{portrait.attribute=value;},removeAttribute:()=>{portrait.attribute=null;},style:{setProperty:()=>{portrait.attribute='visibility: hidden !important;';}}};
 const paper={isConnected:true,dataset:{characterId:'original-card'},getAttribute:()=> 'original-page',contains:(node:unknown)=>node===scroll,classList:{add:(name:string)=>classes.add(name),remove:(name:string)=>classes.delete(name)},querySelector:()=>null,querySelectorAll:(selector:string)=>selector==='.spell-stock-cell .cell-content'?[scroll]:selector==='.card-lock,.portrait-controls,.feature-browse'?[control]:selector==='.portrait-cell,.bio-portrait'?[portrait]:[]};
 vi.stubGlobal('document',{querySelector:()=>paper,fonts:{ready:Promise.resolve()}});
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{queueMicrotask(()=>callback(0));return 1;});
 return {paper,classes,control,portrait,scroll};
}

it('failed rasterization releases capture mode and restores both absent and existing inline styles',async()=>{
 const {classes,control,portrait,scroll}=setup();
 capture.toSvg.mockImplementation(async()=>{expect(capture.active).toBe(1);expect(classes.has('sheet-export')).toBe(true);expect(control.attribute).toContain('hidden');expect(portrait.attribute).toContain('hidden');scroll.scrollTop=0;scroll.scrollLeft=0;throw Error('capture-render-failed');});
 await expect(captureSheet({hidePortraits:true})).rejects.toThrow('capture-render-failed');
 expect(classes.has('sheet-export')).toBe(false);expect(control.attribute).toBeNull();expect(portrait.attribute).toBe('opacity: .6;');expect(capture.active).toBe(0);
 expect(scroll.scrollTop).toBe(205);expect(scroll.scrollLeft).toBe(7);
});

it('a card switch during capture refuses the wrong card and still releases temporary display state',async()=>{
 const {paper,classes,control,portrait,scroll}=setup();
 capture.toSvg.mockImplementation(async()=>{paper.dataset.characterId='another-card';scroll.scrollTop=0;scroll.scrollLeft=0;return 'unused-svg';});
 await expect(captureSheet({hidePortraits:true})).rejects.toThrow('角色或页面已切换，已停止导出');
 expect(capture.toSvg).toHaveBeenCalledTimes(1);expect(classes.has('sheet-export')).toBe(false);expect(control.attribute).toBeNull();expect(portrait.attribute).toBe('opacity: .6;');expect(capture.active).toBe(0);
 expect(scroll.scrollTop).toBe(0);expect(scroll.scrollLeft).toBe(0);
});
