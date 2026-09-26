import {describe,it,expect} from 'vitest';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {normalizeData} from '../src/data/catalog';
import {EQUIPMENT_TRAINING_ENTRIES} from '../src/data/weaponTraining';
import {startingProficiencyEntries} from '../src/core/proficiencyText';
import {spellLearners} from '../src/core/spellLearners';
import {exportCharacter} from '../src/core/export';
import {newCharacter} from '../src/core/model';
import {normalizeLegacyUpload} from '../src/platform/legacyPlayerBridge';
import {readCharacterTransfer} from '../src/core/transfers';
describe('equipment and unified transfer follow-up',()=>{
 it('translates the reported proficiency shapes, removes duplicate structured mirrors, and preserves explicit references',()=>{
  const lines=startingProficiencyEntries({source:'PHB',startingProficiencies:{skills:[{choose:{from:['animal handling','athletics'],count:3}}],weapons:['简易','军用','{@item 匕首|phb|匕首}'],armor:['light','medium','shield'],armorProficiencies:[{light:true,medium:true,shield:true}],tools:['vehicles (land)']}});
  expect(lines).toHaveLength(4);expect(lines.join('\n')).toContain('从驯兽、运动中选择 3 项');expect(lines.join('\n')).toContain('{@item 匕首|phb|匕首}');
  for(const word of ['简易武器','军用武器','盾牌','陆上载具'])expect(lines.join('\n')).toContain(word);
  expect(lines.join('\n')).not.toMatch(/armorProficiencies|animal handling|vehicles \(land\)|shield/);
 });
 it('keeps every equipment category separate by edition and sends armor, weapons and tools to their own row',()=>{
  expect(new Set(EQUIPMENT_TRAINING_ENTRIES.map(e=>e.id)).size).toBe(34);
  for(const source of ['PHB','XPHB'])for(const name of ['轻甲','中甲','重甲','盾牌','军用武器','简易武器','工匠工具','乐器','陆上载具'])expect(EQUIPMENT_TRAINING_ENTRIES.some(e=>e.source===source&&e.name===name)).toBe(true);
 });
 it('lists same-name learners from separate books and preserves subclass identity',()=>{
  const [spell]=normalizeData({spell:[{name:'自制测试术',source:'XPHB',_spellSources:{class:{PHB:{法师:true},XPHB:{法师:true}},subclass:{PHB:{战士:{PHB:{奥法:{name:'奥法骑士'}}}}},feat:{XPHB:{魔法学徒:true}}}}]},'1');
  const groups=spellLearners(spell);expect(groups.find(g=>g.label==='职业')?.learners).toHaveLength(2);expect(groups.find(g=>g.label==='子职')?.learners[0].reference).toBe('战士|PHB|战士：奥法骑士|奥法|PHB');expect(groups.find(g=>g.label==='专长')?.learners[0].name).toBe('魔法学徒');
 });
 it('uploads the one native format through the old host and back without losing identity, runtime or source restrictions',()=>{
  const c=newCharacter('2014');c.name='共同备份';c.training={weapons:'{@item 匕首|PHB}'};c.runtime.resources={daily:{current:0,max:2}};c.selections=[{id:'source-selection',entry:EQUIPMENT_TRAINING_ENTRIES[0],level:1,quantity:1,equipped:false}];c.profile.enabledSources=[];
  const document=normalizeLegacyUpload(exportCharacter(c));const [restored]=readCharacterTransfer([JSON.stringify(document)]);
  expect(restored.selections).toEqual(c.selections);expect(restored.training).toEqual(c.training);expect(restored.runtime.resources.daily.current).toBe(0);expect(restored.profile.enabledSources).toEqual([]);expect(restored.edition).toBe('2014');
 });
 it.skipIf(!process.env.CLASS_AUDIT_DIR)('reads all fetched class files and requires their starting sections to be before the original body',()=>{
  const directory=process.env.CLASS_AUDIT_DIR!,files=readdirSync(directory).filter(f=>f.startsWith('class-')&&f.endsWith('.json'));
  expect(files.length).toBeGreaterThanOrEqual(15);
  const report=files.flatMap(file=>normalizeData(JSON.parse(readFileSync(join(directory,file),'utf8')),'real-class-audit').filter(e=>e.kind==='class').map(entry=>{
    const names=entry.entries.map((v:any)=>v?.name||'');if(entry.raw.startingProficiencies)expect(names[0],`${file}: ${entry.name}`).toBe('起始熟练项');if(entry.raw.startingEquipment)expect(names.slice(0,2)).toContain('起始装备');
    const first=entry.entries[0] as any;if(first?.name==='起始熟练项')expect(JSON.stringify(first)).not.toMatch(/armorProficiencies|weaponProficiencies|skillProficiencies|animal handling|vehicles \(land\)/);
    return {file,name:entry.name,source:entry.source,sections:names.slice(0,2),passed:true};
  }));
  if(process.env.CLASS_AUDIT_RECEIPT)writeFileSync(process.env.CLASS_AUDIT_RECEIPT,JSON.stringify(report,null,2));
 });
});
