/** Each paper follows its own arc; a gesture never translates the whole stage. */
export function galleryMotion(position:number,spacing:number){
 const depth=Math.min(3,Math.abs(position));
 return {transform:`translate3d(${Math.sin(position*.62)*spacing*1.7}px,calc(-50% + ${depth*depth*11}px),0) rotateZ(${position*5}deg) scale(${1-depth*.135})`,zIndex:1000-Math.round(depth*100)};
}
