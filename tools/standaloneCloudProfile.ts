import type {Plugin} from 'vite';

/** Enable the approved private-cloud client without changing saved namespaces. */
export function enableStandaloneCloud(code:string){
 const flag='export const cloudFeaturesEnabled:boolean=false;';
 if(code.split(flag).length!==2)throw Error('Cloud feature source changed');
 return code.replace(flag,'export const cloudFeaturesEnabled:boolean=true;');
}
export function standaloneCloudProfile():Plugin{
 let enabled=false;
 return {name:'standalone-private-cloud-production',enforce:'pre',
  configResolved(config){if(config.mode!=='standalone'||!['/card/','/library/'].includes(config.base))throw Error('Private cloud requires an explicit standalone production target');},
  transform(code,id){if(id.replaceAll('\\','/').split('?')[0].endsWith('/src/cloud/availability.ts')){enabled=true;return enableStandaloneCloud(code);}},
  generateBundle(){if(!enabled)this.error('Private cloud feature profile was not applied');this.emitFile({type:'asset',fileName:'cloud-profile.json',source:JSON.stringify({scope:'standalone-private-cloud-production',cloudFeaturesEnabled:true,accountLibrariesPrivate:true,apiBase:'/api/',originalStorageNamespaces:true,owlbearEnabled:false},null,2)});},
 };
}
