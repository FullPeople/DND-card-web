import type {Plugin} from 'vite';
/** Discover each entry's static graph at build time, before main's lazy import. */
export function startupPreload():Plugin {
 return {name:'startup-preload',apply:'build',transformIndexHtml:{order:'post',handler(_html,ctx){
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
  return [{tag:'meta',attrs:{charset:'UTF-8'},injectTo:'head-prepend'},{tag:'script',injectTo:'head-prepend',children:`(function(){var links=new URLSearchParams(location.search).get('legacyViewer')==='1'?${JSON.stringify(graph('PlayerViewer'))}:${JSON.stringify(graph('App'))};links.forEach(function(spec){var link=document.createElement('link');link.rel=spec.rel;link.href=spec.href;link.crossOrigin='';if(spec.rel==='preload')link.as='style';document.head.appendChild(link);});})();`}];
 }}};
}
