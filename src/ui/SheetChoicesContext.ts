import {useSheetContext} from './scopedSheetContext';
import {createContext,useMemo} from 'react';
import {sheetChoices,type SheetChoice} from '../core/automation/choices';
import {sameCharacterMechanics} from '../core/displayCharacterEdit';
import type {Character,Derived,Entry} from '../core/model';

/** Only immutable UI snapshots belong here. Mutable core edits call sheetChoices directly. */
export type SheetChoicesSnapshot={character:Character;catalog:Entry[];choices:SheetChoice[];derived?:Derived};
export const SheetChoicesContext=createContext<SheetChoicesSnapshot|undefined>(undefined);
export function choicesForSnapshot(snapshot:SheetChoicesSnapshot|undefined,character:Character,catalog:Entry[]):SheetChoice[]{
 return snapshot&&snapshot.catalog===catalog&&sameCharacterMechanics(snapshot.character,character)?snapshot.choices:sheetChoices(character,catalog);
}
/** Numeric results belong to the same immutable card view; they never carry authority. */
export function derivedForSnapshot(snapshot:SheetChoicesSnapshot|undefined,character:Character):Derived|undefined{
 return snapshot&&sameCharacterMechanics(snapshot.character,character)?snapshot.derived:undefined;
}
export function useSheetDerived(character:Character):Derived|undefined{
 return derivedForSnapshot(useSheetContext('choices',SheetChoicesContext),character);
}
export function useSheetMechanics(character:Character):Character{
 const snapshot=useSheetContext('choices',SheetChoicesContext);
 return snapshot&&sameCharacterMechanics(snapshot.character,character)?snapshot.character:character;
}
/** Independently mounted previews retain a local, mutation-free fallback. */
export function useSheetChoices(character:Character,catalog:Entry[]):SheetChoice[]{
 const snapshot=useSheetContext('choices',SheetChoicesContext);
 const mechanics=snapshot&&sameCharacterMechanics(snapshot.character,character)?snapshot.character:character;
 return useMemo(()=>choicesForSnapshot(snapshot,mechanics,catalog),[snapshot,mechanics,catalog]);
}
