import {activeSelections} from './automation/active';
import {automationEnabled} from './automation/state';
import {automaticWeaponAttacks} from './automation/weapons';
import {evaluate} from './engine';
import {type Character,type Derived,type Entry} from './model';

export type WeaponAttack = {
 key:string;name:string;attack_bonus?:string|number;damage?:string;
 extra_damage?:string;damage_type?:string;entry?:Entry;modeLabel?:string;
};

/** The same recorded attacks drive the sheet and the Owlbear projection.
 * Do not guess proficiency or add ability modifiers to a manual formula. */
export function weaponAttacks(c:Character,derived?:Derived):WeaponAttack[]{
 const automatic=automationEnabled(c);
 const custom=(c.quickbarActions||[]).map(w=>({key:`custom:${w.id}`,name:w.name,attack_bonus:w.attack,damage:w.damage}));
 const old=Array.isArray(c.externalSnapshot?.combat?.weapons)?c.externalSnapshot.combat.weapons:[];
 const legacy=old.filter((w:any)=>w&&typeof w.name==='string'&&!String(w.web_action_key||'').startsWith('auto-weapon:')&&(!automatic||!String(w.web_action_key||'').startsWith('selection:'))&&!custom.some(c=>c.key===w.web_action_key)).map((w:any,i:number)=>({...w,key:w.web_action_key||`weapon:${i}:${w.name}`}));
 const items=(automatic?activeSelections(c):c.selections).filter(s=>s.entry.kind==='item'&&s.entry.raw.dmg1&&(!automatic||s.equipped&&s.entry.raw.attackBonus!==undefined)&&!(automatic?legacy:old).some((w:any)=>w?.web_action_key? w.web_action_key===`selection:${s.entry.id}`:w?.name===s.entry.name&&(!w.source||w.source===s.entry.source))).map(s=>({key:`selection:${s.entry.id}`,name:s.entry.name,damage:s.entry.raw.dmg1,attack_bonus:s.entry.raw.attackBonus,entry:s.entry}));
 const layout=c.quickbarLayout||{order:[],hidden:[]},rank=(key:string)=>{const i=layout.order.indexOf(key);return i<0?9999:i;};
 return [...custom,...legacy,...items,...(automatic?automaticWeaponAttacks(c,derived??evaluate(c)).attacks:[])].filter(w=>!layout.hidden.includes(w.key)).sort((a,b)=>rank(a.key)-rank(b.key));
}
