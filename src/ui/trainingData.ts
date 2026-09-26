import type { Entry } from '../core/model';

export function trainingCategory(entry: Entry): string | undefined {
  if(['armor','weapons','tools','languages'].includes(entry.raw._trainingCategory))return entry.raw._trainingCategory;
  if (entry.raw._category === 'language') return 'languages';
  if (['itemProperty','itemMastery'].includes(entry.raw._category)) return 'weapons';
  if (entry.kind !== 'item') return;
  const type = String(entry.raw.type || '').split('|')[0];
  if (['LA', 'MA', 'HA', 'S'].includes(type)) return 'armor';
  if (entry.raw.weaponCategory || ['M', 'R'].includes(type)) return 'weapons';
  if (['AT', 'T', 'INS', 'GS', 'VEH', 'SHP', 'AIR'].includes(type)) return 'tools';
}
