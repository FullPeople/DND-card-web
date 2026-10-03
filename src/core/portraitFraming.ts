import type {PortraitFraming} from './model';

/** Copy only framing: token URLs and image bytes remain outside this preference. */
export function portraitFraming(image:PortraitFraming):PortraitFraming {
 const {x,y,zoom,frameWidth,frameHeight}=image;
 return {x,y,zoom,...(frameWidth===undefined?{}:{frameWidth}),...(frameHeight===undefined?{}:{frameHeight})};
}
