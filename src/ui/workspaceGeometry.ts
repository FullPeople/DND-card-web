/** Default proportions from the approved three-column reference: 44 / 24 / 32.
 * The two separators consume a few pixels; the remaining Wiki area is 3 / 7
 * catalog and 4 / 7 reader. Stored user preferences take precedence. */
export const DEFAULT_SHEET_SHARE = .44;
export const DEFAULT_CATALOG_SHARE = 3 / 7;
export const WIKI_COLUMNS_MIN_WIDTH = 780;
export const WIKI_CATALOG_MIN_WIDTH = 320;
export const WIKI_READER_MIN_WIDTH = 440;
export const WIKI_DIVIDER_WIDTH = 9;
export const WORKSPACE_HIDDEN_KEY = 'dnd-card:workspace-hidden';
export type WorkspaceSide = 'sheet' | 'wiki';

export function savedWorkspaceSide(value:string|null):WorkspaceSide|undefined {
  return value==='sheet'||value==='wiki'?value:undefined;
}

export function savedWorkspaceShare(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= .3 && parsed <= .7 ? parsed : DEFAULT_SHEET_SHARE;
}
