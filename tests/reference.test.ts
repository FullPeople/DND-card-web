import { describe, test, expect } from 'vitest';
import { newCharacter, selectionAllowed } from '../src/core/model';
import { encodeProfile, decodeProfile } from '../src/core/profileCode';
import { expandCopies } from '../src/data/expand';
import { normalizeData } from '../src/data/catalog';

describe('reference profiles and inherited bestiary data',()=>{
 test('opaque profile code preserves exclusions and rejects corruption',async()=>{
  const c=newCharacter('2024');c.profile.disabledEntries=['kiwee:spell:example'];const data={version:1 as const,edition:c.edition,profile:c.profile,sourceDisplay:'full' as const};const code=await encodeProfile(data);
  expect(code).toMatch(/^DND1\.[\w-]+$/);expect(await decodeProfile(code)).toEqual(data);await expect(decodeProfile(code.slice(0,-5)+'xxxxx')).rejects.toThrow();
  const e=normalizeData({spell:[{name:'例',source:'XPHB'}]},'1')[0];c.profile.disabledEntries=[e.id];c.profile.exceptions[e.id]='DM许可';expect(selectionAllowed(c,e)).toBe(false);
 });
 test('monster copies combine cross-book parents, templates, text and action replacement without changing action keys',()=>{
  const template={name:'夜行',source:'T',apply:{_root:{speed:{walk:20}},_mod:{_:{mode:'addSenses',senses:{type:'darkvision',range:60}},trait:{mode:'appendArr',items:{name:'直觉',entries:['<$title_short_name$>的豁免为{@dc <$spell_dc__wis$>}。']}}}}};
  const base={name:'测试基础',source:'MM',hp:{average:20,formula:'3d8'},cr:'2',wis:14,action:[{name:'长剑',entries:['剑进行{@hit 3}的攻击。']}]};
  const copy={name:'测试变体',source:'OTHER',_copy:{name:'测试基础',source:'MM',_templates:[{name:'夜行',source:'T'}],_mod:{'*':{mode:'replaceTxt',replace:'剑',with:'刀'},action:[{mode:'replaceArr',replace:'长剑',items:{name:'短刀',entries:['刀进行{@hit 5}的攻击。']}},{mode:'scalarAddHit',scalar:-2}],hp:{mode:'scalarMultProp',prop:'average',scalar:.5,floor:true}}}};
  const expanded=expandCopies([base,copy],[template])[1];expect(expanded._copy).toBeUndefined();expect(expanded.hp.average).toBe(10);expect(expanded.action[0]).toEqual({name:'短刀',entries:['刀进行{@hit 3}的攻击。']});expect(expanded.trait[0].entries[0]).toBe('测试变体的豁免为{@dc 12}。');expect(expanded.senses).toEqual(['黑暗视觉 60尺']);expect(expanded.speed.walk).toBe(20);
  const e=normalizeData({monster:[expanded]},'audit')[0];expect(e.kind).toBe('monster');expect(JSON.stringify(e.entries)).toContain('短刀');expect(base.hp.average).toBe(20);
 });
 test('prototype modification paths remain untrusted',()=>{
  const copy={name:'bad',source:'A',_copy:{name:'base',source:'A',_mod:{_:{mode:'setProp',prop:'__proto__.polluted',value:true}}}};
  expect(expandCopies([{name:'base',source:'A'},copy])[1]._copy).toBeDefined();expect(({} as any).polluted).toBeUndefined();
 });
});
