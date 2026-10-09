/** Read-only page identity, also safe while rendering UI outside a browser. */
const params=new URLSearchParams(typeof location==='undefined'?'':location.hash.slice(1));
export const inWorkbench=!!params.get('suite')&&typeof location!=='undefined'&&params.get('bridge')===location.origin;
