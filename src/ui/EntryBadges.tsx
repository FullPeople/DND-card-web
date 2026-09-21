import type { Entry } from '../core/model';
export function EntryBadges({ entry }: { entry: Entry }) {
  const { weight, value } = entry.raw;
  if (typeof weight !== 'number' && typeof value !== 'number') return null;
  return <span className="entry-badges">{typeof value === 'number' && <span aria-label="价格">{value / 100} gp</span>}{typeof weight === 'number' && <span aria-label="重量">{weight} 磅</span>}</span>;
}
