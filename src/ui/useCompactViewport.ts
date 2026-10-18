import {useSyncExternalStore} from 'react';
const query='(max-width: 760px)';
const subscribe=(notify:()=>void)=>{const media=window.matchMedia(query);media.addEventListener('change',notify);return()=>media.removeEventListener('change',notify);};
const snapshot=()=>typeof window!=='undefined'&&window.matchMedia(query).matches;
export function useCompactViewport(){return useSyncExternalStore(subscribe,snapshot,()=>false);}
