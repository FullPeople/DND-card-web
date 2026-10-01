import {createContext,useContext} from 'react';
export const ChoiceWorkspaceContext=createContext<{id?:string;open:(id:string)=>void;close:()=>void}>({open:()=>{},close:()=>{}});
export const useChoiceWorkspace=()=>useContext(ChoiceWorkspaceContext);
