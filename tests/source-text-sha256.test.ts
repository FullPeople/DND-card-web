import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {sourceTextSha256} from '../src/core/automation/sourceTextSha256';
it.each(['','abc','汉字🙂𝄞','a'.repeat(55),'a'.repeat(56),'a'.repeat(63),'a'.repeat(64),'a'.repeat(65),'a'.repeat(1000),'\ud800','\0\u00ff'])('portable synchronous source hash matches independent UTF8 SHA256 (%#)',text=>{expect(sourceTextSha256(text)).toBe(createHash('sha256').update(text).digest('hex'));});
it('matches the published SHA256 empty and abc vectors',()=>{expect(sourceTextSha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');expect(sourceTextSha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');});
