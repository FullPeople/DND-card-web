import type {Character} from '../core/model';
import type {CloudCard} from './api';
import {characterHash,type SyncReceipt} from './sync';
import {sourceSettings,withSiteSources,type SiteSources} from '../core/siteSources';

/** The user selected this private card again. Different drafts never get a new baseline. */
export async function recoveredBinding(local:Character,remote:CloudCard,account:string,previous:SyncReceipt={},sources?:SiteSources):Promise<{receipt:SyncReceipt;character:Character}>{
 if(previous.binding||previous.pending||previous.lastError)throw Error('这张卡仍有待核对的同步记录，未替换原有记录。');
 if(!remote.role||local.id!=='cloud:'+account+':'+remote.id)throw Error('恢复卡的身份或云端权限不一致，未重新连接。');
 // Standard JSON exports carry the shared site's source view. Reconstruct
 // that split only when the visible card is identical and all personal data
 // also matches the authenticated remote original.
 const character=sources?withSiteSources(local,structuredClone(sourceSettings(remote.character.profile))):local;
 const [localHash,remoteHash,beforeView,afterView]=await Promise.all([characterHash(character),characterHash(remote.character),characterHash(withSiteSources(local,sources)),characterHash(withSiteSources(character,sources))]);
 if(localHash!==remoteHash||beforeView!==afterView)throw Error('本机恢复卡与云端内容不同，已保留两端数据。请先导出并核对差异，未覆盖任何一端。');
 return {character,receipt:{binding:{accountId:account,cloudId:remote.id,revision:remote.revision},hash:localHash,sourceId:remote.character.id}};
}
