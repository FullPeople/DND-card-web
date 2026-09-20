export type Edition = '2014' | '2024';
export type Kind = 'class' | 'subclass' | 'race' | 'background' | 'feat' | 'spell' | 'item' | 'feature' | 'condition' | 'rule';
export const KIND_LABELS: Record<Kind, string> = { class: '职业', subclass: '子职', race: '种族', background: '背景', feat: '专长', spell: '法术', item: '装备', feature: '特性', condition: '状态', rule: '规则' };
export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = typeof ABILITIES[number];
export const ABILITY_LABELS: Record<Ability, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };
export const SKILLS: Record<string, { name: string; ability: Ability }> = {
  athletics: { name: '运动', ability: 'str' }, acrobatics: { name: '特技', ability: 'dex' }, sleightOfHand: { name: '巧手', ability: 'dex' }, stealth: { name: '隐匿', ability: 'dex' },
  arcana: { name: '奥秘', ability: 'int' }, history: { name: '历史', ability: 'int' }, investigation: { name: '调查', ability: 'int' }, nature: { name: '自然', ability: 'int' }, religion: { name: '宗教', ability: 'int' },
  animalHandling: { name: '驯兽', ability: 'wis' }, insight: { name: '洞悉', ability: 'wis' }, medicine: { name: '医药', ability: 'wis' }, perception: { name: '察觉', ability: 'wis' }, survival: { name: '生存', ability: 'wis' },
  deception: { name: '欺瞒', ability: 'cha' }, intimidation: { name: '威吓', ability: 'cha' }, performance: { name: '表演', ability: 'cha' }, persuasion: { name: '游说', ability: 'cha' },
};
export type Raw = Record<string, any>;
export type Effect = { op: 'add' | 'set'; target: Ability | 'ac' | 'speed' | 'hp'; value: number } | { op: 'proficiency'; skill: string };
export interface ChoiceDefinition { id: string; label: string; kind?: Kind; count: number; options?: string[]; optionLabels?: Record<string, string>; refs?: string[]; abilityBonus?: number; featureType?: string[]; spellLevel?: number; maxSpellLevel?: number; parentClass?: { name: string; source: string }; spellClass?: { name: string; source: string }; featCategory?: string }
export interface Entry {
  id: string; kind: Kind; name: string; english: string; source: string; edition: Edition | 'both';
  packId: string; revision: string; page?: number; entries: unknown[]; raw: Raw;
  effects?: Effect[]; choices?: ChoiceDefinition[]; dependencies?: string[];
}
export interface Selection { id: string; entry: Entry; quantity: number; level: number; equipped: boolean; requirementId?: string }
export interface RuleProfile { enabledSources: string[]; optional: { feats: boolean; multiclass: boolean; legacy: boolean }; exceptions: Record<string, string> }
export interface Character {
  schemaVersion: 1; id: string; revision: number; name: string; player: string; edition: Edition;
  createdAt: string; updatedAt: string; abilities: Record<Ability, number>; baseHp: number;
  identity: { gender: string; alignment: string; age: string; description: string };
  selections: Selection[]; answers: Record<string, string[]>; reviewed: string[];
  profile: RuleProfile; notes: string;
  adjustments?: { id: string; target: string; value: number; reason: string }[];
  externalSnapshot?: Raw;
  runtime: { hp: number; tempHp: number; inspiration: number; resources: Record<string, { current: number; max: number }> };
}
export interface RulePack { schemaVersion: 1; id: string; name: string; version: string; author?: string; editions: Edition[]; requires: { id: string; version: string }[]; conflicts: string[]; entries: Entry[] }
export interface Requirement extends ChoiceDefinition { id: string; origin: string; section: Kind | 'abilities' | 'proficiency'; selected: string[]; complete: boolean; review?: boolean }
export interface Issue { id: string; message: string; selectionId?: string; severity: 'warning' | 'error' }
export interface Derived {
  abilities: Record<Ability, number>; modifiers: Record<Ability, number>; level: number; proficiency: number;
  ac: number; initiative: number; speed: number; maxHp: number; passive: number;
  skills: Record<string, { value: number; proficient: boolean; sources: string[] }>;
  saves: Record<Ability, { value: number; proficient: boolean }>; requirements: Requirement[]; issues: Issue[];
  trace: Record<string, string[]>; hitDice: string;
}
export const uid = () => crypto.randomUUID();
export function newCharacter(edition: Edition = '2024'): Character {
  const now = new Date().toISOString();
  return { schemaVersion: 1, id: uid(), revision: 1, name: '未命名的冒险者', player: '', edition, createdAt: now, updatedAt: now,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, baseHp: 0,
    identity: { gender: '', alignment: '', age: '', description: '' }, selections: [], answers: {}, reviewed: [], notes: '',
    profile: { enabledSources: ['PHB', 'XPHB'], optional: { feats: true, multiclass: false, legacy: false }, exceptions: {} },
    runtime: { hp: 0, tempHp: 0, inspiration: 0, resources: {} } };
}
export function selectionAllowed(c: Character, e: Entry): boolean {
  if (c.profile.exceptions[e.id]?.trim()) return true;
  return c.profile.enabledSources.includes(e.source) && (e.kind !== 'feat' || c.profile.optional.feats) && (e.dependencies || []).every(id => c.profile.enabledSources.includes(id)) && (e.edition === 'both' || e.edition === c.edition || (c.edition === '2024' && c.profile.optional.legacy));
}
export const signed = (n: number) => n >= 0 ? `+${n}` : String(n);
export function skillKey(name: string): string {
  const compact = name.toLowerCase().replace(/[\s_-]/g, '');
  return Object.keys(SKILLS).find(k => k.toLowerCase() === compact || SKILLS[k].name === name) ?? name;
}
