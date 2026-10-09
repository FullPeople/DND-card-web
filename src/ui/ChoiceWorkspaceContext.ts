import {createContext,useContext} from 'react';
export const ChoiceWorkspaceContext=createContext<{id?:string;host?:string;canEdit?:boolean;browse?:()=>void;open:(id:string,host?:string)=>void;close:()=>void}>({open:()=>{},close:()=>{}});
export const useChoiceWorkspace=()=>useContext(ChoiceWorkspaceContext);
