import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import assert from 'node:assert/strict';
const root = dirname(fileURLToPath(import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const expected = {
  'index.html': '18b1f8fba9396e72fc89455924bdd26b0927e5b05120ae3fa61d1e5df1c14756',
  '1.PNG': '40d81d05690b0fae1bb39c3bfe404aeadf35a7bffc28627bb7fe3685a0e67d26',
  '2.PNG': 'd876c79b17189f092fb0519479e06109542e2fc84b9315b5212def431140134a',
  '3.PNG': 'd4094577e2154933d41d43278a05ba899ee27186676f3d5e1ac0aa75454dee41',
  '4.PNG': '3b11e47126df35825dc2af8a6f4bfd9cd3000555a0c0d8ae87e1df4d0ad42fee',
};
const bytes = readFileSync(join(root, 'index.html'));
assert.equal(sha(bytes), expected['index.html'], 'Accepted v4 HTML has changed');
const html = bytes.toString('utf8');
const layers = [...html.matchAll(/<img class="piece p(\d)" src="data:image\/png;base64,([^"]+)"/g)];
assert.equal(layers.length, 4);
for (const [, id, data] of layers) {
  const filename = `${{ 1: 4, 2: 1, 3: 2, 4: 3 }[id]}.PNG`;
  const source = readFileSync(join(root, 'assets', filename));
  assert.equal(sha(source), expected[filename], `${filename}: source hash differs`);
  assert.deepEqual(Buffer.from(data, 'base64'), source, `${filename}: embedded bytes differ`);
  assert.equal(source.readUInt32BE(16), 500);
  assert.equal(source.readUInt32BE(20), 500);
}
new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
assert.ok(html.includes('0%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r))}'));
assert.ok(html.includes('100%{opacity:1;transform:translate(0,0) rotate(0)}'));
assert.ok(html.includes('prefers-reduced-motion:reduce'));
console.log('PASS: accepted v4 HTML, all four original 500×500 PNGs, embedded bytes, script syntax and animation endpoints.');
console.log('This is a source/integrity check, not browser playback or product integration testing.');
