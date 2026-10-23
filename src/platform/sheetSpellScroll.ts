import {activeSheet} from './activeSheet';
/** Remember before export removes editing controls; page capture starts too late. */
export function rememberSheetSpellScroll(){
 const paper=activeSheet();
 const identity=paper?.dataset.characterId,page=paper?.getAttribute('aria-labelledby');
 const positions=[...paper?.querySelectorAll<HTMLElement>('.spell-stock-cell .cell-content')||[]].map(node=>({label:node.closest('.sheet-cell')?.getAttribute('aria-label'),top:node.scrollTop,left:node.scrollLeft}));
 return ()=>{
  const current=activeSheet();
  if(!identity||!current?.isConnected||current.dataset.characterId!==identity||current.getAttribute('aria-labelledby')!==page)return;
  const nodes=current.querySelectorAll<HTMLElement>('.spell-stock-cell .cell-content');
  positions.forEach((position,index)=>{const node=nodes[index];if(node&&node.closest('.sheet-cell')?.getAttribute('aria-label')===position.label){node.scrollTop=position.top;node.scrollLeft=position.left;}});
 };
}

export async function withSheetSpellScroll<T>(capture:()=>Promise<T>):Promise<T>{
 const restore=rememberSheetSpellScroll();
 try{return await capture();}
 finally{await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));restore();}
}
