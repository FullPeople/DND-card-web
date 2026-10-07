import {describe,it,expect} from 'vitest';
import {releaseHistoryFor,releaseLogFor} from '../src/platform/releaseNotes';

describe('date-grouped changelog',()=>{
 for(const mode of ['standalone','suite'] as const){
  it(`${mode} merges every same-date batch and preserves unrelated changes`,()=>{
   const before=JSON.stringify(releaseHistoryFor(mode)),log=releaseLogFor(mode);
   expect(log.map(day=>day.title)).toEqual([...new Set(releaseHistoryFor(mode).map(day=>day.title.slice(0,10)))]);
   for(const day of log){expect(day.title).toMatch(/^\d{4}-\d{2}-\d{2}$/);const items=day.sections.flatMap(section=>section.items);expect(new Set(items).size).toBe(items.length);}
   const latest=log[0].sections.flatMap(section=>section.items).join('\n');
   expect(latest).toContain('修复战俑等来源的工具选择没有列出可用工具的问题。');
   expect(latest).not.toContain('战俑工具选择仍待处理');
   expect(latest).toContain('实体手机和玩家原设备仍待验证。');
   expect(latest).toContain('感谢「别名」支持 50 元。');
   expect(latest).toContain('修复自动获得的盾牌熟练在保存后丢失的问题');
   expect(JSON.stringify(releaseHistoryFor(mode))).toBe(before);
  });
 }
 it('keeps Suite-only changes in the Suite changelog',()=>{
  expect(JSON.stringify(releaseLogFor('suite')[0])).toContain('新旧插件都移除了“编辑地图迷雾”右键入口');
  expect(JSON.stringify(releaseLogFor('standalone')[0])).not.toContain('编辑地图迷雾');
 });
});
