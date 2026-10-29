import {newCharacter,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {createCustomEntry} from '../../src/core/customEntries';
import {planRacialAbilities} from '../../src/core/racialAbilities';
import {syncFeatures} from '../../src/core/sheet';
import {sourceLevelHpComponent,sourceLevelHpCatalogEntries,sourceLevelHpFind,sourceLevelHpSpecs} from './sourceLevelHpSourceFixture';

// Source ownership and manual state are set up here; no source HP is granted,
// no acknowledgement is fabricated and no actor/projection is imported.
export function sourceLevelHpFixture(key=sourceLevelHpSpecs[0].key,form:'canonical'|'app'='canonical'){
 const spec=sourceLevelHpSpecs.find(row=>row.key===key);if(!spec)throw Error('SOURCE_LEVEL_HP_FIXTURE_UNREVIEWED_KEY');
 const entry=structuredClone(sourceLevelHpFind(key,form)),catalog=structuredClone(sourceLevelHpCatalogEntries(form)),edition=entry.edition==='2024'?'2024':'2014',c=newCharacter(edition);c.automation=newAutomationState();c.profile.optional.multiclass=true;
 const classPath=spec.ownerPath||(edition==='2024'?'class/1':'class/0'),classEntry=structuredClone(sourceLevelHpComponent(classPath,form));
 const classOwner:Selection={id:'source-level-hp-native-class',entry:classEntry,quantity:1,level:3,equipped:false};
 // An explicit manual second class proves total7 != own Sorcerer3 without
 // fabricating a native class ID or requiring a third original input.
 const otherEntry=createCustomEntry({type:'class',name:'Authored non-Sorcerer level context',english:'Authored other class',body:'',raw:{hd:{number:1,faces:8}}});
 const otherClass:Selection={id:'source-level-hp-authored-other-class',entry:otherEntry,quantity:1,level:4,equipped:false};
 const owner:Selection={id:'source-level-hp-source-owner',entry,quantity:1,level:entry.kind==='subclass'?classOwner.level:1,equipped:false,...(entry.kind==='subclass'?{parentId:classOwner.id}:{})};
 c.selections=[classOwner,otherClass,owner];c.profile.enabledSources=[...new Set([entry.source,classEntry.source,otherEntry.source,...(entry.dependencies||[]),...(classEntry.dependencies||[])])];
 // The actual existing synchronizer attaches only the native declared top
 // feature. The nested HP target is not dragged or invented as saved authority.
 syncFeatures(c,catalog);
 const top=spec.topFeaturePath?c.selections.find(row=>row.parentId===owner.id&&row.grantKey===spec.references![0].grantKey&&row.entry.id===sourceLevelHpComponent(spec.topFeaturePath!,form).id):undefined;
 if(spec.topFeaturePath&&(!top||c.selections.filter(row=>row.parentId===owner.id&&row.grantKey===spec.references![0].grantKey).length!==1))throw Error('SOURCE_LEVEL_HP_FIXTURE_NATIVE_TOP_NOT_ATTACHED');
 c.baseHp=40;c.sheetBonuses={hp:2,ac:1};c.abilities.con=14;
 if(entry.kind==='race')c.abilities.con-=planRacialAbilities(c,owner).bonuses.con||0;
 c.notes='Authored HP preservation note, not source authority';c.size='M';c.runtime.hp=7;c.runtime.tempHp=2;c.runtime.resources.manual={name:'Authored spent resource',max:4,current:1,locked:true};
 c.inventory={view:'grid',order:[],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:7,pp:0},capacityAdjustment:''};
 return{c,owner,entry,spec,catalog,classOwner,otherClass,top};
}
