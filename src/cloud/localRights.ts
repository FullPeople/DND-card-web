import {qqRoom,roomState} from './room';
/** Outside the workbench the user is their own DM, except on the cloud room page where only the cloud owner holds DM-type rights (resource locks). */
export const localGm=()=>!qqRoom||roomState()?.owner===true;
