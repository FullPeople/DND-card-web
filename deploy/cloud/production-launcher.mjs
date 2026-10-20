// The production service keeps its existing StateDirectory and database inode.
import {readFileSync,statfsSync} from 'node:fs';
import {join} from 'node:path';
if(!process.env.CREDENTIALS_DIRECTORY?.startsWith('/run/credentials/'))throw Error('Systemd credential delivery required');
if(process.env.DND_CLOUD_DB&&process.env.DND_CLOUD_DB!=='/var/lib/dnd-card-cloud/cards.sqlite')throw Error('Unexpected production database; refusing startup');
const credentials=new Map(readFileSync(join(process.env.CREDENTIALS_DIRECTORY,'qq.env'),'utf8').split(/\r?\n/).filter(row=>/^(QQ_APPID|QQ_APPKEY|QQ_CALLBACK)=/.test(row)).map(row=>{
 const at=row.indexOf('=');return [row.slice(0,at),row.slice(at+1).trim().replace(/^(['"])(.*)\1$/,'$2')];
}));
if(credentials.get('QQ_CALLBACK')!=='https://dnd.center/api/auth/qq/callback'||!credentials.get('QQ_APPID')||!credentials.get('QQ_APPKEY'))throw Error('Registered production QQ configuration is incomplete');
const release=JSON.parse(readFileSync(new URL('./release.json',import.meta.url),'utf8'));
if(release.scope!=='standalone-private-cloud-production'||!/^[a-f0-9]{40}$/.test(release.sourceCommit)||!/^standalone-1\.0\.\d+$/.test(release.version))throw Error('Invalid production release identity');
// The old unit supplies DND_CLOUD_RUN; explicit startup below owns this process.
delete process.env.DND_CLOUD_RUN;
const {CloudStore,createCloudServer}=await import(new URL('./server.mjs',import.meta.url));
const store=new CloudStore('/var/lib/dnd-card-cloud/cards.sqlite');
const server=createCloudServer(store,'https://dnd.center',{
 featuresEnabled:true,standaloneOnly:true,accountPrivate:true,trustedLoopbackProxy:true,buildVersion:release.version.replace('standalone-',''),
 freeBytes:()=>{const disk=statfsSync('/var/lib/dnd-card-cloud');return disk.bavail*disk.bsize;},
 qq:{appId:credentials.get('QQ_APPID'),appKey:credentials.get('QQ_APPKEY'),callback:credentials.get('QQ_CALLBACK')},
});
server.listen(5014,'127.0.0.1',()=>console.log('Standalone private cloud ready on loopback 5014; original production database retained'));
const stop=()=>{server.closeChanges();server.closeAllConnections();server.close(()=>{store.close();process.exit(0);});};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
