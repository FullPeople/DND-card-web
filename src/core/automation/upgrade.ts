import {validateCharacter} from '../validation';
import {uid,type Character,type Entry} from '../model';
import {newAutomationState} from './state';
import {syncAutoResources,setResource} from '../resources';
import {syncFeatures} from '../sheet';
import {syncSourceSpells} from './sourceSpells';
import {rememberFeatureResources} from './featureResources';
import {rememberSourceSpellUses} from './sourceSpellState';
/** Explicit copy only. Unknown counters start spent; original receipts and card survive. */
export function copyWithIrAutomation(original:Character,entries:Entry[]):Character{
 const copy=structuredClone(original),before=structuredClone(original),known=new Set(Object.keys(original.runtime.resources));
 copy.id=uid();copy.name=`${original.name}（IR 副本）`;copy.createdAt=copy.updatedAt=new Date().toISOString();copy.revision=1;
 copy.automation={...copy.automation,...newAutomationState()};
 validateCharacter(copy);
 syncFeatures(copy,entries,{owners:new Set(copy.selections.map(row=>row.id)),refresh:false,suppressEquipment:true});syncSourceSpells(copy,entries);syncAutoResources(copy,before);
 for(const [key,resource]of Object.entries(copy.runtime.resources))if(!known.has(key))setResource(copy,key,0);
 rememberFeatureResources(copy);rememberSourceSpellUses(copy,undefined,true);return copy;
}
