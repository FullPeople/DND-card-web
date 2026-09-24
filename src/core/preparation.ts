import {evaluate} from './engine';
import {casterProfiles} from './spellcastingRules';
import {ABILITIES,type Character} from './model';

/** Upstream arithmetic only. No eval, JavaScript property access or executable data. */
export function preparationFormula(formula:string,variables:Record<string,number>):number|undefined{
 const source=formula.replace(/<\$([a-z_]+)\$>/gi,(_,key)=>String(variables[key]??'invalid')).replace(/\s/g,'').replace(/Math\.(floor|ceil|round)/g,'$1');
 const tokens=source.match(/\d+(?:\.\d+)?|floor|ceil|round|[()+*/,-]/g)||[];
 if(tokens.join('')!==source||source.length>200)return;
 let at=0;
 function atom():number{const t=tokens[at++];if(t==='-'||t==='+')return (t==='-'?-1:1)*atom();if(['floor','ceil','round'].includes(t)){if(tokens[at++]!=='(')throw 0;const n=sum();if(tokens[at++]!==')')throw 0;return t==='floor'?Math.floor(n):t==='ceil'?Math.ceil(n):Math.round(n);}if(t==='('){const n=sum();if(tokens[at++]!==')')throw 0;return n;}if(!t||!/^\d/.test(t))throw 0;return Number(t);}
 function product():number{let n=atom();while(['*','/'].includes(tokens[at])){const op=tokens[at++],v=atom();n=op==='*'?n*v:n/v;}return n;}
 function sum():number{let n=product();while(['+','-'].includes(tokens[at])){const op=tokens[at++],v=product();n=op==='+'?n+v:n-v;}return n;}
 try{const n=sum();if(at===tokens.length&&Number.isFinite(n))return Math.max(1,Math.floor(n));}catch{}
}
export function preparationBase(c:Character):number|undefined{
 const profiles=casterProfiles(c).filter(p=>p.mode==='prepared');if(!profiles.length)return;
 const d=evaluate(c);let total=0;
 for(const p of profiles){const raw=p.casting.entry.raw,level=p.owner.level,table=raw.preparedSpellsProgression?.[level-1];
  if(typeof table==='number'){total+=Math.max(0,table);continue;}
  const variables=Object.fromEntries([['level',level],['spellcasting_mod',d.modifiers[raw.spellcastingAbility as keyof typeof d.modifiers]||0],...ABILITIES.map(a=>[`${a}_mod`,d.modifiers[a]])]);
  const value=typeof raw.preparedSpells==='string'?preparationFormula(raw.preparedSpells,variables):undefined;
  if(value===undefined)return;total+=value;
 }
 return total;
}
