import type {Character} from './model';

const construction=new WeakMap<Character,Character>();
/** Explicit display/balance edits retain their immutable rule-construction snapshot. */
export const characterConstructionBase=(character:Character)=>construction.get(character)||character;
export function forkCharacterConstruction(character:Character,next:Character):Character{
 construction.set(next,characterConstructionBase(character));return next;
}
