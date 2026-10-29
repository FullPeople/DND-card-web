import {createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import type {Locator,TestInfo} from '@playwright/test';
export {canonicalJsonSha256} from './reviewedObservantArtifactPrivacy';

export const ALERT_WIZARD_SHA256='7533f3fb7bab70cd2d2f2b5dfb7e259dc66a2bfee24ee6ad3809042e53ba8a03';
export const ALERT_FEAT_INPUT_SHA256='0491b421f5f1db6628c3a8aeb86bbc3b72b56bf101a14ba96acbe19c829a56a6';
export const ALERT_FEAT_RAW_SHA256='ec04be9d83de80d0ca3d2d84a688c6e6b08465be38700627a1bcbdfea266049c';
export const ALERT_SOURCE_ANNOTATION='alert-verified-source-sha256';
export const ALERT_FEAT_ANNOTATION='alert-verified-feat-source-sha256';
type Identity={id:string;project:string;outputDir:string};
export function alertSafeArtifactDirectory(identity:Identity){
 const run=process.env.REVIEWED_ALERT_ARTIFACT_RUN;
 if(!run||!/^[a-zA-Z0-9-]+$/.test(run))throw Error('Missing safe Alert evidence run identity');
 if(!/^[a-zA-Z0-9-]+$/.test(identity.project))throw Error('Invalid Alert evidence project');
 return resolve(identity.outputDir,'..','alert-browser-safe',run,identity.project,createHash('sha256').update(identity.id).digest('hex').slice(0,24));
}
function screenshotPath(info:TestInfo,stage:string){
 if(!/^[a-z0-9-]+$/.test(stage))throw Error('Invalid authored screenshot stage');
 const directory=alertSafeArtifactDirectory({id:info.testId,project:info.project.name,outputDir:info.project.outputDir});
 mkdirSync(directory,{recursive:true});return join(directory,stage+'.png');
}
// Only authored controls and numeric cells are public; never real source text,
// full cards, traces or matcher objects. Visibility masking changes no geometry.
const isolate=(selector:string)=>`body * {visibility:hidden !important} ${selector}, ${selector} * {visibility:visible !important}`;
export async function captureAuthoredAlertControl(control:Locator,info:TestInfo,stage:string){
 await control.screenshot({path:screenshotPath(info,stage+'-control'),animations:'disabled',style:isolate('[data-reviewed-feat-kind="alert"]')});
}
export async function captureAuthoredAlertOverview(panel:Locator,info:TestInfo,stage:string){
 for(const [suffix,selector] of [['dex','.ability-dex'],['initiative','.initiative-cell']])
  await panel.locator(selector).screenshot({path:screenshotPath(info,stage+'-'+suffix),animations:'disabled',style:isolate('.paper[data-active-sheet="true"] '+selector)});
}
export type AlertSafeReceiptInput={id:string;title:string;project:string;status:string;expectedStatus:string;retry:number;durationMs:number;sourceVerified:boolean;featSourceVerified:boolean};
export function alertSafeReceipt(input:AlertSafeReceiptInput){
 return {schemaVersion:1,suite:'alertControls.spec.ts',testIdSha256:createHash('sha256').update(input.id).digest('hex'),title:input.title,project:input.project,status:input.status,expectedStatus:input.expectedStatus,retry:input.retry,durationMs:input.durationMs,sourceCanonicalSha256:ALERT_WIZARD_SHA256,sourceHashVerified:input.sourceVerified&&input.featSourceVerified,featInputCanonicalSha256:ALERT_FEAT_INPUT_SHA256,featRawSha256:ALERT_FEAT_RAW_SHA256,rawArtifactsPublished:false,pixels:'authored control / DEX / initiative cell only'};
}
