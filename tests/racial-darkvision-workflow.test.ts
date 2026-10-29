import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
for(const name of ['web','automation-progress','infusion-controls']){
 it(`${name} exports the explicit racial cache only after the same full original-source materialization`,()=>{
  const text=read(`.github/workflows/${name}.yml`);
  const ordinary=[...text.matchAll(/'ORDINARY_CASTING_FROZEN_DIR=([^']+)'/g)];
  const racial=[...text.matchAll(/'RACIAL_DARKVISION_FROZEN_DIR=([^']+)'/g)];
  expect(ordinary).toHaveLength(1);expect(racial).toHaveLength(1);
  expect(racial[0][1]).toBe(ordinary[0][1]);
  const materialize=text.lastIndexOf('node tools/fetchReviewedAlertCorpus.mjs',racial[0].index);
  expect(materialize).toBeGreaterThanOrEqual(0);
  const block=text.slice(materialize,racial[0].index);
  expect(block).toContain(`--output ${racial[0][1]}`);
  expect(block).toContain('--report docs/data/automation-runtime-coverage.json');
  if(name==='infusion-controls'){
   // Required executable arguments remain mandatory when another independently
   // tested family is appended; an obsolete whole-line prefix is not the ABI.
   const commands=[...text.matchAll(/^\s*run: (node tools\/runVitest\.mjs run [^\n]+)$/gm)];
   const matches=commands.filter(row=>row.index!>racial[0].index!&&row[1].split(/\s+/).includes('tests/racial-darkvision*.test.ts'));
   expect(matches).toHaveLength(1);const args=matches[0][1].split(/\s+/);
   for(const required of ['tests/item-atwill*.test.ts','tests/racial-darkvision*.test.ts','tests/item-ability-floors*.test.ts','tests/racial-movement*.test.ts','--maxWorkers=1'])expect(args.filter(arg=>arg===required)).toHaveLength(1);
   expect(args.slice(0,3)).toEqual(['node','tools/runVitest.mjs','run']);
   expect(args.filter(arg=>arg.startsWith('--'))).toEqual(['--maxWorkers=1']);
   expect(args.slice(3).every(arg=>arg==='--maxWorkers=1'||/^tests\/[A-Za-z0-9_*\/.\-]+\.test\.ts$/.test(arg))).toBe(true);
  }else expect(text.indexOf('npm run check',racial[0].index)).toBeGreaterThan(racial[0].index!);
 });
}
it('keeps the original229 materializer, explicit fixture variable and hard source failures',()=>{
 const materializer=read('tools/fetchReviewedAlertCorpus.mjs');
 expect(materializer).toContain('export const INPUT_COUNT=229;');
 expect(materializer).toContain('const index={rows:rows.map(row=>({url:row.url,sha256:row.sha256,path:`files/${row.sha256}.json`}))};');
 const helper=read('tests/helpers/racialDarkvisionFixture.ts');
 expect(helper).toMatch(/export const racialDarkvisionDirectory=process\.env\.RACIAL_DARKVISION_FROZEN_DIR;/);
 expect(helper).toContain("throw Error('RACIAL_DARKVISION_FROZEN_DIR required')");
 expect(helper).toContain("throw Error('Original racial source SHA mismatch')");
 for(const path of ['tests/racial-darkvision.test.ts','tests/racial-darkvision-source.test.ts','tests/racial-darkvision-ui.test.ts']){
  expect(read(path)).not.toMatch(/\b(?:describe|it|test)\s*\.\s*(?:skip(?:If)?|only|todo)\b/);
 }
});
