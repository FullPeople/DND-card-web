// Dedicated private test copy. Never inherit the production auto-start settings.
import {readFileSync,statfsSync} from 'node:fs';
import {join} from 'node:path';
if(process.env.DND_CLOUD_RUN)throw Error('Production auto-start environment is forbidden in the isolated lab');
if(!process.env.CREDENTIALS_DIRECTORY?.startsWith('/run/credentials/'))throw Error('Systemd credential delivery required');
const env=new Map(readFileSync(join(process.env.CREDENTIALS_DIRECTORY,'qq.env'),'utf8').split(/\r?\n/).filter(row=>/^(QQ_APPID|QQ_APPKEY|QQ_CALLBACK)=/.test(row)).map(row=>{
 const at=row.indexOf('=');return [row.slice(0,at),row.slice(at+1).trim().replace(/^(['"])(.*)\1$/,'$2')];
}));
if(env.get('QQ_CALLBACK')!=='https://dnd.center/api/auth/qq/callback'||!env.get('QQ_APPID')||!env.get('QQ_APPKEY'))throw Error('Registered QQ configuration does not match the isolated lab');
const {CloudStore,createCloudServer}=await import(new URL('./server/server.mjs',import.meta.url));
const store=new CloudStore('/var/lib/dnd-card-cloud-lab2/cards.sqlite');
const server=createCloudServer(store,'https://dnd.center',{
 featuresEnabled:true,accountPrivate:true,trustedLoopbackProxy:true,
 freeBytes:()=>{const fs=statfsSync('/var/lib/dnd-card-cloud-lab2');return fs.bavail*fs.bsize;},
 qq:{appId:env.get('QQ_APPID'),appKey:env.get('QQ_APPKEY'),callback:env.get('QQ_CALLBACK')+'?cloud_lab=stage2',isolation:'stage2'},
});
server.listen(5015,'127.0.0.1',()=>console.log('Isolated QQ lab listening on loopback 5015; production database untouched'));
const stop=()=>{server.closeAllConnections();server.close(()=>{store.close();process.exit(0);});};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
