import {basename,join} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import type {Reporter,TestCase,TestResult} from '@playwright/test/reporter';
import {ALERT_FEAT_ANNOTATION,ALERT_FEAT_RAW_SHA256,ALERT_SOURCE_ANNOTATION,ALERT_WIZARD_SHA256,alertSafeArtifactDirectory,alertSafeReceipt} from './reviewedAlertArtifactPrivacy';
export default class ReviewedAlertPrivacyReporter implements Reporter{
 onTestEnd(test:TestCase,result:TestResult){
  if(basename(test.location.file)!=='alertControls.spec.ts')return;
  const project=test.parent.project();if(!project)throw Error('Missing Alert evidence project');
  const receipt=alertSafeReceipt({id:test.id,title:test.title,project:project.name,status:result.status,expectedStatus:test.expectedStatus,retry:result.retry,durationMs:result.duration,sourceVerified:test.annotations.some(row=>row.type===ALERT_SOURCE_ANNOTATION&&row.description===ALERT_WIZARD_SHA256),featSourceVerified:test.annotations.some(row=>row.type===ALERT_FEAT_ANNOTATION&&row.description===ALERT_FEAT_RAW_SHA256)});
  const directory=alertSafeArtifactDirectory({id:test.id,project:project.name,outputDir:project.outputDir});mkdirSync(directory,{recursive:true});writeFileSync(join(directory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 }
}
