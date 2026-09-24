import type {Character,RulePack,RuleProfile} from './model';

export type SiteSources=Pick<RuleProfile,'enabledSources'|'disabledEntries'|'autoSourceDefaults'>;
interface SourceWorkspace {activeId:string;characters:Character[];siteSources?:SiteSources;legacySourceProfiles?:Record<string,SiteSources>}
export function sourceSettings(profile:SiteSources):SiteSources{
 return {enabledSources:profile.enabledSources,...(profile.disabledEntries?{disabledEntries:profile.disabledEntries}:{}),...(profile.autoSourceDefaults?{autoSourceDefaults:profile.autoSourceDefaults}:{})};
}
/** Migrate once from the visible card, preserving old per-card choices for recovery. */
export function ensureSiteSources<T extends SourceWorkspace>(workspace:T):T&SourceWorkspace{
 if(workspace.siteSources)return workspace;
 const selected=workspace.characters.find(c=>c.id===workspace.activeId)||workspace.characters[0];
 if(!selected)return workspace;
 const snapshots=Object.fromEntries(workspace.characters.map(c=>[c.id,structuredClone(sourceSettings(c.profile))]));
 return {...workspace,siteSources:structuredClone(snapshots[selected.id]),legacySourceProfiles:workspace.legacySourceProfiles||snapshots};
}
/** Source availability is shared; edition, optional rules and exceptions stay on the card. */
export function withSiteSources(character:Character,sources:SiteSources|undefined,packs?:RulePack[]):Character{
 if(!sources)return character;
 const {enabledSources:_,disabledEntries:__,autoSourceDefaults:___,...personal}=character.profile;
 return {...character,profile:{...personal,...sourceSettings(sources)},...(packs?{rulePacks:packs}:{})};
}
