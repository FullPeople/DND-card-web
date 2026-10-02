import {afterEach,describe,expect,it,vi} from 'vitest';
import {createWikiPreviewTransition,WIKI_PREVIEW_EXIT_MS,WIKI_PREVIEW_ENTER_MS} from '../src/ui/wikiPreviewTransition';
import {readingHighlightBox} from '../src/ui/useReadingHighlight';
import {SUPPORTER_SPEED_PX_PER_SECOND,supporterFlightTiming} from '../src/ui/supporterMarqueeMotion';
function fixture(){
 vi.useFakeTimers();let key:string|undefined='reading',reduced=false;
 const commit=vi.fn((value:string|undefined)=>{key=value;});const begin=vi.fn(()=>true),cancel=vi.fn(),entering=vi.fn();
 const transition=createWikiPreviewTransition({currentKey:()=>key,commit,begin,cancel,entering,reducedMotion:()=>reduced});
 return {transition,commit,begin,cancel,entering,reduce:()=>{reduced=true;}};
}
afterEach(()=>vi.useRealTimers());
describe('Wiki hover paint intent',()=>{
 it('commits only latest rapid hover without extending a queue',()=>{const f=fixture();f.transition.request('first','first');vi.advanceTimersByTime(30);f.transition.request('last','last');vi.advanceTimersByTime(WIKI_PREVIEW_EXIT_MS-30);expect(f.commit.mock.calls).toEqual([['last']]);expect(f.begin).toHaveBeenCalledTimes(1);expect(WIKI_PREVIEW_EXIT_MS+WIKI_PREVIEW_ENTER_MS).toBeLessThanOrEqual(120);});
 it('returning to the reading document cancels an uncommitted hover',()=>{const f=fixture();f.transition.request('hover','hover');f.transition.request('reading','reading');vi.runAllTimers();expect(f.commit.mock.calls).toEqual([['reading']]);});
 it('explicit navigation cannot be overwritten by an old hover timer',()=>{const f=fixture();f.transition.request('old','old');f.transition.cancel();vi.runAllTimers();expect(f.commit).not.toHaveBeenCalled();});
 it('interrupts restoration with the latest hovered document',()=>{const f=fixture();f.transition.request('hover','hover');vi.runAllTimers();f.transition.request('reading','reading');f.transition.request('new','new');vi.runAllTimers();expect(f.commit.mock.calls).toEqual([['hover'],['new']]);});
 it('same document focus updates immediately without a document fade',()=>{const f=fixture();f.transition.request('reading','reading');expect(f.commit).toHaveBeenCalledWith('reading');expect(f.begin).not.toHaveBeenCalled();});
 it('reduced motion flushes a pending request and leaves no late work',()=>{const f=fixture();f.transition.request('hover','hover');f.reduce();f.transition.finishImmediately();expect(f.commit).toHaveBeenCalledWith('hover');vi.runAllTimers();expect(f.commit).toHaveBeenCalledTimes(1);f.transition.request('reading','reading');expect(f.commit).toHaveBeenCalledWith('reading');expect(f.begin).toHaveBeenCalledTimes(1);});
 it('restores an empty original reader as well',()=>{const f=fixture();f.transition.request(undefined,undefined);vi.runAllTimers();expect(f.commit).toHaveBeenCalledWith(undefined);});
});
it('highlight positions are relative to the document and preserve exact dimensions',()=>{expect(readingHighlightBox({left:100,top:-80,width:600,height:1000},{left:130,top:42,width:543.5,height:99.25})).toEqual({x:30,y:122,width:543.5,height:99.25});});
it('barrage travels faster and keeps lane separation synchronized',()=>{expect(SUPPORTER_SPEED_PX_PER_SECOND).toBeGreaterThan(125);const timing=supporterFlightTiming(1440,300);expect(timing.duration*SUPPORTER_SPEED_PX_PER_SECOND/1000).toBeCloseTo(1790);expect(timing.laneDelay*SUPPORTER_SPEED_PX_PER_SECOND/1000).toBeCloseTo(344);});
