import {standalone,automationDevelopment} from './buildMode';
import {inWorkbench} from './workbenchMode';
import {workspaceNamespace} from './workspaceNamespace';

const qqRoom=typeof location==='undefined'?null:new URLSearchParams(location.search).get('qqRoom');
const workbenchSession=!standalone&&inWorkbench?new URLSearchParams(location.hash.slice(1)).get('suite'):null;
export const workspaceIdentity=workspaceNamespace({qqRoom,workbenchSession,standalone,automationDevelopment});
