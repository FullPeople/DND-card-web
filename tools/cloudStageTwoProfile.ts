import type {Plugin} from 'vite';

// Explicit, isolated test build. Default production profiles stay paused.
const keys=['dnd-card-standalone','dnd-card-workspace','dnd-card-editor','dnd-card-cloud','dnd-card-session','dnd-card-sheet-display','dnd-card/ui-palette:v1','dnd-card:','dnd-library-','dnd-source-display','dnd-wiki-library-v1','dnd-wiki-reading-progress-v1:','dnd-character-book-order:','full-suite/ui-','full-suite-notes','inventory-collapsed:','inventory-view:'];
export function isolateCloudSource(code:string){
 code=code.replace(/(['"`])\/(card|library|api)\//g,'$1/cloud-lab/$2/');
 for(const key of keys)for(const quote of ["'",'"','`'])code=code.split(quote+key).join(quote+'cloud-lab2:'+key);
 return code;
}
export function cloudStageTwoProfile():Plugin{
 return {name:'isolated-qq-cloud-stage-two',enforce:'pre',transform(code,id){
  if(!/\/src\/.*\.[jt]sx?$/.test(id.replaceAll('\\','/').split('?')[0]))return;
  if(id.replaceAll('\\','/').endsWith('/src/cloud/availability.ts')){
   const needle='export const cloudFeaturesEnabled:boolean=false;';
   if(code.split(needle).length!==2)throw Error('Cloud suspension source changed');
   code=code.replace(needle,'export const cloudFeaturesEnabled:boolean=true;');
  }
  return isolateCloudSource(code);
 },transformIndexHtml:{order:'post',handler:html=>html.replaceAll('href="/card/','href="/cloud-lab/card/').replace('</body>','<aside data-cloud-lab="stage2" style="position:fixed;bottom:3px;right:8px;z-index:99999;padding:3px 8px;background:#50525b;color:white;font:12px system-ui;pointer-events:none">云端测试副本 · 不写回正式库</aside></body>')}};
}
