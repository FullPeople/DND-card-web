/** A queued intent belongs to one uninterrupted grant. Regranting Owner cannot
 * revive an edit made before revocation or an unverified reconnect. */
let generation=0;
const targets=new Map<string,number>();
export const permissionChanged=()=>Object.assign(Error('当前角色的写入权限或连接已改变，请重新核对后编辑'),{permissionChanged:true});
export function invalidateWriteIntents(ids?:readonly string[]){
 if(!ids){generation++;targets.clear();return;}
 for(const id of ids)targets.set(id,(targets.get(id)||0)+1);
}
export function captureWriteIntent(...ids:string[]){
 const current=generation,versions=ids.map(id=>targets.get(id)||0);
 return ()=>{if(current!==generation||ids.some((id,index)=>(targets.get(id)||0)!==versions[index]))throw permissionChanged();};
}
