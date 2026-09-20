import { Fragment, type ReactNode } from 'react';
export function Inline({ text, onLink }: { text: string; onLink?: (name: string) => void }) {
  const parts: ReactNode[] = []; const regex = /\{@(\w+)(?:\s+([^{}]*))?\}/g; let cursor = 0; let match;
  while ((match = regex.exec(text))) {
    parts.push(text.slice(cursor, match.index)); const [all, tag, body = ''] = match; const args = body.split('|'); const label = args[2] || args[0];
    if (['spell', 'item', 'class', 'race', 'feat', 'condition', 'skill', 'sense', 'variantrule', 'optfeature', 'background'].includes(tag)) parts.push(<button key={match.index} className="inline-reference" onClick={() => onLink?.(args[0])}>{label}</button>);
    else if (['b', 'bold', 'strong'].includes(tag)) parts.push(<strong key={match.index}>{label}</strong>);
    else if (['i', 'italic', 'note'].includes(tag)) parts.push(<em key={match.index}>{label}</em>);
    else if (tag === 'dc') parts.push(`DC ${label}`);
    else if (tag === 'hit') parts.push(Number(label) >= 0 ? `+${label}` : label);
    else if (tag === 'h') parts.push('命中：');
    else if (tag === 'recharge') parts.push(`充能 ${label || '6'}`);
    else parts.push(label || '');
    cursor = match.index + all.length;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}
export function Entries({ value, onLink, depth = 0 }: { value: unknown; onLink?: (name: string) => void; depth?: number }): ReactNode {
  if (depth > 14 || value == null) return null;
  if (typeof value === 'string') return <p><Inline text={value} onLink={onLink}/></p>;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map((v, i) => <Fragment key={i}><Entries value={v} onLink={onLink} depth={depth + 1}/></Fragment>);
  if (typeof value !== 'object') return null;
  const v = value as Record<string, any>;
  if (v.type === 'table') return <div className="table-scroll">{v.caption && <p className="table-caption">{v.caption}</p>}<Entries value={v.intro} onLink={onLink} depth={depth + 1}/><table><thead><tr>{v.colLabels?.map((l: string, i: number) => <th key={i}><Inline text={l} onLink={onLink}/></th>)}</tr></thead><tbody>{v.rows?.map((row: any, i: number) => <tr key={i}>{(Array.isArray(row) ? row : row.row || []).map((cell: unknown, j: number) => <td key={j}><Entries value={cell} onLink={onLink} depth={depth + 1}/></td>)}</tr>)}</tbody></table><Entries value={v.footnotes} onLink={onLink} depth={depth + 1}/></div>;
  if (v.type === 'list') return <ul>{v.items?.map((item: unknown, i: number) => <li key={i}><Entries value={item} onLink={onLink} depth={depth + 1}/></li>)}</ul>;
  if (v.type === 'cell' && v.roll) return `${v.roll.exact ?? `${v.roll.min}–${v.roll.max}`}`;
  if (v.type?.startsWith('ref')) { const ref = v.classFeature || v.subclassFeature || v.optionalfeature; return ref ? <p><button className="inline-reference" onClick={() => onLink?.(ref.split('|')[0])}>{ref.split('|')[0]}</button></p> : null; }
  return <section className={['inset', 'insetReadaloud', 'quote'].includes(v.type) ? 'entry-inset' : 'entry-section'}>{v.name && <h4><Inline text={v.name} onLink={onLink}/></h4>}<Entries value={v.entries || v.entry || v.items || v.text} onLink={onLink} depth={depth + 1}/>{v.by && <small>— {v.by}</small>}</section>;
}
