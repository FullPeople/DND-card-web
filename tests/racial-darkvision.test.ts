import {expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {racialDarkvisionFixture,racialDarkvisionDigest} from './helpers/racialDarkvisionFixture';

it('projects actual PHB Dwarf darkvision without changing saved or manual data',()=>{
 const {c}=racialDarkvisionFixture(),before=racialDarkvisionDigest(c);
 expect((evaluate(c) as any).senses?.darkvision).toBe(60);
 expect(racialDarkvisionDigest(c)).toBe(before);
});
