import type { Entry } from '../core/model';
import badge0 from '../assets/class-badges/barbarian.svg';
import badge1 from '../assets/class-badges/bard.svg';
import badge2 from '../assets/class-badges/cleric.svg';
import badge3 from '../assets/class-badges/druid.svg';
import badge4 from '../assets/class-badges/fighter.svg';
import badge5 from '../assets/class-badges/monk.svg';
import badge6 from '../assets/class-badges/ranger.svg';
import badge7 from '../assets/class-badges/rogue.svg';
import badge8 from '../assets/class-badges/paladin.svg';
import badge9 from '../assets/class-badges/sorcerer.svg';
import badge10 from '../assets/class-badges/warlock.svg';
import badge11 from '../assets/class-badges/wizard.svg';
import badge12 from '../assets/class-badges/artificer.svg';
import badge13 from '../assets/class-badges/mystic.svg';
import badge14 from '../assets/class-badges/expert-sidekick.svg';
import badge15 from '../assets/class-badges/spellcaster-sidekick.svg';
import badge16 from '../assets/class-badges/warrior-sidekick.svg';

const badges = [
  { id: 'barbarian', names: ['野蛮人', 'barbarian'], url: badge0 },
  { id: 'bard', names: ['吟游诗人', 'bard'], url: badge1 },
  { id: 'cleric', names: ['牧师', 'cleric'], url: badge2 },
  { id: 'druid', names: ['德鲁伊', 'druid'], url: badge3 },
  { id: 'fighter', names: ['战士', 'fighter'], url: badge4 },
  { id: 'monk', names: ['武僧', 'monk'], url: badge5 },
  { id: 'ranger', names: ['游侠', 'ranger'], url: badge6 },
  { id: 'rogue', names: ['游荡者', 'rogue'], url: badge7 },
  { id: 'paladin', names: ['圣武士', 'paladin'], url: badge8 },
  { id: 'sorcerer', names: ['术士', 'sorcerer'], url: badge9 },
  { id: 'warlock', names: ['魔契师', 'warlock'], url: badge10 },
  { id: 'wizard', names: ['法师', 'wizard'], url: badge11 },
  { id: 'artificer', names: ['奇械师', 'artificer'], url: badge12 },
  { id: 'mystic', names: ['秘术师', 'mystic'], url: badge13 },
  { id: 'expert-sidekick', names: ['专家协力者', 'expert sidekick'], url: badge14 },
  { id: 'spellcaster-sidekick', names: ['施法者协力者', 'spellcaster sidekick'], url: badge15 },
  { id: 'warrior-sidekick', names: ['武者协力者', 'warrior sidekick'], url: badge16 }
];
export function classBadge(entry: Entry) {
  if (entry.kind !== 'class') return;
  return badges.find(b => b.id === entry.raw.visual?.badge || b.names.includes(entry.english.toLowerCase()) || b.names.includes(entry.name));
}
