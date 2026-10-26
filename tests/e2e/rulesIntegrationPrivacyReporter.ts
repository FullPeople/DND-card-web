import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import type {Reporter,TestCase,TestResult} from '@playwright/test/reporter';

type SafeInput={id:string;suite:string;title:string;project:string;status:string;expectedStatus:string;retry:number;durationMs:number};
export function safeRuleResult(input:SafeInput){return {
 schemaVersion:1,testIdSha256:createHash('sha256').update(input.id).digest('hex'),suite:input.suite,
 title:input.title,project:input.project,status:input.status,expectedStatus:input.expectedStatus,
 retry:input.retry,durationMs:input.durationMs,rawArtifactsPublished:false,
};}

// Keep complete local failure evidence. Public artifacts contain only this
// explicit status allowlist and the separately reviewed Linguist pixel crops.
export default class RulesIntegrationPrivacyReporter implements Reporter{
 onTestEnd(test:TestCase,result:TestResult){
  const project=test.parent.project();if(!project)throw Error('Missing rules evidence project');
  const run=process.env.RULES_BROWSER_ARTIFACT_RUN||process.env.REVIEWED_LINGUIST_ARTIFACT_RUN;
  if(!run||!/^[a-zA-Z0-9-]+$/.test(run)||!/^[a-zA-Z0-9-]+$/.test(project.name))throw Error('Invalid rules evidence identity');
  const receipt=safeRuleResult({id:test.id,suite:basename(test.location.file),title:test.title,project:project.name,status:result.status,expectedStatus:test.expectedStatus,retry:result.retry,durationMs:result.duration});
  const directory=resolve(project.outputDir,'..','rules-browser-safe',run,project.name);
  mkdirSync(directory,{recursive:true});
  writeFileSync(join(directory,receipt.testIdSha256+'-'+result.retry+'.json'),JSON.stringify(receipt,null,2)+'\n');
 }
}
