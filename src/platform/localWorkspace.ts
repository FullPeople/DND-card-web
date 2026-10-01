import type {Workspace} from './storage';
/**
 * Server-hosted characters appear in the in-memory workspace as `server:<uuid>`.
 * Their authority is the server; the sync cache/outbox is their only local copy.
 * This is the single boundary every legacy workspace write passes through.
 */
export const MANAGED_PREFIX='server:';
export const isManaged=(id:string|undefined)=>!!id?.startsWith(MANAGED_PREFIX);
/**
 * The workspace as it may be stored locally: no `server:*` rows and an activeId
 * that names a local row. Undefined when no local character remains, in which
 * case the caller must not write (an empty or server-only workspace is invalid).
 */
export function localOnlyWorkspace(workspace:Workspace):Workspace|undefined{
  const characters=workspace.characters.filter(row=>!isManaged(row.id));
  if(!characters.length)return undefined;
  const activeId=characters.some(row=>row.id===workspace.activeId)?workspace.activeId:characters[0].id;
  return characters.length===workspace.characters.length&&activeId===workspace.activeId?workspace:{...workspace,characters,activeId};
}
