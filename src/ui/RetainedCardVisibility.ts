import {createContext,useContext} from 'react';
export const RetainedCardVisibility=createContext(true);
export const useRetainedCardActive=()=>useContext(RetainedCardVisibility);
export const RetainedCardCaptureTarget=createContext<(()=>boolean)|undefined>(undefined);
export const useRetainedCaptureTarget=()=>useContext(RetainedCardCaptureTarget);
