import {uid,type Character} from '../core/model';
export function cardSyncCopies(original:Character,migrated:Character,now=new Date().toISOString()){
 const backup=structuredClone(original);backup.id=uid();backup.name=`${original.name}（同步前备份）`;backup.revision=1;backup.createdAt=backup.updatedAt=now;
 const current=structuredClone(migrated);current.id=original.id;current.name=original.name;current.createdAt=original.createdAt;current.updatedAt=now;current.revision=original.revision+1;
 return {backup,current};
}
