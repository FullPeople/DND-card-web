import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {readUiLanguage,writeUiLanguage,uiText,type UiLanguage,type UiTextKey} from './uiText';
const Context=createContext({language:'zh' as UiLanguage,setLanguage:(_value:UiLanguage)=>{},t:(key:UiTextKey,values?:Record<string,string|number>)=>uiText('zh',key,values)});
export function UiLanguageProvider({children}:{children:ReactNode}){
 const [language,setValue]=useState(readUiLanguage);
 const setLanguage=useCallback((value:UiLanguage)=>{setValue(value);writeUiLanguage(value);},[]);
 useEffect(()=>{document.documentElement.lang=language==='en'?'en':'zh-CN';},[language]);
 const value=useMemo(()=>({language,setLanguage,t:(key:UiTextKey,values?:Record<string,string|number>)=>uiText(language,key,values)}),[language,setLanguage]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useUiLanguage=()=>useContext(Context);
