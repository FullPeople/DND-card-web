import {createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import type {Locator,TestInfo} from '@playwright/test';
import {linguistTrainingRow} from './reviewedLinguistLocators';
export const LINGUIST_WIZARD_SHA256='7533f3fb7bab70cd2d2f2b5dfb7e259dc66a2bfee24ee6ad3809042e53ba8a03';
export const LINGUIST_SOURCE_ANNOTATION='linguist-verified-source-sha256';
/** Compare the complete JSON state without a public matcher diff containing
 * real source snapshots. No fields are omitted; object keys are canonicalized
 * recursively while array order and every JSON value remain significant. */
export function canonicalJsonSha256(value:unknown){
 const canonical=JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
 if(canonical===undefined)throw Error('Expected a JSON state for the private equality assertion');
 return createHash('sha256').update(canonical).digest('hex');
}
type Identity={id:string;project:string;outputDir:string};
/** An independent, run-scoped allowlist directory. Never put raw traces,
 * full-card screenshots, errors, attachments or source objects in this tree. */
export function linguistSafeArtifactDirectory(identity:Identity){
 const run=process.env.REVIEWED_LINGUIST_ARTIFACT_RUN;
 if(!run||!/^[a-zA-Z0-9-]+$/.test(run))throw Error('Missing safe Linguist evidence run identity');
 if(!/^[a-zA-Z0-9-]+$/.test(identity.project))throw Error('Invalid Linguist evidence project');
 return resolve(identity.outputDir,'..','linguist-browser-safe',run,identity.project,createHash('sha256').update(identity.id).digest('hex').slice(0,24));
}
function screenshotPath(info:TestInfo,stage:string){
 if(!/^[a-z0-9-]+$/.test(stage))throw Error('Invalid authored screenshot stage');
 const directory=linguistSafeArtifactDirectory({id:info.testId,project:info.project.name,outputDir:info.project.outputDir});mkdirSync(directory,{recursive:true});return join(directory,stage+'.png');
}
/** These locators contain only project-authored UI, character numbers and
 * bounded language labels. Screenshot-only visibility masking prevents external
 * overlays/clipped ancestors from exposing publisher prose; layout is unchanged.
 * Full real Wizard prose remains in private outputs. */
const isolateAuthoredPixels=(selector:string)=>`body * {visibility:hidden !important} ${selector}, ${selector} * {visibility:visible !important}`;
export async function captureAuthoredLinguistControl(control:Locator,info:TestInfo,stage:string){
 await control.screenshot({path:screenshotPath(info,stage+'-control'),animations:'disabled',style:isolateAuthoredPixels('[data-reviewed-feat-kind="linguist"]')});
}
export async function captureAuthoredLinguistOverview(panel:Locator,info:TestInfo,stage:string){
 await panel.locator('.ability-int').screenshot({path:screenshotPath(info,stage+'-int'),animations:'disabled',style:isolateAuthoredPixels('.paper[data-active-sheet="true"] .ability-int')});
 await linguistTrainingRow(panel).screenshot({path:screenshotPath(info,stage+'-languages'),animations:'disabled',style:isolateAuthoredPixels('.paper[data-active-sheet="true"] .training-cell')});
}
export type LinguistSafeReceiptInput={id:string;title:string;project:string;status:string;expectedStatus:string;retry:number;durationMs:number;sourceVerified:boolean};
/** Construct the public receipt field-by-field: spreading test/result objects
 * would leak attachment bodies, full snapshots, evaluation args and diffs. */
export function linguistSafeReceipt(input:LinguistSafeReceiptInput){return {schemaVersion:1,suite:'linguistControls.spec.ts',testIdSha256:createHash('sha256').update(input.id).digest('hex'),title:input.title,project:input.project,status:input.status,expectedStatus:input.expectedStatus,retry:input.retry,durationMs:input.durationMs,sourceCanonicalSha256:LINGUIST_WIZARD_SHA256,sourceHashVerified:input.sourceVerified,rawArtifactsPublished:false,pixels:'authored control / INT / language regions only'};}
