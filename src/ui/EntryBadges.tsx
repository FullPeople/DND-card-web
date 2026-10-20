import type { Entry } from '../core/model';
export function EntryBadges({ entry }: { entry: Entry }) {
  const { weight, value } = entry.raw;
  const ordinal=Number.isSafeInteger(entry.raw._catalogDefinitionOrdinal)&&entry.raw._catalogDefinitionOrdinal>0?entry.raw._catalogDefinitionOrdinal:undefined;
  if (typeof weight !== 'number' && typeof value !== 'number'&&!entry.raw._catalogConflict&&!entry.raw._catalogPresentationVariant) return null;
  return <span className="entry-badges">{entry.raw._catalogConflict&&<span role="status">同源定义待核对{ordinal?` · 记录 ${ordinal}`:''}</span>}{entry.raw._catalogPresentationVariant&&<span>展示资料有差异{ordinal?` · 记录 ${ordinal}`:''}</span>}{typeof value === 'number' && <span aria-label="价格">{value / 100} gp</span>}{typeof weight === 'number' && <span aria-label="重量">{weight} 磅</span>}</span>;
}
