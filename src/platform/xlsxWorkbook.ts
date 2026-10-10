const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

function findEocd(view: DataView): number {
  for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === EOCD_SIG && i + 22 + view.getUint16(i + 20, true) === view.byteLength) return i;
  }
  throw new Error("ZIP EOCD not found");
}

const MAX_XML_BYTES = 32 * 1024 * 1024;

async function inflateRaw(bytes: Uint8Array, size: number): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const raw = new Uint8Array(bytes.byteLength);
  raw.set(bytes);
  const stream = new Blob([raw]).stream().pipeThrough(ds);
  const reader = stream.getReader(), parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > size || length > MAX_XML_BYTES) throw new Error("XLSX XML size limit exceeded");
      parts.push(value);
    }
  } finally { await reader.cancel(); }
  if (length !== size) throw new Error("XLSX XML length mismatch");
  const result = new Uint8Array(length); let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

// Index the archive first. Only requested XML is inflated, never character portraits/media.
export async function readZipEntries(source: Blob | ArrayBuffer | Uint8Array) {
  const buf = source instanceof Blob
    ? await source.arrayBuffer()
    : source instanceof Uint8Array
      ? source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)
      : source;

  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const eocd = findEocd(view);
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const end = offset + view.getUint32(eocd + 12, true);
  if (view.getUint16(eocd + 4, true) || view.getUint16(eocd + 6, true)
      || count !== view.getUint16(eocd + 8, true) || count === 0xffff || end !== eocd) throw new Error("Unsupported XLSX ZIP directory");
  const entries = new Map<string, { compression: number; size: number; compressed: Uint8Array }>();
  function within(start: number, length: number, limit = bytes.length) {
    if (start < 0 || length < 0 || start + length > limit) throw new Error("Truncated XLSX ZIP entry");
  }

  for (let i = 0; i < count; i++) {
    within(offset, 46, end);
    if (view.getUint32(offset, true) !== CEN_SIG) throw new Error("ZIP central directory entry missing");
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    within(offset + 46, nameLen + extraLen + commentLen, end);
    const name = decodeUtf8(bytes.slice(offset + 46, offset + 46 + nameLen));
    if (entries.has(name) || view.getUint16(offset + 8, true) & 1) throw new Error("Ambiguous or encrypted XLSX ZIP entry");
    within(localOffset, 30, view.getUint32(eocd + 16, true));
    if (view.getUint32(localOffset, true) !== LOC_SIG) throw new Error(`ZIP local header missing for ${name}`);
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    within(localOffset + 30, localNameLen + localExtraLen + compressedSize, view.getUint32(eocd + 16, true));
    if (decodeUtf8(bytes.slice(localOffset + 30, localOffset + 30 + localNameLen)) !== name
        || view.getUint16(localOffset + 8, true) !== compression) throw new Error("XLSX ZIP headers disagree");
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    entries.set(name, { compression, size, compressed });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  if (offset !== end) throw new Error("XLSX ZIP directory length mismatch");
  return async (name: string): Promise<Uint8Array | null> => {
    const entry = entries.get(name);
    if (!entry) return null;
    if (entry.size > MAX_XML_BYTES) throw new Error("XLSX XML size limit exceeded");
    if (entry.compression === 8) return inflateRaw(entry.compressed, entry.size);
    if (entry.compression !== 0) throw new Error(`Unsupported ZIP compression method: ${entry.compression}`);
    if (entry.compressed.length !== entry.size) throw new Error("XLSX XML length mismatch");
    return entry.compressed;
  };
}

const SHEET_NS = ["http://schemas.openxmlformats.org/spreadsheetml/2006/main", "http://purl.oclc.org/ooxml/spreadsheetml/main"];
const OFFICE_REL_NS = ["http://schemas.openxmlformats.org/officeDocument/2006/relationships", "http://purl.oclc.org/ooxml/officeDocument/relationships"];
const PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

