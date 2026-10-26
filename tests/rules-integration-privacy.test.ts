import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {safeRuleResult} from './e2e/rulesIntegrationPrivacyReporter';

it('reports every rule browser outcome without serializing source, characters, errors or attachments',()=>{
 const receipt=safeRuleResult({id:'authored-test',suite:'skilledControls.spec.ts',title:'Authored case',project:'narrow',status:'failed',expectedStatus:'passed',retry:0,durationMs:123,errors:[{message:'PRIVATE_SOURCE_BODY'}],attachments:[{body:'PRIVATE_CARD'}],stdout:'PRIVATE_SOURCE_BODY',character:{notes:'PRIVATE_CARD'}} as any);
 expect(receipt).toMatchObject({status:'failed',expectedStatus:'passed',retry:0,rawArtifactsPublished:false});
 expect(Object.keys(receipt)).toEqual(['schemaVersion','testIdSha256','suite','title','project','status','expectedStatus','retry','durationMs','rawArtifactsPublished']);
 expect(JSON.stringify(receipt)).not.toMatch(/PRIVATE_SOURCE_BODY|PRIVATE_CARD/);
});

it('never uploads any raw source-bearing browser tree, while retaining safe receipts and approved crops',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/infusion-controls.yml',import.meta.url),'utf8');
 const paths=workflow.slice(workflow.lastIndexOf('          path: |')).split('\n').map(line=>line.trim());
 expect(paths).not.toContain('.local-evidence/infusion-browser/');
 expect(paths).toContain('.local-evidence/rules-browser-safe/');
 expect(paths).toContain('.local-evidence/linguist-browser-safe/');
 const asiWorkflow=readFileSync(new URL('../.github/workflows/asi-allocation.yml',import.meta.url),'utf8');
 const asiPaths=asiWorkflow.slice(asiWorkflow.lastIndexOf('          path: |')).split('\n').map(line=>line.trim());
 expect(asiPaths).not.toContain('.local-evidence/asi-browser/');
 expect(asiPaths).toContain('.local-evidence/rules-browser-safe/');
 expect(asiPaths).toContain('.local-evidence/asi-source-verification.json');
 const config=readFileSync(new URL('../playwright.infusions.config.ts',import.meta.url),'utf8');
 expect(config).toContain("['./tests/e2e/rulesIntegrationPrivacyReporter.ts']");
 expect(config).toContain('workers:1,retries:0');
});
