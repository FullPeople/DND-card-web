import type {ResourceValue} from './resourcePresets';
export function resourceEditorDraft(base:ResourceValue|undefined,{name,max,current,unlimited,locked,type}:{name:string;max:string;current:string;unlimited:boolean;locked:boolean;type:string}):ResourceValue{
  if(!base)return {name:name.trim(),max:Number(max),current:Number(current),type:unlimited?'number':type,unlimited,locked,icon:'gem'};
  const next={...base};
  if(name.trim()!==(base.name||''))next.name=name.trim();
  if(Number(current)!==base.current)next.current=Number(current);
  if(Number(max)!==base.max){next.max=Number(max);if(base.featureGrant)next.featureGrant={...base.featureGrant,manualMax:true};}
  if(unlimited!==!!base.unlimited){next.unlimited=unlimited;next.type=unlimited?'number':type;}
  if(locked!==!!base.locked)next.locked=locked;
  return next;

}
