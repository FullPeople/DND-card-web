import {afterEach,expect,it,vi} from 'vitest';
import {rememberSheetSpellScroll,withSheetSpellScroll} from '../src/platform/sheetSpellScroll';

afterEach(()=>vi.unstubAllGlobals());
function setup(){
 const cell=(label:string,top:number)=>({scrollTop:top,scrollLeft:7,closest:()=>({getAttribute:()=>label})});
 const paper={isConnected:true,dataset:{characterId:'original'},page:'spells',nodes:[cell('prepared',0),cell('known',268)],getAttribute(){return this.page;},querySelectorAll(){return this.nodes;}};
 let current=paper;vi.stubGlobal('document',{querySelector:()=>current});
 return {paper,cell,replace:(next:typeof paper)=>{current=next;}};
}
it('restores the position from editing mode after a five-page capture remounts the original page',()=>{
 const {paper,cell,replace}=setup(),restore=rememberSheetSpellScroll();
 paper.nodes[1].scrollTop=205; // Turning editing off clamps the viewport before capture.
 const remounted={...paper,nodes:[cell('prepared',0),cell('known',0)]};replace(remounted);
 restore();expect(remounted.nodes[1].scrollTop).toBe(268);expect(remounted.nodes[1].scrollLeft).toBe(7);
});
it.each(['card','page','disconnected'] as const)('does not restore into a changed %s',change=>{
 const {paper}=setup(),restore=rememberSheetSpellScroll();paper.nodes[1].scrollTop=0;
 if(change==='card')paper.dataset.characterId='another';else if(change==='page')paper.page='inventory';else paper.isConnected=false;
 restore();expect(paper.nodes[1].scrollTop).toBe(0);
});
it('does not put a known-list position into a different section after the layout changes',()=>{
 const {paper,cell}=setup(),restore=rememberSheetSpellScroll();paper.nodes=[cell('known',0),cell('prepared',0)];
 restore();expect(paper.nodes.map(node=>node.scrollTop)).toEqual([0,0]);
});
it('waits for the restored editing layout even when export fails, then preserves the original error',async()=>{
 const {paper}=setup();let frames=0;
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{queueMicrotask(()=>{frames++;callback(0);});return 1;});
 await expect(withSheetSpellScroll(async()=>{paper.nodes[1].scrollTop=205;throw Error('image-failed');})).rejects.toThrow('image-failed');
 expect(frames).toBe(2);expect(paper.nodes[1].scrollTop).toBe(268);
});
