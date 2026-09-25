import {selectionAllowed,type Character,type Selection} from './model';

export function hitPointLevels(c:Character,con:number,classes:Selection[]=c.selections.filter(s=>s.entry.kind==='class'&&selectionAllowed(c,s.entry))){
  return classes.flatMap((s,index)=>Array.from({length:s.level},(_,i)=>{
    const faces=Number(s.entry.raw.hd?.faces)||8,first=index===0&&i===0,average=Math.floor(faces/2)+1;
    const recorded=c.hpProgression?.rolls[s.id]?.[i];
    const die=first?faces:c.hpProgression?.mode==='rolled'&&typeof recorded==='number'?Math.max(1,Math.min(faces,recorded)):average;
    return {id:s.id,name:s.entry.name,level:i+1,faces,first,recorded,die,hp:Math.max(1,die+con)};
  }));
}
