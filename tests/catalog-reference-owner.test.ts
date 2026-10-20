import {expect,it} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {syncFeatures} from '../src/core/sheet';
import {legacyCatalogId} from '../src/core/entryRecordIdentity';
const pointer='Shared Authored Ability|Authored Class|XPHB|Alpha|AUTH|3';
function setup(){
 const entries=normalizeData({class:[{name:'Authored Class',source:'XPHB',classFeatures:[]}],
  subclass:[{name:'Authored Subclass',shortName:'Alpha',source:'AUTH',edition:'one',className:'Authored Class',classSource:'XPHB',subclassFeatures:[pointer]}],
  subclassFeature:['Authored First Ability','Authored Second Ability'].map(name=>({name,ENG_name:'Shared Authored Ability',source:'AUTH',edition:'one',className:'Authored Class',classSource:'XPHB',subclassShortName:'Alpha',subclassSource:'AUTH',level:3,entries:[`Original ${name} body.`]}))},'r','authored');
 const character=newCharacter();character.automation=newAutomationState();character.profile.enabledSources=['XPHB','PHB','AUTH'];
 character.selections=[{id:'owner',entry:entries.find(entry=>entry.kind==='class')!,level:3,quantity:1,equipped:false},
  {id:'subclass',parentId:'owner',entry:entries.find(entry=>entry.kind==='subclass')!,level:3,quantity:1,equipped:false}];
 return {character,entries};
}
it('a new automatic grant never chooses the first of two ambiguous English references',()=>{
 const {character,entries}=setup();syncFeatures(character,entries);
 expect(character.selections.filter(row=>row.entry.kind==='feature')).toEqual([]);
});
it('an already selected owner snapshot survives an ambiguous catalog refresh',()=>{
 const {character,entries}=setup(),original=structuredClone(entries.find(entry=>entry.kind==='feature')!);
 original.id=legacyCatalogId(original);delete original.raw._catalogLegacyId;
 character.selections.push({id:'retained',parentId:'subclass',entry:original,grantKey:'ref:'+pointer,level:1,quantity:1,equipped:false});
 syncFeatures(character,[...entries].reverse());
 const retained=character.selections.find(row=>row.id==='retained');expect(retained?.entry).toEqual(original);expect(retained?.grantKey).toBe('ref:'+pointer);
});
it('an explicitly declared cross-book reference is not lost to the owning edition filter',()=>{
 const {character}=setup(),foreign=normalizeData({classFeature:[{name:'Foreign Authored Feature',source:'PHB',className:'Foreign Authored Class',classSource:'PHB',level:3,entries:['Original cross-book body.']}]},'r','authored');
 character.selections=character.selections.filter(row=>row.id==='owner');character.selections[0].entry.raw.classFeatures=['Foreign Authored Feature|Foreign Authored Class|PHB|3'];
 syncFeatures(character,foreign);expect(character.selections.find(row=>row.entry.kind==='feature')?.entry.name).toBe('Foreign Authored Feature');
});
