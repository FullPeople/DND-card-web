import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const workflow=readFileSync('.github/workflows/infusion-controls.yml','utf8');
it('normal test entry starts installed Vitest through the child-only guarded Node wrapper',()=>{expect(pkg.scripts.test).toBe('node tools/runVitest.mjs run');expect(pkg.scripts.check).toBe('npm run test && npm run build');});
it('all directed rules unit invocations use the same guarded wrapper without globally disabling materializer or build fetch',()=>{const lines=workflow.split('\n').filter(line=>/^\s+run:.*(?:vitest|runVitest)/.test(line));expect(lines.length).toBeGreaterThanOrEqual(4);for(const line of lines)expect(line).toContain('node tools/runVitest.mjs run ');expect(workflow).not.toMatch(/(?:GITHUB_ENV|export)[^\n]*NODE_OPTIONS/);});
