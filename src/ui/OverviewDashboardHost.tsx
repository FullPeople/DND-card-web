import {createContext,useContext,useState,type ReactNode} from 'react';
import {useWorkbench,type CardChoice} from '../platform/workbench';
import {OverviewResourceDashboard} from './OverviewResourceDashboard';
import {confirmResourceDraftDiscard} from './resourceDraftGuard';

type Open=(card:CardChoice,resourceId:string)=>void;
const OverviewDashboardContext=createContext<Open|undefined>(undefined);
export const useOverviewDashboard=()=>useContext(OverviewDashboardContext);
/** Editor ownership outlives the console page, roster filters and scene tokens.
 * Fresh access is checked on every render and again at the save boundary. */
export function OverviewDashboardHost({children}:{children:ReactNode}){
 const wb=useWorkbench(),[editing,setEditing]=useState<{card:CardChoice;resourceId:string;scope:string}>();
 const open:Open=(card,resourceId)=>{if(confirmResourceDraftDiscard())setEditing({card,resourceId,scope:JSON.stringify([wb.access?.room,wb.access?.scope])});};
 const live=editing&&wb.cards.find(card=>card.id===editing.card.id),sameScope=JSON.stringify([wb.access?.room,wb.access?.scope])===editing?.scope;
 const concealed=!sameScope||wb.access?.enabled.characterCards===false||!!wb.access&&!wb.access.cards.some(card=>card.id===editing?.card.id);
 const disabled=concealed||!wb.online||!live?.write||!live.inScene;
 return <OverviewDashboardContext.Provider value={open}>{children}{editing&&<OverviewResourceDashboard key={`${editing.card.id}:${editing.resourceId}`} card={live||editing.card} gm={wb.role==='GM'} disabled={disabled} concealed={concealed} initialResourceId={editing.resourceId==='new'?'':editing.resourceId} close={()=>setEditing(undefined)}/>}</OverviewDashboardContext.Provider>;
}
