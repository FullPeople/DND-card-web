import type {Character} from '../core/model';

/** Each read awaits persistence; identical documents need no repeated content hashing. */
export async function readPersistedCharacter(read:()=>Promise<Character>,hash:(character:Character)=>Promise<string>):Promise<Character>{
 let before=await read();
 for(;;){
  const after=await read();
  if(before===after||await hash(before)===await hash(after))return before;
  before=after;
 }
}