function parseXml(bytes: Uint8Array | null, rootName: string, namespaces: string[]): Element | null {
  if (!bytes) return null;
  const xml = decodeUtf8(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return null;
  const doc = new DOMParser().parseFromString(xml, "application/xml"), root = doc.documentElement;
  return root.localName === rootName && namespaces.includes(root.namespaceURI || "")
    && !doc.getElementsByTagNameNS("*", "parsererror").length ? root : null;
}

function children(node: Element, name: string): Element[] {
  return Array.from(node.children).filter(child => child.localName === name && child.namespaceURI === node.namespaceURI);
}

function hasDirectText(node: Element): boolean {
  return Array.from(node.childNodes).some(child =>
    (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) && !!child.textContent?.trim());
}

function stringText(node: Element): string | null {
  // Phonetic guides (rPh) are not the displayed cell value.
  const simple = children(node, "t"), runs = children(node, "r");
  if (simple.length > 1 || (simple.length && runs.length)
      || hasDirectText(node)
      || Array.from(node.children).some(child => child.namespaceURI !== node.namespaceURI
        || !["t", "r", "rPh", "phoneticPr"].includes(child.localName))) return null;
  const parts = [...simple];
  for (const run of runs) {
    const text = children(run, "t");
    if (text.length !== 1 || children(run, "rPr").length > 1 || hasDirectText(run)
        || Array.from(run.children).some(child => child.namespaceURI !== node.namespaceURI
          || !["t", "rPr"].includes(child.localName))) return null;
    parts.push(text[0]);
  }
  return parts.some(part => part.children.length) ? null : parts.map(part => part.textContent || "").join("");
}

function relationshipPath(relation: Element): string | null {
  if (relation.getAttribute("TargetMode") && relation.getAttribute("TargetMode") !== "Internal") return null;
  const target = relation.getAttribute("Target");
  if (!target || /[:\\?#]/.test(target) || /%(?:2f|5c)/i.test(target)) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(target); } catch { return null; }
  if (/[:\\?#\x00-\x1f]/.test(decoded) || decoded.startsWith("//")) return null;
  const parts = decoded.startsWith("/") ? [] : ["xl"];
  for (const part of decoded.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { if (!parts.length) return null; parts.pop(); }
    else parts.push(part);
  }
  return parts.length ? parts.join("/") : null;
}

export type CellValue = string | number | boolean | null;
export interface XlsxSheet { cells: Map<string, CellValue>; maxRow: number }
export interface XlsxWorkbook { names: string[]; sheet: (name: string) => Promise<XlsxSheet> }

/** Read the existing workbook values. Formulas, links and embedded media are never executed. */
export async function readXlsxWorkbook(source: Blob | ArrayBuffer | Uint8Array): Promise<XlsxWorkbook> {
  const size = source instanceof Blob ? source.size : source.byteLength;
  if (size > 20_000_000) throw Error('单个文件不能超过 20 MB');
  const read = await readZipEntries(source);
  let expanded = 0;
  async function xml(path: string, root: string, ns = SHEET_NS) {
    const bytes = await read(path);
    expanded += bytes?.byteLength || 0;
    if (expanded > 96 * 1024 * 1024) throw Error('Excel 内容过大，无法读取');
    const node = parseXml(bytes, root, ns);
    if (!node) throw Error('Excel 工作簿内容不完整或格式无效');
    return node;
  }
  const workbook = await xml('xl/workbook.xml', 'workbook');
  const relations = await xml('xl/_rels/workbook.xml.rels', 'Relationships', [PACKAGE_REL_NS]);
  const rels = children(relations, 'Relationship'), ids = rels.map(rel => rel.getAttribute('Id'));
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw Error('Excel 工作表关系重复');
  const paths = new Map<string, string>(), usedPaths = new Set<string>();
  const groups = children(workbook, 'sheets');
  if (groups.length !== 1) throw Error('Excel 工作表清单无效');
  for (const sheet of children(groups[0], 'sheet')) {
    const name = sheet.getAttribute('name'), id = OFFICE_REL_NS.map(ns => sheet.getAttributeNS(ns, 'id')).filter(Boolean);
    const rel = id.length === 1 ? rels.find(rel => rel.getAttribute('Id') === id[0]) : undefined;
    const path = rel && relationshipPath(rel);
    if (!name || !path || !rel || !OFFICE_REL_NS.some(ns => rel.getAttribute('Type') === `${ns}/worksheet`)
      || paths.has(name) || usedPaths.has(path)) throw Error('Excel 工作表清单存在冲突');
    paths.set(name, path); usedPaths.add(path);
  }
  const sharedRelations = rels.filter(rel => OFFICE_REL_NS.some(ns => rel.getAttribute('Type') === `${ns}/sharedStrings`));
  if (sharedRelations.length > 1) throw Error('Excel 文本表重复');
  const sharedPath = sharedRelations[0] && relationshipPath(sharedRelations[0]);
  if (sharedRelations.length && !sharedPath) throw Error('Excel 文本表无效');
  const shared = sharedPath ? children(await xml(sharedPath, 'sst'), 'si').map(stringText) : [];
  const cache = new Map<string, Promise<XlsxSheet>>();
  let cellCount = 0;
  async function load(name: string): Promise<XlsxSheet> {
    const path = paths.get(name);
    if (!path) throw Error(`Excel 缺少工作表「${name}」`);
    const node = await xml(path, 'worksheet'), data = children(node, 'sheetData');
    if (data.length !== 1) throw Error(`工作表「${name}」内容无效`);
    const cells = new Map<string, CellValue>(); let maxRow = 0;
    for (const row of children(data[0], 'row')) for (const cell of children(row, 'c')) {
      if (++cellCount > 300_000) throw Error('Excel 单元格过多，无法读取');
      const ref = cell.getAttribute('r'), match = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(ref || '');
      if (!ref || !match || Number(match[2]) > 1_048_576 || cells.has(ref)) throw Error('Excel 单元格地址无效或重复');
      const values = children(cell, 'v'), inline = children(cell, 'is'), formulas = children(cell, 'f');
      const type = cell.getAttribute('t') || 'n';
      if ([values, inline, formulas].some(parts => parts.length > 1) || values.some(value => value.children.length)) throw Error('Excel 单元格内容无效');
      const value = values[0]?.textContent ?? null;
      let result: CellValue = null;
      if (type === 's' && value !== null) {
        if (!/^\d+$/.test(value) || shared[Number(value)] === undefined || shared[Number(value)] === null) throw Error('Excel 文本索引无效');
        result = shared[Number(value)];
      } else if (type === 'inlineStr') {
        if (values.length || inline.length !== 1) throw Error('Excel 内嵌文本无效');
        result = stringText(inline[0]);
        if (result === null) throw Error('Excel 内嵌文本无效');
      } else if (type === 'b' && value !== null) {
        if (!/^(0|1|true|false)$/.test(value)) throw Error('Excel 布尔值无效');
        result = value === '1' || value === 'true';
      } else if (type === 'n' && value !== null && value.trim()) {
        result = Number(value);
        if (!Number.isFinite(result)) throw Error('Excel 数字无效');
      } else if (type === 'str' || type === 'd') result = value;
      else if (type !== 'e' && type !== 'n') throw Error('Excel 单元格类型不支持');
      cells.set(ref, typeof result === 'string' ? result.trim() || null : result);
      maxRow = Math.max(maxRow, Number(match[2]));
    }
    return {cells, maxRow};
  }
  return {names: [...paths.keys()], sheet(name) {
    if (!cache.has(name)) cache.set(name, load(name));
    return cache.get(name)!;
  }};
}

