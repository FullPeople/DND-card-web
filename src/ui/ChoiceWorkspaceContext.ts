import {useSheetContext} from './scopedSheetContext';
import {createContext} from 'react';
export const ChoiceWorkspaceContext=createContext<{id?:string;host?:string;coverOverview?:boolean;canEdit?:boolean;browse?:()=>void;open:(id:string,host?:string)=>void;close:()=>void}>({open:()=>{},close:()=>{}});
export const useChoiceWorkspace=()=>useSheetContext('choice',ChoiceWorkspaceContext);
