import OBR,{type Item} from '@owlbear-rodeo/sdk';
import {BIND,OWN_HP,LEGACY_HP,packet,valid,type Snapshot} from './protocol';
export type Value=Omit<Snapshot,'revision'>;
export interface Adapter{selected():Promise<string|undefined>;read(id:string):Promise<Value>;write(id:string,hp:number,expected:Value):Promise<void>;onChange(callback:()=>void):()=>void;}
export async function adapter():Promise<Adapter>{
 if(new URLSearchParams(location.search).get('demo')==='1'&&!new URLSearchParams(location.search).has('obrref'))return demo();
 if(!OBR.isAvailable)throw Error('请从枭熊房间中的测试插件打开。');
 await new Promise<void>(resolve=>OBR.onReady(resolve));
 let generation=0;OBR.scene.onReadyChange(()=>generation++);
 async function allowed(item:Item){
  if(await OBR.player.getRole()==='GM')return true;
  const player=await OBR.player.getId(),bound=item.metadata[BIND];
  const meta=await OBR.scene.getMetadata(),cards=meta['com.character-cards/list'];
  const card=Array.isArray(cards)?cards.find(c=>c?.id===bound):undefined;
  if(card?.visibility==='dm')return false;
  const owners=Array.isArray(card?.owner_ids)?card.owner_ids:[];
  return owners.length?owners.includes(player):item.createdUserId===player;
 }
 function value(item:Item):Value{const data=(item.metadata[OWN_HP]??item.metadata[LEGACY_HP]) as Record<string,unknown>|undefined;
  if(!data||typeof data.health!=='number'||!Number.isFinite(data.health))throw Error('该棋子还没有当前生命值，请先用 Full Suite 设置。');
  return {itemId:item.id,name:item.name,hp:data.health,max:typeof data['max health']==='number'?data['max health']:data.health,binding:String(item.metadata[BIND]||''),scope:String(generation)};}
 async function read(id:string){if(!await OBR.scene.isReady())throw Error('场景已关闭，请重新连接。');const item=(await OBR.scene.items.getItems([id]))[0];if(!item)throw Error('棋子已移除或场景已切换，请重新连接。');if(!await allowed(item))throw Error('当前玩家没有该棋子的操作权限。');return value(item);}
 return {selected:async()=>{const ids=await OBR.player.getSelection();return ids?.length===1?ids[0]:undefined;},read,write:async(id,hp,expected)=>{
  const epoch=generation,current=await read(id);if(JSON.stringify(current)!==JSON.stringify(expected))throw Error('生命值已变化，已刷新，请重试。');
  let applied=false;await OBR.scene.items.updateItems([id],items=>{if(epoch!==generation)throw Error('场景已切换。');const item=items[0];if(!item||JSON.stringify(value(item as Item))!==JSON.stringify(expected))throw Error('棋子数据已变化，请重试。');
   const own=(item.metadata[OWN_HP]??item.metadata[LEGACY_HP]??{}) as Record<string,unknown>;item.metadata[OWN_HP]={...own,health:hp};
   if(item.metadata[LEGACY_HP])item.metadata[LEGACY_HP]={...(item.metadata[LEGACY_HP] as Record<string,unknown>),health:hp};applied=true;
  });if(!applied)throw Error('没有写入棋子。');
 },onChange:callback=>{const off=[OBR.scene.items.onChange(callback),OBR.scene.onReadyChange(callback),OBR.player.onChange(callback),OBR.scene.onMetadataChange(callback)];return()=>off.forEach(f=>f());}};
}
function demo():Adapter{
 const parentOrigin=new URLSearchParams(location.search).get('parentOrigin')||location.origin;
 let state:Value={itemId:'test-token',name:'测试角色',hp:20,max:20,binding:'test-card',scope:'0'},available=true,permission=true;
 const listeners=new Set<()=>void>();function emit(){listeners.forEach(f=>f());window.parent.postMessage(packet('demo-state',{...state,available,permission}),parentOrigin);}
 window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==parentOrigin||!valid(e.data))return;const m=e.data;
  if(m.type==='demo-edit'&&Number.isInteger(m.hp)){state={...state,hp:Number(m.hp)};emit();}
  if(m.type==='demo-gone'){available=false;emit();}if(m.type==='demo-deny'){permission=false;emit();}
 });
 async function read(){if(!available)throw Error('场景已切换，请重新连接。');if(!permission)throw Error('操作权限已撤销。');return {...state};}
 setTimeout(emit,50);
 return {selected:async()=>state.itemId,read,write:async(_,hp,expected)=>{await read();if(state.hp!==expected.hp)throw Error('生命值已变化。');state={...state,hp};emit();},onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
}
