import { expect, it } from 'vitest';
import type { Entry } from '../src/core/model';
import { runtimeConditionMatches } from '../src/platform/conditionIdentity';
import { conditionVisual } from '../src/ui/conditionVisuals';

const entry = (id: string, source = 'PHB', statusId?: string): Entry => ({
  id, kind: 'condition', name: '束缚', english: 'Restrained', source, packId: 'kiwee',
  revision: '1', edition: source === 'XPHB' ? '2024' : '2014', entries: [],
  raw: { visual: { condition: 'restrained' }, ...(statusId ? { _suiteStatusId: statusId } : {}) },
});

it('retains PHB, XPHB and custom statuses that deliberately share a visual and title', () => {
  const values = [
    { id: 'old-status', entry: entry('kiwee:condition:phb:restrained') },
    { id: 'new-status', entry: entry('kiwee:condition:xphb:restrained', 'XPHB') },
    { id: 'custom-status', entry: entry('custom:condition:restrained', 'CUSTOM') },
  ];
  expect(values.map(value => conditionVisual(value.entry))).toEqual(['restrained', 'restrained', 'restrained']);
  for (const a of values) for (const b of values) expect(runtimeConditionMatches(a, b)).toBe(a.id === b.id);
  const afterRemovingOld = values.filter(value => !runtimeConditionMatches(value, values[0]));
  expect(afterRemovingOld.map(value => value.id)).toEqual(['new-status', 'custom-status']);
});

it('matches the exact entry through optimistic, host and legacy Suite projections', () => {
  const source = entry('kiwee:condition:phb:restrained');
  const pending = { id: source.id, entry: source };
  const hostProjection = { id: `web:${source.id}` };
  const imported = { id: 'different-row-id', entry: entry(source.id, 'PHB', 'u_restrained') };
  const legacy = { id: 'u_restrained' };
  expect(runtimeConditionMatches(pending, hostProjection)).toBe(true);
  expect(runtimeConditionMatches(hostProjection, pending)).toBe(true);
  expect(runtimeConditionMatches(pending, imported)).toBe(true);
  expect(runtimeConditionMatches(imported, legacy)).toBe(true);
  expect(runtimeConditionMatches(legacy, imported)).toBe(true);
  expect(runtimeConditionMatches(pending, legacy)).toBe(false);
});

it('does not guess ID relationships from display names, aliases or empty IDs', () => {
  expect(runtimeConditionMatches({ id: 'restrained' }, { id: 'u_restrained' })).toBe(false);
  expect(runtimeConditionMatches({ id: 'mine' }, { id: 'yours' })).toBe(false);
  expect(runtimeConditionMatches({ id: '' }, { id: '' })).toBe(false);
  expect(runtimeConditionMatches({ id: 'same' }, { id: 'same' })).toBe(true);
  expect(runtimeConditionMatches({ id: 'a', entry: { id: '', raw: {} } }, { id: 'b', entry: { id: '', raw: {} } })).toBe(false);
});
