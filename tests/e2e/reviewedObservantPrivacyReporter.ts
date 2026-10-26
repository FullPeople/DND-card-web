import {basename,join} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import type {Reporter,TestCase,TestResult} from '@playwright/test/reporter';
import {OBSERVANT_FEAT_ANNOTATION,OBSERVANT_FEAT_RAW_SHA256,OBSERVANT_SOURCE_ANNOTATION,OBSERVANT_WIZARD_SHA256,observantSafeArtifactDirectory,observantSafeReceipt} from './reviewedObservantArtifactPrivacy';
/** The old 114-case evidence is untouched. Only the new real-source suite
 * emits metadata-only public receipts; its complete raw failure files stay local. */
export default class ReviewedObservantPrivacyReporter implements Reporter{
 onTestEnd(test:TestCase,result:TestResult){
  if(basename(test.location.file)!=='observantControls.spec.ts')return;
  const project=test.parent.project();if(!project)throw Error('Missing Observant evidence project');
  const receipt=observantSafeReceipt({id:test.id,title:test.title,project:project.name,status:result.status,expectedStatus:test.expectedStatus,retry:result.retry,durationMs:result.duration,sourceVerified:test.annotations.some(row=>row.type===OBSERVANT_SOURCE_ANNOTATION&&row.description===OBSERVANT_WIZARD_SHA256),featSourceVerified:test.annotations.some(row=>row.type===OBSERVANT_FEAT_ANNOTATION&&row.description===OBSERVANT_FEAT_RAW_SHA256)});
  const directory=observantSafeArtifactDirectory({id:test.id,project:project.name,outputDir:project.outputDir});mkdirSync(directory,{recursive:true});writeFileSync(join(directory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 }
}
