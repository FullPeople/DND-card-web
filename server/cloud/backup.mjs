import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,readdirSync,chmodSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
const source=process.env.DND_CLOUD_DB||'/var/lib/dnd-card-cloud/cards.sqlite';
const destination=process.env.DND_CLOUD_BACKUPS||'/var/backups/dnd-card-cloud';
mkdirSync(destination,{recursive:true,mode:0o700});
const filename='cards-'+new Date().toISOString().replaceAll(':','-')+'.sqlite',target=join(destination,filename),database=new DatabaseSync(source,{readOnly:true});
try{await backup(database,target);}finally{database.close();}
chmodSync(target,0o600);const check=new DatabaseSync(target,{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup integrity failure');}finally{check.close();}
const files=readdirSync(destination).filter(name=>/^cards-\d{4}-\d{2}-\d{2}T[\d.-]+Z\.sqlite$/.test(name)).sort();
for(const name of files.slice(0,-14))unlinkSync(join(destination,name));
console.log('Verified SQLite backup: '+filename);
