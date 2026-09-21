const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
    return JSON.stringify(value) ?? 'undefined';
};
const explicit = (v: unknown) => v && typeof v === 'object' && ['rowSpan', 'colSpan', 'rowspan', 'colspan'].some(key => Object.hasOwn(v, key));
const regular = (rows: unknown[][]) => rows.every(row => row.length === rows[0].length && !row.some(explicit));

/** Collapse consecutive levels only when every other cell is identical. */
export function compactLevelRows(rows: unknown[][], labels: unknown[] = []): unknown[][] {
  const levelColumn = labels.findIndex(label => typeof label === 'string' && /^(?:(?:职业|角色|人物)等级|等级|(?:class |character )?levels?)$/i.test(label.replace(/\{@(?:b|bold|strong) ([^{}]+)\}/g, '$1').trim()));
  if (levelColumn < 0 || !rows.length || !regular(rows) || rows[0].length < 2 || levelColumn >= rows[0].length) return rows;
  const level = (value: unknown): number => typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : typeof value === 'string' && /^[1-9]\d*$/.test(value.trim()) ? Number(value) : NaN;
  const keys = rows.map(row => canonical(row.filter((_, col) => col !== levelColumn)));
  const result: unknown[][] = [];
  for (let start = 0; start < rows.length;) {
    let end = start + 1;
    while (end < rows.length && level(rows[end][levelColumn]) === level(rows[end - 1][levelColumn]) + 1 && keys[end] === keys[start]) end++;
    const row = [...rows[start]];
    if (end > start + 1) row[levelColumn] = `${level(rows[start][levelColumn])}～${level(rows[end - 1][levelColumn])}`;
    result.push(row);
    start = end;
  }
  return result;
}

/** Merge only vertically adjacent, structurally identical cells. Raw data is never mutated. */
export function tableSpans(rows: unknown[][]): number[][] {
  const spans = rows.map(row => row.map(() => 1)), width = rows[0]?.length || 0;
  const keys = rows.map(row => row.map(canonical));
  // Irregular layouts or source-declared spans keep their original geometry.
  if (!regular(rows)) return spans;
  for (let col = 0; col < width; col++) for (let start = 0; start < rows.length;) {
    let end = start + 1;
    if (rows[start][col] !== '' && rows[start][col] != null) while (end < rows.length && keys[end][col] === keys[start][col]) end++;
    spans[start][col] = end - start;
    for (let row = start + 1; row < end; row++) spans[row][col] = 0;
    start = end;
  }
  return spans;
}
