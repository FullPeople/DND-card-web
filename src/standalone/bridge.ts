// Compile-time replacement. No SDK, transport, timers, window discovery or room storage.
import type {getWorkbench as originalState,Target} from '../platform/workbench';
export type {Target,CardChoice,SharedRules,SharedDocument} from '../platform/workbench';
export const inWorkbench=false;
const state:ReturnType<typeof originalState>={cards:[],monsters:[],enabled:{},online:false,message:'',rolls:[]};
export const useWorkbench=()=>state;
export const getWorkbench=()=>state;
export const workbenchDiagnostics=()=>({transport:'local',pending:[],recent:[]});
export const chooseWorkbench=()=>{};
export const pinWorkbench=()=>{};
export const workbenchCharacterId=(target:Target)=>target.key;
export const patchWorkbenchStats=()=>({});
export async function workbenchRequest(){throw Error('此版本只使用本机角色数据');}
export const requestInventory=workbenchRequest;
export function composeRoll(expression:string,label=''){window.dispatchEvent(new CustomEvent('local-dice',{detail:{expression,label}}));}
