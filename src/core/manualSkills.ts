import {SKILLS,type Character} from './model';

/** Only edit the player's saved intent. Rule grants remain owned by their source. */
export function setManualSkillProficiency(c:Character,key:string,enabled:boolean){
 if(!Object.hasOwn(SKILLS,key))return;
 (c.proficiencies||={})[key]=enabled;
 if(!enabled&&c.expertise)c.expertise[key]=false;
}
export function setManualSkillExpertise(c:Character,key:string,enabled:boolean){
 if(!Object.hasOwn(SKILLS,key))return;
 (c.expertise||={})[key]=enabled;
 if(enabled)(c.proficiencies||={})[key]=true;
}
