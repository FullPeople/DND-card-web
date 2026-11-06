import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {classSpellFilterSource} from '../src/data/classSpellCatalog';

it('native Node imports the actual class catalog metadata and agrees with every bundled source identity',()=>{
 const metadata=JSON.parse(readFileSync(resolve('src/data/classSpellFilterSources.json'),'utf8'));
 const sources=[...new Set<string>([...Object.keys(metadata.abbreviations),...Object.keys(metadata.homebrewSources)])].sort();
 const url=pathToFileURL(resolve('src/data/classSpellCatalog.ts')).href;
 const script=`import {classSpellFilterSource} from ${JSON.stringify(url)};process.stdout.write(JSON.stringify(${JSON.stringify(sources)}.map(source=>classSpellFilterSource({},source))));`;
 const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',script],{encoding:'utf8',timeout:4000});
 expect(result.error).toBeUndefined();expect(result.status,`Native class source import failed: ${result.stderr.slice(0,600)}`).toBe(0);
 expect(JSON.parse(result.stdout)).toEqual(sources.map(source=>classSpellFilterSource({},source)));
});
