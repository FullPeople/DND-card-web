import {basename,join} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import type {Reporter,TestCase,TestResult} from '@playwright/test/reporter';
import {LINGUIST_SOURCE_ANNOTATION,LINGUIST_WIZARD_SHA256,linguistSafeArtifactDirectory,linguistSafeReceipt} from './reviewedLinguistArtifactPrivacy';
/** The old 104-case evidence is untouched. Only the new real-source suite
 * emits metadata-only public receipts; its complete raw failure files stay local. */
export default class ReviewedLinguistPrivacyReporter implements Reporter{
 onTestEnd(test:TestCase,result:TestResult){
  if(basename(test.location.file)!=='linguistControls.spec.ts')return;
  const project=test.parent.project();if(!project)throw Error('Missing Linguist evidence project');
  const receipt=linguistSafeReceipt({id:test.id,title:test.title,project:project.name,status:result.status,expectedStatus:test.expectedStatus,retry:result.retry,durationMs:result.duration,sourceVerified:test.annotations.some(row=>row.type===LINGUIST_SOURCE_ANNOTATION&&row.description===LINGUIST_WIZARD_SHA256)});
  const directory=linguistSafeArtifactDirectory({id:test.id,project:project.name,outputDir:project.outputDir});mkdirSync(directory,{recursive:true});writeFileSync(join(directory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 }
}
