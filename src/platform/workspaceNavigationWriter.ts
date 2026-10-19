import type {Workspace} from './storage';

/** Navigation is metadata; content and backup transactions remain full snapshots. */
export function workspaceNavigationWriter(write:(workspace:Workspace)=>Promise<void>,select:(workspace:Workspace)=>Promise<void>){
 let saved:Workspace|undefined;
 return async(next:Workspace)=>{
  const keys=new Set([...Object.keys(saved||{}),...Object.keys(next)]);
  const navigationOnly=!!saved&&[...keys].every(key=>key==='activeId'||saved![key as keyof Workspace]===next[key as keyof Workspace]);
  if(navigationOnly)await select(next);else await write(next);
  saved=next;
 };
}
