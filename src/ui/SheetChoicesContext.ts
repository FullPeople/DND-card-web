import {createContext,useContext,useMemo} from 'react';
import {sheetChoices,type SheetChoice} from '../core/automation/choices';
import {sameCharacterMechanics} from '../core/displayCharacterEdit';
import type {Character,Entry} from '../core/model';

/** Only immutable UI snapshots belong here. Mutable core edits call sheetChoices directly. */
export type SheetChoicesSnapshot={character:Character;catalog:Entry[];choices:SheetChoice[]};
export const SheetChoicesContext=createContext<SheetChoicesSnapshot|undefined>(undefined);
export function choicesForSnapshot(snapshot:SheetChoicesSnapshot|undefined,character:Character,catalog:Entry[]):SheetChoice[]{
 return snapshot&&snapshot.catalog===catalog&&sameCharacterMechanics(snapshot.character,character)?snapshot.choices:sheetChoices(character,catalog);
}
/** Independently mounted previews retain a local, mutation-free fallback. */
export function useSheetChoices(character:Character,catalog:Entry[]):SheetChoice[]{
 const snapshot=useContext(SheetChoicesContext);
 return useMemo(()=>choicesForSnapshot(snapshot,character,catalog),[snapshot,character,catalog]);
}
