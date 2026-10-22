import {describe,expect,it} from 'vitest';
import {scrollPosition,supportedModalSelector,wheelPixels} from '../src/ui/tooltipWheel';
const page={width:320,height:400};
describe('tooltip wheel motion',()=>{
  it('uses native modal matching only when its selector can be parsed',()=>{
    const queried:string[]=[];
    expect(supportedModalSelector(selector=>{queried.push(selector);return null;})).toBe('[aria-modal="true"],dialog:modal');
    expect(queried).toEqual(['dialog:modal']);
  });
  it('keeps explicit modal boundaries when unsupported selectors throw without treating open dialogs as modal',()=>{
    const selector=supportedModalSelector(()=>{throw new DOMException('Unsupported pseudo-class','SyntaxError');});
    expect(selector).toBe('[aria-modal="true"]');expect(selector).not.toContain(':modal');expect(selector).not.toContain('[open]');
  });
  it('does not hide unrelated DOM failures behind a compatibility fallback',()=>{
    const failure=new Error('Unrelated failure');expect(()=>supportedModalSelector(()=>{throw failure;})).toThrow(failure);
  });
  it('preserves pixel axes and maps line/page units independently',()=>{
    expect(wheelPixels({deltaX:2,deltaY:-3,deltaMode:0,shiftKey:false},page)).toEqual({x:2,y:-3});
    expect(wheelPixels({deltaX:2,deltaY:-3,deltaMode:1,shiftKey:false},page)).toEqual({x:32,y:-48});
    expect(wheelPixels({deltaX:1,deltaY:-1,deltaMode:2,shiftKey:false},page)).toEqual({x:320,y:-400});
  });
  it('preserves explicit diagonal input and shift-wheel horizontal intent',()=>{
    expect(wheelPixels({deltaX:0,deltaY:80,deltaMode:0,shiftKey:true},page)).toEqual({x:80,y:0});
    expect(wheelPixels({deltaX:20,deltaY:80,deltaMode:0,shiftKey:true},page)).toEqual({x:20,y:80});
  });
  it('keeps fractional motion, clamps both edges and leaves a short pane stationary',()=>{
    expect(scrollPosition(20,100,.25)).toBe(20.25);
    expect(scrollPosition(90,100,30)).toBe(100);
    expect(scrollPosition(10,100,-30)).toBe(0);
    expect(scrollPosition(0,0,80)).toBe(0);
  });
  it('supports the negative horizontal scroll range of right-to-left content',()=>{
    expect(scrollPosition(-30,200,-50,true)).toBe(-80);
    expect(scrollPosition(-190,200,-50,true)).toBe(-200);
    expect(scrollPosition(-10,200,50,true)).toBe(0);
  });
});
