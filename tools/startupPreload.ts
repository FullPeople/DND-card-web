import type {Plugin} from 'vite';
import {readFileSync} from 'node:fs';
/** Discover each entry's static graph at build time, before main's lazy import. */
export function startupPreload():Plugin {
 return {name:'startup-preload',apply:'build',transformIndexHtml:{order:'post',handler(html,ctx){
  const bundle=ctx.bundle;if(!bundle)return;
  const graph=(entry:string)=>{
   const files=new Set<string>(),styles=new Set<string>();
   const visit=(name:string)=>{if(files.has(name))return;const chunk=bundle[name];if(chunk?.type!=='chunk')return;files.add(name);chunk.imports.forEach(visit);
    for(const css of (chunk as typeof chunk&{viteMetadata?:{importedCss:Set<string>}}).viteMetadata?.importedCss??[])styles.add(css);
   };
   const chunk=Object.values(bundle).find(item=>item.type==='chunk'&&item.facadeModuleId?.replaceAll('\\','/').endsWith(`/ui/${entry}.tsx`));
   if(chunk)visit(chunk.fileName);
   return [...files].map(file=>({href:'./'+file,rel:'modulepreload'})).concat([...styles].map(file=>({href:'./'+file,rel:'preload'})));
  };
  // Keep the approved pixels in the HTML so four independent image requests
  // cannot hold the opening hostage. Original PNGs remain as source assets.
  html=html.replace(/src="\.\/startup-logo\/([1-4])\.PNG"/g,(_match,id:string)=>`src="data:image/webp;base64,${readFileSync(new URL(`../public/startup-logo/${id}.webp`,import.meta.url)).toString('base64')}"`);
  // Only the tiny inline opening stylesheet is needed to show the opening.
  // The card still waits for these sheets before becoming visible underneath.
  html=html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*>/g,tag=>tag.replace(/>$/,` media="print" data-card-style onload="this.media='all';window.dispatchEvent(new Event('dnd-card-style-ready'))">`));
  return {html,tags:[{tag:'meta',attrs:{charset:'UTF-8'},injectTo:'head-prepend'},{tag:'script',injectTo:'head-prepend',children:`(function(){var links=new URLSearchParams(location.search).get('legacyViewer')==='1'?${JSON.stringify(graph('PlayerViewer'))}:${JSON.stringify(graph('App'))};links.forEach(function(spec){var link=document.createElement('link');link.rel=spec.rel;link.href=spec.href;link.crossOrigin='';if(spec.rel==='preload')link.as='style';document.head.appendChild(link);});})();`}]};
 }}};
}
