import { expect, it } from 'vitest';
import { DEFAULT_CATALOG_SHARE, DEFAULT_SHEET_SHARE, savedWorkspaceShare, WIKI_CATALOG_MIN_WIDTH, WIKI_COLUMNS_MIN_WIDTH, WIKI_DIVIDER_WIDTH, WIKI_READER_MIN_WIDTH } from '../src/ui/workspaceGeometry';

it('defaults to the approved44/24/32 proportions without changing valid saved preferences', () => {
  expect(DEFAULT_SHEET_SHARE).toBe(.44);
  expect((1 - DEFAULT_SHEET_SHARE) * DEFAULT_CATALOG_SHARE).toBeCloseTo(.24);
  expect((1 - DEFAULT_SHEET_SHARE) * (1 - DEFAULT_CATALOG_SHARE)).toBeCloseTo(.32);
  for (const value of ['0.3', '0.44', '0.48', '0.6', '0.7']) expect(savedWorkspaceShare(value)).toBe(Number(value));
  for (const value of [null, '', 'NaN', 'Infinity', 'bad', '-1', '0', '0.29', '0.71']) expect(savedWorkspaceShare(value)).toBe(.44);
});

it('switches to columns only after both panes and their divider can fit', () => {
  expect(WIKI_COLUMNS_MIN_WIDTH).toBeGreaterThanOrEqual(WIKI_CATALOG_MIN_WIDTH + WIKI_DIVIDER_WIDTH + WIKI_READER_MIN_WIDTH);
  expect(1440 * (1 - DEFAULT_SHEET_SHARE) - 8).toBeGreaterThan(WIKI_COLUMNS_MIN_WIDTH);
  expect(1366 * (1 - DEFAULT_SHEET_SHARE) - 8).toBeLessThan(WIKI_COLUMNS_MIN_WIDTH);
});
