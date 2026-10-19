import {defineConfig,mergeConfig,type Plugin} from 'vite';
import base from './vite.config';

/** Explicit local experiment only; normal builds retain the paused boundary. */
export function cloudStageOneProfile():Plugin{
 return {name:'loopback-cloud-stage-one',enforce:'pre',transform(code,id){
  if(!id.replaceAll('\\','/').split('?')[0].endsWith('/src/cloud/availability.ts'))return;
  const needle='export const cloudFeaturesEnabled:boolean=false;';
  if(code.split(needle).length!==2)throw Error('Cloud suspension source changed');
  return code.replace(needle,'export const cloudFeaturesEnabled:boolean=true;');
 },transformIndexHtml:html=>html.replace('<title>DND 角色卡 · 单机版</title>','<title>DND 角色卡 · 本地云端试验</title>')};
}
export default defineConfig(async env=>mergeConfig(await (typeof base==='function'?base({...env,mode:'standalone'}):base),{
 plugins:[cloudStageOneProfile()],
 build:{outDir:'.local-evidence/cloud-stage1/site',emptyOutDir:true},
}));
