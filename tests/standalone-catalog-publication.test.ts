import {expect,it,vi} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {sourceSettings} from '../src/core/siteSources';
import {sheetChoices} from '../src/core/automation/choices';
import {evaluate} from '../src/core/engine';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {cardCatalogEntries,prepareStandaloneCatalog,preparedCatalogEntries,sameCatalogBasis,type CatalogBasis} from '../src/platform/standaloneCatalogPublication';
import {CardPreparationContextChanged} from '../src/platform/standaloneCardViews';
import {runtimeCharacterBase} from '../src/core/runtimeCharacterEdit';
import {withSiteSources} from '../src/core/siteSources';
import {cardMigrationIssues} from '../src/core/cardMigrationIssues';

const raw:Entry[]=[{id:'authored:new-source',kind:'feature',name:'Authored publication fixture',english:'Authored publication fixture',source:'NEW',edition:'2024',packId:'fixture',revision:'1',entries:[],raw:{}}];
function setup(){const cards=[newCharacter(),newCharacter(),newCharacter()];const profile=sourceSettings({...cards[0].profile,autoSourceDefaults:['XPHB'],enabledSources:['XPHB']});const basis:CatalogBasis={characters:cards,sources:profile,packs:[],custom:[],author:true,monsters:true,writable:true};return basis;}
const pause=async()=>{};

it('prepares all cards and source defaults before publication, then reuses the exact prepared results',async()=>{
 const basis=setup(),before=JSON.stringify(basis),checks=vi.fn(syncSourceSpells);
 const prepared=await prepareStandaloneCatalog(raw,basis,{signal:new AbortController().signal,current:()=>basis,yield:pause,syncSourceSpells:checks});
 expect(JSON.stringify(basis)).toBe(before);expect(prepared.sources?.enabledSources).toContain('NEW');expect(basis.sources?.enabledSources).not.toContain('NEW');
 expect(prepared.names).toBe(prepared.views.nameIndex());expect(prepared.names.get(raw[0].name.toLowerCase())).toContain(raw[0]);
 for(const card of [basis.characters[2],basis.characters[0],basis.characters[1],basis.characters[2]]){
  expect(prepared.views.ready(card)).toBe(true);expect(prepared.views.reconciliationReady(card)).toBe(true);
  const build=prepared.views.build(card),display=prepared.views.display(card);
  const compute=vi.fn(()=>{throw Error('Prepared result recomputed');});
  expect(prepared.remember('choices',build,compute)).toEqual(sheetChoices(build,prepared.entries));
  expect(prepared.remember('derived',display,compute)).toEqual(evaluate(display));expect(compute).not.toHaveBeenCalled();
  const expectedWarning=cardMigrationIssues(withSiteSources(card,prepared.sources,basis.packs),prepared.entries).length>0;
  expect(prepared.remember('navigation-review',runtimeCharacterBase(card),compute)).toBe(expectedWarning);expect(prepared.views.warning(card)).toBe(expectedWarning);expect(compute).not.toHaveBeenCalled();
 }
 expect(checks).toHaveBeenCalledTimes(3);
});

it.each(['characters','sources','packs','custom','author','monsters','writable'] as const)('discards preparation after %s changes',async key=>{
 const basis=setup();let current=basis;
 await expect(prepareStandaloneCatalog(raw,basis,{signal:new AbortController().signal,current:()=>current,yield:async()=>{current={...basis,[key]:typeof basis[key]==='boolean'?!basis[key]:Array.isArray(basis[key])?[...basis[key]]:{...basis[key]}};}})).rejects.toBeInstanceOf(CardPreparationContextChanged);
});

it('does not invalidate unchanged card bodies for a navigation-only workspace change',()=>{
 const basis=setup();expect(sameCatalogBasis(basis,{...basis})).toBe(true);
 const edited={...basis,characters:basis.characters.map((card,index)=>index?card:{...card,abilities:{...card.abilities,str:18}})};
 expect(sameCatalogBasis(basis,edited)).toBe(false);
});

it('preserves disabled sources and never changes read-only source defaults',async()=>{
 const basis=setup();basis.sources={...basis.sources!,autoSourceDefaults:['XPHB','NEW'],enabledSources:['XPHB']};
 const disabled=await prepareStandaloneCatalog(raw,basis,{signal:new AbortController().signal,current:()=>basis,yield:pause});
 expect(disabled.sources?.enabledSources).not.toContain('NEW');expect(disabled.sources?.autoSourceDefaults).toContain('NEW');
 const readonly={...setup(),writable:false};const prepared=await prepareStandaloneCatalog(raw,readonly,{signal:new AbortController().signal,current:()=>readonly,yield:pause});
 expect(prepared.sources).toBe(readonly.sources);
});

it('cancels without publishing or changing cards and keeps the original catalog composition',async()=>{
 const basis=setup(),before=JSON.stringify(basis),controller=new AbortController();
 await expect(prepareStandaloneCatalog(raw,basis,{signal:controller.signal,current:()=>basis,yield:async()=>controller.abort()})).rejects.toMatchObject({name:'AbortError'});
 expect(JSON.stringify(basis)).toBe(before);expect(cardCatalogEntries(raw,basis).at(-1)).toBe(raw[0]);
});

it('keeps the prepared context coherent when navigation precedes the deferred catalog state commit',async()=>{
 const basis=setup(),prepared=await prepareStandaloneCatalog(raw,basis,{signal:new AbortController().signal,current:()=>basis,yield:pause});
 const oldRaw:Entry[]=[];expect(prepared.sources).not.toBe(basis.sources);expect(preparedCatalogEntries(prepared,oldRaw,basis)).toBeUndefined();
 const navigated={...basis,sources:prepared.sources};expect(preparedCatalogEntries(prepared,oldRaw,navigated)).toBe(prepared.entries);expect(preparedCatalogEntries(prepared,raw,navigated)).toBe(prepared.entries);
 expect(preparedCatalogEntries(prepared,oldRaw,{...navigated,custom:[...basis.custom]})).toBeUndefined();expect(preparedCatalogEntries(prepared,oldRaw,{...navigated,packs:[...basis.packs]})).toBeUndefined();expect(preparedCatalogEntries(prepared,oldRaw,{...navigated,monsters:false})).toBeUndefined();
});
