import type {Character,Entry} from '../core/model';
import {hydrateImportedCasting} from '../core/castingSnapshot';
import {syncFeatures} from '../core/sheet';
import {syncAutoResources} from '../core/resources';
import type {entryNameIndex} from '../core/entryNameIndex';

/** The normal 303 first-open check, on a disposable view. The caller owns saves. */
export function reconciledCardView(character:Character,entries:Entry[],names:ReturnType<typeof entryNameIndex>,syncSourceSpells:(character:Character,entries:Entry[])=>boolean):Character|undefined{
 const draft=structuredClone(character);
 const castingChanged=hydrateImportedCasting(draft,entries);
 const featuresChanged=syncFeatures(draft,entries,undefined,names),resourcesChanged=syncAutoResources(draft),sourceSpellsChanged=syncSourceSpells(draft,entries);
 return featuresChanged||resourcesChanged||castingChanged||sourceSpellsChanged?draft:undefined;
}
