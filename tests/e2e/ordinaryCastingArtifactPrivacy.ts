import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import type {Locator,TestInfo} from '@playwright/test';
import {ordinaryBrowserInputSetSha256} from './ordinaryCastingBrowserFixture';
export {canonicalJsonSha256} from './reviewedObservantArtifactPrivacy';
export const ORDINARY_INPUT_ANNOTATION='ordinary-verified-input-set-sha256',ORDINARY_PRODUCT_ANNOTATION='ordinary-verified-product-sha256';
// The replay ledger owns these source pins. A second handwritten actor lock can
// silently remain on an ancestor after supported casting routes are composed.
export function ordinaryActorBinding(report:{consumer:{revision:string;modules:{path:string;sha256:string}[]}}){
 if(!/^[a-f0-9]{40}$/.test(report.consumer.revision))throw Error('Ordinary consumer revision is not pinned');
 const hash=(path:string)=>{const rows=report.consumer.modules.filter(row=>row.path===path);if(rows.length!==1||!/^[a-f0-9]{64}$/.test(rows[0].sha256))throw Error('Ordinary actor is missing or ambiguous in the replay ledger');return rows[0].sha256;};
 return {module:hash('src/core/automation/ordinarySpellCasting.ts'),actions:hash('src/core/automation/actions.ts')};
}
const actorBinding=ordinaryActorBinding(JSON.parse(readFileSync(new URL('../../docs/data/automation-runtime-coverage.json',import.meta.url),'utf8')));
export const ORDINARY_MODULE_SHA256=actorBinding.module,ORDINARY_ACTIONS_SHA256=actorBinding.actions;
export const ORDINARY_PRODUCT_SHA256=createHash('sha256').update(JSON.stringify([ORDINARY_MODULE_SHA256,ORDINARY_ACTIONS_SHA256])).digest('hex');
export const ordinaryPixelStages=['wizard-ready','wizard-spent','wizard-exhausted','wizard-reopen','sorcerer-spent','cantrip-recorded','pact-spent','readonly-held','source-held','caster-required','caster-selected','save-failure'] as const;
export function ordinarySafeDirectory(identity:{id:string;project:string;outputDir:string}){const run=process.env.ORDINARY_CASTING_ARTIFACT_RUN;if(!run||!/^[a-zA-Z0-9-]+$/.test(run)||!/^[a-zA-Z0-9-]+$/.test(identity.project))throw Error('Invalid ordinary evidence identity');return resolve(identity.outputDir,'..','ordinary-casting-browser-safe',run,identity.project,createHash('sha256').update(identity.id).digest('hex').slice(0,24));}
export async function captureOrdinaryControl(control:Locator,info:TestInfo,stage:typeof ordinaryPixelStages[number]){if(!ordinaryPixelStages.includes(stage))throw Error('Unknown ordinary safe pixel stage');const directory=ordinarySafeDirectory({id:info.testId,project:info.project.name,outputDir:info.project.outputDir});mkdirSync(directory,{recursive:true});await control.screenshot({path:join(directory,stage+'.png'),animations:'disabled',style:'body * {visibility:hidden !important} [data-ordinary-spell-actions], [data-ordinary-spell-actions] * {visibility:visible !important}'});}
export function ordinarySafeReceipt(input:{id:string;title:string;project:string;status:string;expectedStatus:string;retry:number;durationMs:number;inputsVerified:boolean;productVerified:boolean}){return{schemaVersion:1,suite:'ordinaryCasting.spec.ts',testIdSha256:createHash('sha256').update(input.id).digest('hex'),title:input.title,project:input.project,status:input.status,expectedStatus:input.expectedStatus,retry:input.retry,durationMs:input.durationMs,inputSetSha256:ordinaryBrowserInputSetSha256,inputHashesVerified:input.inputsVerified,ordinaryModuleSha256:ORDINARY_MODULE_SHA256,actionsModuleSha256:ORDINARY_ACTIONS_SHA256,productHashesVerified:input.productVerified,rawArtifactsPublished:false,pixels:'authored ordinary action controls only'};}
