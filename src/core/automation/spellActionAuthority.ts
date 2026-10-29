import type {Character} from '../model';
/** Transient application authority, never read from saved cards or requests. */
export interface SpellActionAuthority {canEdit?:boolean;gm?:boolean}
export function liveSpellActionAuthority(value?:SpellActionAuthority):{canEdit:boolean;gm:boolean;valid:boolean}{
 if(value===undefined)return {canEdit:true,gm:false,valid:true};
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return {canEdit:false,gm:false,valid:false};
 for(const key of ['canEdit','gm'] as const)if(key in value&&(!Object.hasOwn(value,key)||typeof value[key]!=='boolean'))return {canEdit:false,gm:false,valid:false};
 return {canEdit:!Object.hasOwn(value,'canEdit')||value.canEdit===true,gm:Object.hasOwn(value,'gm')&&value.gm===true,valid:true};
}
export function spellActionAuthorityReason(c:Character,authority?:SpellActionAuthority,resources:readonly string[]=[]):string|undefined{
 const live=liveSpellActionAuthority(authority);
 if(!live.valid||!live.canEdit)return '当前角色卡只读或编辑权限无效，未执行。';
 if(c.locked!==undefined&&typeof c.locked!=='boolean'||c.locked===true&&!live.gm)return '角色卡已锁定，需要当前主持人权限。';
 for(const id of resources){const r=c.runtime.resources[id];if(r&&(r.locked!==undefined&&typeof r.locked!=='boolean'||r.locked===true&&!live.gm))return '所需资源已锁定，需要当前主持人权限。';}
}
