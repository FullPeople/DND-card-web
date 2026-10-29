// Negative startup probe: no guard marker, but fetch is denied from startup.
// No native fetch is retained or restored, even if source hooks ran by mistake.
let count=0;
Object.defineProperty(globalThis,'fetch',{value:async()=>{count++;throw Error('Missing-guard probe blocks every external fetch.');},writable:true,configurable:true});
process.once('exit',()=>process.stderr.write(`missing-guard-probe-fetch-count=${count}\n`));
