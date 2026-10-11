export type WorkspaceNamespaceOptions={qqRoom?:string|null;workbenchSession?:string|null;standalone:boolean;automationDevelopment:boolean};

/** A workspace lock must protect precisely the database that it owns. */
export function workspaceNamespace(options:WorkspaceNamespaceOptions){
 if(options.qqRoom){const database='dnd-card-qq-room:'+options.qqRoom;return {database,cacheDatabase:database,editorLock:'dnd-qq-room-editor:'+options.qqRoom,legacyRecoveries:false};}
 if(options.workbenchSession){const scope=encodeURIComponent(options.workbenchSession),database='dnd-card-workbench:'+scope;return {database,cacheDatabase:'dnd-card-workspace',editorLock:'dnd-card-workbench-editor:'+scope,legacyRecoveries:true};}
 const database=options.automationDevelopment?'dnd-card-automation-choices-20261001':options.standalone?'dnd-card-standalone':'dnd-card-workspace';
 return {database,cacheDatabase:database,editorLock:'dnd-card-editor',legacyRecoveries:false};
}

/** Read only legacy drafts belonging to the host's current reading directory. */
export function legacyRecoveryIds(access:{room:string;cards:{id:string}[];enabled:Record<string,boolean>}|undefined){
 return !access||access.enabled.characterCards===false?[]:access.cards.map(card=>`suite:${access.room}:card:${card.id}`);
}
