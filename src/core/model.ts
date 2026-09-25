export type Edition = '2014' | '2024';
export type Kind = 'class' | 'subclass' | 'race' | 'background' | 'feat' | 'spell' | 'item' | 'feature' | 'condition' | 'rule' | 'monster';
export const KIND_LABELS: Record<Kind, string> = { class: '职业', subclass: '子职', race: '种族', background: '背景', feat: '专长', spell: '法术', item: '装备', feature: '特性', condition: '状态', rule: '规则', monster: '怪物' };
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
export const SHEET_BONUS_KEYS = ['proficiency', 'initiative', 'speed', 'passive', 'hp', 'ac'] as const;
export type SheetBonus = typeof SHEET_BONUS_KEYS[number];
export const SIZE_LABELS = { T: '微型', S: '小型', M: '中型', L: '大型', H: '巨型', G: '超巨型' } as const;
export type Size = keyof typeof SIZE_LABELS;
export type Effect = { op: 'add' | 'set'; target: Ability | 'ac' | 'speed' | 'hp'; value: number } | { op: 'proficiency'; skill: string };
export interface ChoiceDefinition { id: string; label: string; kind?: Kind; count: number; options?: string[]; optionLabels?: Record<string, string>; refs?: string[]; abilityBonus?: number; featureType?: string[]; spellLevel?: number; maxSpellLevel?: number; parentClass?: { name: string; source: string }; spellClass?: { name: string; source: string }; featCategory?: string }
export interface Entry {
  id: string; kind: Kind; name: string; english: string; source: string; edition: Edition | 'both';
  packId: string; revision: string; page?: number; entries: unknown[]; raw: Raw;
  effects?: Effect[]; choices?: ChoiceDefinition[]; dependencies?: string[];
}
export interface Selection { id: string; entry: Entry; quantity: number; level: number; equipped: boolean; attuned?: boolean; requirementId?: string; parentId?: string; grantKey?: string; section?: 'features' | 'heritage' }
export interface SpellSettings { mode:'known'|'prepared'; modeOverride?:boolean; ability:Ability; abilityOverride?:boolean; abilityClassId?:string; capacity:number; capacityAdjustment?:number; attackBonus:number; dcBonus:number; prepared:string[]; slots:Record<string,{max:number;used:number}> }
export interface RuleProfile { autoSourceDefaults?: string[]; disabledEntries?: string[]; enabledSources: string[]; optional: { feats: boolean; multiclass: boolean; legacy: boolean }; exceptions: Record<string, string> }
export interface Character {
  locked?:boolean;
  schemaVersion: 1; id: string; revision: number; name: string; player: string; edition: Edition;
  createdAt: string; updatedAt: string; abilities: Record<Ability, number>; baseHp: number;
  identity: { gender: string; alignment: string; age: string; description: string };
  biography?: Partial<Record<'hometown'|'height'|'weight'|'traits'|'ideals'|'bonds'|'flaws'|'story'|'backgroundDescription'|'portraitNotes',string>>;
  portrait?: {data:string;x:number;y:number;zoom:number;frameWidth?:number;frameHeight?:number};
  illustration?: {data:string;x:number;y:number;zoom:number;frameWidth?:number;frameHeight?:number};
  palette?: Partial<Record<'paper'|'surface'|'frame'|'heading'|'ink'|'badge',string>>;
  spellSettings?: SpellSettings;
  inventory?: {capacityAdjustment?:string;displayEquipment?:string[];displayAttunement?:string[];positions?:Record<string,number>;view:'grid'|'list';order:string[];attunementLimit:number;coins:Record<'cp'|'sp'|'ep'|'gp'|'pp',number>;grantedCoins?:Record<string,number>};
  backgroundChoices?: Record<string,{abilities?:Partial<Record<Ability,number>>;equipment?:Record<string,string>}>;
  selections: Selection[]; answers: Record<string, string[]>; reviewed: string[];
  hpProgression?: {mode:'average'|'rolled';rolls:Record<string,(number|null)[]>};
  profile: RuleProfile; notes: string;
  rulePacks?: RulePack[];
  quickbarLayout?: {order:string[];hidden:string[]};
  quickbar?: string[];
  quickbarCopies?: {id:string;entry:Entry}[];
  quickbarActions?: {id:string;name:string;attack:string;damage:string}[];
  proficiencies?: Record<string, boolean>;
  expertise?: Record<string, boolean>;
  jackOfAllTrades?: boolean;
  training?: Record<string, string>;
  size?: Size;
  sheetBonuses?: Partial<Record<SheetBonus, number>>;
  dismissedFeatures?: string[];
  featureLayout?: { detailsExpanded?:string[]; order: string[]; expanded: string[] };
  adjustments?: { id: string; target: string; value: number; reason: string }[];
  externalSnapshot?: Raw;
  runtime: { deathSaves?: { success: number; failure: number }; hp: number; tempHp: number; inspiration: number; resources: Record<string, { current: number; max: number; name?:string;type?:string;icon?:string;order?:number;automatic?:boolean;unlimited?:boolean;locked?:boolean }> };
}
export interface RulePack { schemaVersion: 1; id: string; name: string; version: string; author?: string; editions: Edition[]; requires: { id: string; version: string }[]; conflicts: string[]; entries: Entry[] }
export interface Requirement extends ChoiceDefinition { id: string; origin: string; section: Kind | 'abilities' | 'proficiency'; selected: string[]; complete: boolean; review?: boolean }
export interface Issue { id: string; message: string; selectionId?: string; severity: 'warning' | 'error' }
export interface Derived {
  abilities: Record<Ability, number>; modifiers: Record<Ability, number>; level: number; proficiency: number;
  ac: number; initiative: number; speed: number; maxHp: number; passive: number;
  skills: Record<string, { value: number; proficient: boolean; expertise: boolean; sources: string[] }>;
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
/** Edition switches govern core handbooks, not expansion provenance. A source
 * can provide a separate subclass adaptation for the other parent class. */
export function entryEdition(e:Entry):Edition|'both' {
  const core:Record<string,Edition>={PHB:'2014',DMG:'2014',XPHB:'2024',XDMG:'2024'};
  const published=core[e.source.toUpperCase()];
  if(!published)return 'both';
  return (e.kind==='subclass'||e.kind==='feature')&&core[String(e.raw.classSource||'').toUpperCase()]||published;
}
export function editionAllows(e:Entry,edition:Edition,legacy=false){const required=entryEdition(e);return required==='both'||required===edition||edition==='2024'&&legacy;}
export function selectionAllowed(c: Character, e: Entry): boolean {
  if (c.profile.disabledEntries?.includes(e.id)) return false;
  if (c.profile.exceptions[e.id]?.trim()) return true;
  // Unmapped external card records have no publisher source to enable. Keep
  // their manually supplied values until the player replaces the snapshot.
  if (e.source === 'IMPORTED' && e.packId === 'imported') return true;
  if(e.source==='CUSTOM'&&e.raw._custom&&!e.raw._workbenchCustom)return e.kind!=='feat'||c.profile.optional.feats;
  return c.profile.enabledSources.includes(e.source) && (e.kind !== 'feat' || c.profile.optional.feats) && (e.dependencies || []).every(id => c.profile.enabledSources.includes(id)) && editionAllows(e,c.edition,c.profile.optional.legacy);
}
export const signed = (n: number) => n >= 0 ? `+${n}` : String(n);
export function subclassOwner(c:Character,e:Entry){const key=(v:unknown)=>String(v||'').trim().toLowerCase();const names=[e.raw.className,e.raw.classEnglish,e.raw.classENG_name].map(key).filter(Boolean);return c.selections.find(s=>s.entry.kind==='class'&&[s.entry.name,s.entry.english,s.entry.raw.name,s.entry.raw.ENG_name].map(key).some(n=>names.includes(n))&&key(s.entry.source)===key(e.raw.classSource||'PHB'));}
export function skillKey(name: string): string {
  const compact = name.toLowerCase().replace(/[\s_-]/g, '');
  return Object.keys(SKILLS).find(k => k.toLowerCase() === compact || SKILLS[k].name === name) ?? name;
}
