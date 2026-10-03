import type {ReactNode} from 'react';
import './standalone.css';
export const WorkbenchBar=()=>null;
export const DicePage=()=>null;
export const WorkbenchMonster=()=>null;
export const DMConsole=()=>null;
export const WorkbenchPanel=()=>null;
export const MusicWorkspace=()=>null;
export const DmNotes=()=>null;
export const SupporterEffect=()=>null;

/** The overview editor owns remote room resources; standalone needs only its children. */
export const OverviewDashboardHost=({children}:{children:ReactNode})=>children;
