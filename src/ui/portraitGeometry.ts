/** Expand a contained image to the original cover size without clipping it. */
export function portraitCoverScale(imageWidth:number,imageHeight:number,frameWidth:number,frameHeight:number):number{
 if(![imageWidth,imageHeight,frameWidth,frameHeight].every(value=>Number.isFinite(value)&&value>0))return 1;
 const ratio=(imageWidth/imageHeight)/(frameWidth/frameHeight);
 return Math.max(ratio,1/ratio);
}
