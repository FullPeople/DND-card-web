import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Playwright's native ESM collection must load the same source evidence that
// Vite and Vitest load. Exercise the actual import statement, not a substitute
// fixture, without printing evidence or publisher source bodies.
const sources=['ordinarySpellCasting.ts','limitedSourceUseSource.ts','itemChargeDebitSource.ts'];
const imports=sources.flatMap(file=>{
 const source=resolve('src/core/automation',file),text=readFileSync(source,'utf8');
 return [...text.matchAll(/^import\s+(\w+)\s+from\s+(['"])(\.\/[^'"]+\.json)\2(?:\s+with\s+\{[^\n]*\})?;$/gm)].map(match=>({file,binding:match[1],statement:match[0],relative:match[3],source}));
});

it('retains all five source-evidence import sites in the native compatibility gate',()=>{
 expect(imports).toHaveLength(5);
 expect(new Set(imports.map(row=>row.file))).toEqual(new Set(sources));
});

it.each(imports)('$file / $binding loads byte-identical evidence in native Node ESM',row=>{
 const evidence=resolve(dirname(row.source),row.relative),url=pathToFileURL(evidence).href;
 const statement=row.statement.replace(row.relative,url);
 const result=spawnSync(process.execPath,['--input-type=module','--eval',
  `import {createHash} from 'node:crypto';\n${statement}\nprocess.stdout.write(createHash('sha256').update(JSON.stringify(${row.binding})).digest('hex'));`
 ],{encoding:'utf8',timeout:4000});
 expect(result.error).toBeUndefined();
 expect(result.status,`native source import failed: ${result.stderr.slice(0,600)}`).toBe(0);
 const expected=createHash('sha256').update(JSON.stringify(JSON.parse(readFileSync(evidence,'utf8')))).digest('hex');
 expect(result.stdout).toBe(expected);
});
