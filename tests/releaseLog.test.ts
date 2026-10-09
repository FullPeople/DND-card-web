import {describe,it,expect} from 'vitest';
import {releaseHistoryFor,releaseLogFor} from '../src/platform/releaseNotes';

describe('date-grouped changelog',()=>{
 for(const mode of ['standalone','suite'] as const){
  it(`${mode} merges every same-date batch and preserves unrelated changes`,()=>{
   const before=JSON.stringify(releaseHistoryFor(mode)),log=releaseLogFor(mode);
   expect(log.map(day=>day.title)).toEqual([...new Set(releaseHistoryFor(mode).map(day=>day.title.slice(0,10)))]);
   for(const day of log){expect(day.title).toMatch(/^\d{4}-\d{2}-\d{2}$/);const items=day.sections.flatMap(section=>section.items);expect(new Set(items).size).toBe(items.length);}
   const latest=log.find(day=>day.title==='2026-10-07')!.sections.flatMap(section=>section.items).join('\n');
   expect(latest).toContain('修复战俑等来源的工具选择没有列出可用工具的问题。');
   expect(latest).not.toContain('战俑工具选择仍待处理');
   expect(latest).toContain('实体手机和玩家原设备仍待验证。');
   expect(latest).toContain('感谢「别名」支持 50 元。');
   expect(latest).toContain('修复自动获得的盾牌熟练在保存后丢失的问题');
   expect(JSON.stringify(releaseHistoryFor(mode))).toBe(before);
  });
 }
 it('adds current history and framing fixes while retaining the previous palette and gallery day',()=>{
  for(const mode of ['standalone','suite'] as const){const log=releaseLogFor(mode);expect(log[0].title).toBe(mode==='suite'?'2026-10-10':'2026-10-09');expect(JSON.stringify(log.find(day=>day.title==='2026-10-09'))).toContain('撤回与重做');expect(JSON.stringify(log.find(day=>day.title==='2026-10-08'))).toContain('保存和导入配色文件');}
  expect(JSON.stringify(releaseLogFor('standalone').find(day=>day.title==='2026-10-08'))).toContain('点击旁边的卡只切换');
 });
 it('keeps Suite-only changes in the Suite changelog',()=>{
  expect(JSON.stringify(releaseLogFor('suite')[0])).toContain('文字演出');
  expect(JSON.stringify(releaseLogFor('suite')[0])).toContain('Wiki 收藏');
  expect(JSON.stringify(releaseLogFor('standalone'))).not.toContain('文字演出');
  expect(JSON.stringify(releaseLogFor('suite').find(day=>day.title==='2026-10-07'))).toContain('新旧插件都移除了“编辑地图迷雾”右键入口');
  expect(JSON.stringify(releaseLogFor('standalone').find(day=>day.title==='2026-10-07'))).not.toContain('编辑地图迷雾');
 });
 it('shows the new standalone batch and supersedes the former cloud policy without rewriting history',()=>{
  const raw=JSON.stringify(releaseHistoryFor('standalone')),log=releaseLogFor('standalone');
  expect(log[0].title).toBe('2026-10-09');
  expect(JSON.stringify(log[0])).toContain('赞助二维码');
  expect(JSON.stringify(log)).toContain('三个标签');
  expect(JSON.stringify(log)).toContain('所有人都可以在云端看到所有卡');
  expect(JSON.stringify(log)).not.toContain('不公开全站目录');
  expect(JSON.stringify(log)).not.toContain('云端登录与保存暂不可用');
  expect(JSON.stringify(releaseHistoryFor('standalone'))).toBe(raw);
  expect(raw).toContain('不公开全站目录');
 });
});
