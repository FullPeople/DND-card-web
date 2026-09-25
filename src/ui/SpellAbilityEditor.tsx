import {ABILITIES,ABILITY_LABELS,type Character} from '../core/model';
import {spellState} from '../core/characterDetails';
import {casterProfiles} from '../core/spellcastingRules';
export function SpellAbilityEditor({c,edit}:{c:Character;edit:(fn:(c:Character)=>void)=>void}){
 const state=spellState(c),profiles=casterProfiles(c).filter(p=>ABILITIES.includes(p.casting.entry.raw.spellcastingAbility));
 const change=(fn:(s:typeof state)=>void)=>edit(draft=>{draft.spellSettings=structuredClone(state);fn(draft.spellSettings);});
 return <section className="spell-ability-editor"><div className="segmented"><button aria-pressed={!state.abilityOverride&&!state.abilityClassId} onClick={()=>change(s=>{s.abilityOverride=false;delete s.abilityClassId;})}>跟随职业</button>{profiles.length>1&&profiles.map(p=><button key={p.owner.id} aria-pressed={!state.abilityOverride&&state.abilityClassId===p.owner.id} onClick={()=>change(s=>{s.abilityOverride=false;s.abilityClassId=p.owner.id;})}>{p.casting.entry.name} · {ABILITY_LABELS[p.casting.entry.raw.spellcastingAbility as keyof typeof ABILITY_LABELS]}</button>)}</div><p>当前施法属性：<strong>{ABILITY_LABELS[state.ability]}</strong></p><div className="segmented" role="group" aria-label="手动施法属性">{ABILITIES.map(a=><button key={a} aria-pressed={!!state.abilityOverride&&state.ability===a} onClick={()=>change(s=>{s.ability=a;s.abilityOverride=true;})}>{ABILITY_LABELS[a]}</button>)}</div></section>;
}
