import type {Plugin} from 'vite';

/** Merge the actual first-card graph, without dragging dynamic libraries in.
 * Tiny shared chunks otherwise each incur a request before the card can paint. */
export function startupChunks():Plugin {
 const first=new Set<string>();
 return {
  name:'first-card-chunks',apply:'build',
  config(){return {build:{rolldownOptions:{output:{codeSplitting:{groups:[{name:'card-core',test:(id:string)=>first.has(id)}]}}}}};},
  buildEnd(){
   first.clear();
   const roots=[...this.getModuleIds()].filter(id=>/\/src\/(main|ui\/App|ui\/PlayerViewer)\.tsx$/.test(id.replaceAll('\\','/')));
   const visit=(id:string)=>{if(first.has(id))return;first.add(id);this.getModuleInfo(id)?.importedIds.forEach(visit);};
   roots.forEach(visit);roots.forEach(id=>first.delete(id));
  },
 };
}
