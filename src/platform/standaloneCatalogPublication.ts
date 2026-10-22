import type {Character,Entry,RulePack} from '../core/model';
import {includeNewProfileSources} from '../core/sourceDefaults';
import {sourceSettings,type SiteSources} from '../core/siteSources';
import {SIZE_ENTRIES} from '../data/sizes';
import {snapshotMemo} from './snapshotMemo';
import {settledSnapshotCheck} from './settledSnapshotCheck';
import {standaloneCardViews,prepareStandaloneCards,CardPreparationContextChanged,yieldCardPreparation} from './standaloneCardViews';

export type CatalogBasis={characters:Character[];sources:SiteSources|undefined;packs:RulePack[];custom:Entry[];author:boolean;monsters:boolean;writable:boolean};
export function sameCatalogBasis(a:CatalogBasis,b:CatalogBasis){
 return a.characters===b.characters&&a.sources===b.sources&&a.packs===b.packs&&a.custom===b.custom&&a.author===b.author&&a.monsters===b.monsters&&a.writable===b.writable;
}
export function cardCatalogEntries(raw:Entry[],basis:Pick<CatalogBasis,'packs'|'custom'|'author'|'monsters'>){
 return [...SIZE_ENTRIES,...raw,...basis.packs.flatMap(pack=>pack.entries.map(entry=>({...entry,raw:{...entry.raw,_customPack:true}}))),...(basis.author?basis.custom:[])].filter(entry=>basis.monsters||entry.kind!=='monster');
}
/** Stage a complete read context without publishing partial rules or touching a card.
 * The caller must discard it if any card, source, rule pack or permission changes. */
export async function prepareStandaloneCatalog(raw:Entry[],basis:CatalogBasis,options:{signal:AbortSignal;current:()=>CatalogBasis;yield?:()=>Promise<void>;syncSourceSpells?:Parameters<ReturnType<typeof standaloneCardViews>['warmReconciliation']>[1]}){
 const entries=cardCatalogEntries(raw,basis),defaults=[...new Set(entries.flatMap(e=>[e.source,...(e.dependencies||[])]))];
 const extended=basis.sources&&basis.writable?includeNewProfileSources(basis.sources,defaults):basis.sources;
 const sources=extended===basis.sources?basis.sources:sourceSettings(extended!);
 const remember=snapshotMemo(),check=settledSnapshotCheck(true),views=standaloneCardViews(entries,sources,basis.packs,remember,check);
 const current=()=>sameCatalogBasis(basis,options.current());
 const pause=options.yield||(()=>yieldCardPreparation(options.signal,true));
 await prepareStandaloneCards(basis.characters,views,{signal:options.signal,current,yield:pause});
 if(options.syncSourceSpells)for(const card of basis.characters){
  await pause();if(options.signal.aborted)throw new DOMException('Catalog preparation cancelled','AbortError');
  if(!current())throw new CardPreparationContextChanged();views.warmReconciliation(card,options.syncSourceSpells);
 }
 if(!current())throw new CardPreparationContextChanged();
 return {raw,basis,entries,sources,remember,check,views};
}
export type PreparedStandaloneCatalog=Awaited<ReturnType<typeof prepareStandaloneCatalog>>;
