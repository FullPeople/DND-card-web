import {type Character,type Entry} from './model';

export type WeaponAttack = {
 key:string;name:string;attack_bonus?:string|number;damage?:string;
 extra_damage?:string;damage_type?:string;entry?:Entry;
};

/** The same recorded attacks drive the sheet and the Owlbear projection.
 * Do not guess proficiency or add ability modifiers to a manual formula. */
export function weaponAttacks(c:Character):WeaponAttack[]{
 const custom=(c.quickbarActions||[]).map(w=>({key:`custom:${w.id}`,name:w.name,attack_bonus:w.attack,damage:w.damage}));
 const old=Array.isArray(c.externalSnapshot?.combat?.weapons)?c.externalSnapshot.combat.weapons:[];
 const legacy=old.filter((w:any)=>w&&typeof w.name==='string'&&!custom.some(c=>c.key===w.web_action_key)).map((w:any,i:number)=>({...w,key:w.web_action_key||`weapon:${i}:${w.name}`}));
 const items=c.selections.filter(s=>s.entry.kind==='item'&&s.entry.raw.dmg1&&!old.some((w:any)=>w?.web_action_key? w.web_action_key===`selection:${s.entry.id}`:w?.name===s.entry.name&&(!w.source||w.source===s.entry.source))).map(s=>({key:`selection:${s.entry.id}`,name:s.entry.name,damage:s.entry.raw.dmg1,attack_bonus:s.entry.raw.attackBonus,entry:s.entry}));
 const layout=c.quickbarLayout||{order:[],hidden:[]},rank=(key:string)=>{const i=layout.order.indexOf(key);return i<0?9999:i;};
 return [...custom,...legacy,...items].filter(w=>!layout.hidden.includes(w.key)).sort((a,b)=>rank(a.key)-rank(b.key));
}
