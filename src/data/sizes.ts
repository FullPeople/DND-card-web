import { SIZE_LABELS, type Entry, type Edition, type Size } from '../core/model';

// Project-authored summaries, with rules attribution separate from the source text.
// The rules define combat space and carrying capacity, not universal body weights.
const english = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const widths = [2.5, 5, 5, 10, 15, 20], loads = [7.5, 15, 15, 30, 60, 120];
export const SIZE_ENTRIES: Entry[] = (['2014', '2024'] as Edition[]).flatMap(edition => (Object.entries(SIZE_LABELS) as [Size, string][]).map(([code, name], i) => ({
  id: `dnd-card.sizes:${edition}:${code}`, kind: 'rule', name, english: english[i], source: edition === '2014' ? 'PHB' : 'XPHB', edition,
  packId: 'dnd-card.sizes', revision: '1',
  entries: [
    { type: 'entries', name: '大小', entries: [`战斗占地：${widths[i]} × ${widths[i]} 尺${code === 'G' && edition === '2014' ? '或更大' : ''}。占地表示战斗中控制的空间，不等于身体的长宽或身高。`] },
    { type: 'entries', name: '负重', entries: [`携带上限：力量值 × ${loads[i]} 磅。推、拖、举起的重量上限：力量值 × ${loads[i] * 2} 磅。`] },
    { type: 'entries', name: '体重', entries: ['体型本身不对应统一的体重范围；具体体重由种族、生物描述或角色设定决定。'] },
  ],
  raw: { _category: 'size', size: code, _authoredBy: 'DND Card 项目整理', references: edition === '2014' ? ['https://www.dndbeyond.com/sources/dnd/basic-rules-2014/combat#CreatureSize', 'https://www.dndbeyond.com/sources/dnd/basic-rules-2014/using-ability-scores#LiftingandCarrying'] : ['https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game#CreatureSize', 'https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary#CarryingCapacity'] },
})));
export const sizeEntry = (edition: Edition, size: string) => SIZE_ENTRIES.find(e => e.edition === edition && e.raw.size === size);
