import type {Character} from '../core/model';
import {evaluate} from '../core/engine';
import type {CharacterRow} from './CharacterManager';
export function localCharacterRow(c:Character):CharacterRow{const d=evaluate(c);return {id:c.id,name:c.name,player:c.player,edition:c.edition,classes:c.selections.filter(s=>s.entry.kind==='class').map(s=>`${s.entry.name} ${s.level}`).join(' / '),hp:c.runtime.hp,maxHp:d.maxHp,ac:d.ac,level:d.level,write:true,locked:c.locked};}

