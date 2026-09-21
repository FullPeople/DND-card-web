import { createContext, useContext } from 'react';
import { signed, type Character, type SheetBonus } from '../core/model';

export const SheetEditContext = createContext(false);
export function AdjustedValue({ c, value, target, label, sign, unit, edit }: { c: Character; value: number; target: SheetBonus; label: string; sign?: boolean; unit?: string; edit: (action: (draft: Character) => void, key?: string) => void }) {
  const editing = useContext(SheetEditContext), bonus = c.sheetBonuses?.[target] || 0;
  return <div className={`adjusted-value ${editing || bonus ? 'has-adjustment' : ''}`}>
    <strong data-stat={target}>{sign ? signed(value) : value}{unit && <small>{unit}</small>}</strong>
    {(editing || bonus !== 0) && <label className="stat-adjustment"><span>调整</span>{editing ? <input aria-label={`${label}调整值`} type="number" min="-9999" max="9999" value={bonus} onChange={e => { const amount = Math.max(-9999, Math.min(9999, Number(e.target.value) || 0)); edit(draft => { (draft.sheetBonuses ||= {})[target] = amount; }, `bonus:${target}`); }}/> : <span className="adjustment-number">{signed(bonus)}</span>}</label>}
  </div>;
}
