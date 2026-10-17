import {BEAM_AFTERGLOW,POST_BEAM_DICE_HOLD,type Cue} from './dice/cue';
import {projectVisual,type Projection} from './dice/native';
import type {Roll} from './dice/types';
export type RollMode='random'|'d20'|'d100'|'6d4';
export const rollLabel=(mode:RollMode)=>mode==='d20'?'冒险者':mode==='d100'?'调查员':'';
export const percentileTotal=(tens:number,ones:number)=>tens===0&&ones===0?100:tens+ones;
/** Presentation reads the physical result; it never changes the landed face. */
export function applyDiceStrategy(cue:Cue,roll:Roll,mode:RollMode,projection:Projection){
  if(mode==='6d4'){
    cue.presentation='triangle';cue.beams=[];cue.modifier=null;cue.reveals=[];cue.displayedTotals=[];
    cue.underDice=roll.results.flatMap((value,dieIndex)=>{
      if(value!==3)return[];const at=((roll.frames-1)*roll.kinds.length+dieIndex)*7;
      const [sourceX,sourceY]=projectVisual(projection,roll.poses[at],0,roll.poses[at+2]);return[{dieIndex,sourceX,sourceY,radius:projection.pixelsPerDie*.55}];
    });
    cue.firstBeam=cue.settled+.25;cue.finalReveal=cue.settled+.55;cue.finalBeamEnd=cue.settled+3.5;cue.diceExit=cue.settled+4;
    if(roll.results.length===6&&roll.results.every(value=>value===3))cue.celebration='confetti';
    else if(roll.results.length===6&&roll.results.every(value=>value!==3))cue.celebration='thumb-rain';
    if(cue.celebration)cue.diceExit=cue.finalReveal+4.8;
    return cue;
  }
  cue.presentation=mode==='d100'?'investigator':'adventurer';
  if(mode==='d100'){
    cue.total=percentileTotal(roll.results[0],roll.results[1]);
    const start=cue.firstBeam,travel=.42,reveal=start+.16+travel;
    for(const beam of cue.beams){beam.start=start;beam.travel=travel;beam.reveal=reveal;beam.maximumFace=false}
    cue.reveals=[reveal];cue.displayedTotals=[cue.total];cue.finalReveal=reveal;cue.finalBeamEnd=reveal+BEAM_AFTERGLOW;cue.diceExit=cue.finalBeamEnd+POST_BEAM_DICE_HOLD;
  }
  if((mode==='d20'&&cue.total===20)||(mode==='d100'&&cue.total===1))cue.celebration='confetti';
  if((mode==='d20'&&cue.total===1)||(mode==='d100'&&cue.total===100))cue.celebration='thumb-rain';
  if(cue.celebration)cue.diceExit=Math.max(cue.diceExit,cue.finalReveal+4.8);
  return cue;
}
