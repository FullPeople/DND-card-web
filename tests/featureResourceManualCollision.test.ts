import {expect,it} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {planFeatureResources,restResources,syncFeatureResources} from '../src/core/automation/featureResources';
import {setResource} from '../src/core/resources';
import {exportCharacter} from '../src/core/export';
import {validateCharacter} from '../src/core/validation';

function fixture(archive=false){
 const c=newCharacter('2024');c.automation=newAutomationState();c.profile.enabledSources=['XPHB'];
 const entry:Entry={id:'authored-owner',kind:'class',name:'Authored owner',english:'Authored owner',source:'XPHB',edition:'2024',packId:'authored',revision:'1',entries:[],raw:{}};
 c.selections=[{id:'owner',entry,level:2,quantity:1,equipped:false},{id:'feature',parentId:'owner',entry:{...entry,id:'authored-feature',kind:'feature',name:'Authored resource',english:'Authored resource',raw:{resources:[{max:3,recovery:'long'}]}},level:1,quantity:1,equipped:false}];
 const key=planFeatureResources(c).grants[0].key;
 if(archive){syncFeatureResources(c);setResource(c,key,1);}
 c.runtime.resources[key]={name:'Authored manual record',max:9,current:2,automatic:false,locked:true};
 c.runtime.resources.unrelated={name:'Authored unrelated resource',max:7,current:1};c.notes='Authored manual note';
 return {c:validateCharacter(exportCharacter(c)),key};
}

it('holds a proposed grant occupying a valid imported resource without feature ownership',()=>{
 const {c,key}=fixture(),before=structuredClone(c),report=planFeatureResources(c);
 expect(report.grants.some(grant=>grant.key===key)).toBe(false);
 expect(report.issues).toContainEqual(expect.objectContaining({selectionId:'feature',severity:'warning'}));
 expect(c).toEqual(before);
});

it('does not change the manual resource, its balance or the rest of the imported card during reconciliation',()=>{
 const {c}=fixture(),before=structuredClone(c);
 expect(syncFeatureResources(c)).toBe(false);expect(c).toEqual(before);
 restResources(c,'long');expect(c).toEqual(before);
 const reopened=validateCharacter(exportCharacter(c));expect(syncFeatureResources(reopened)).toBe(false);expect(reopened).toEqual(before);
});

it('does not replace an active manual collision with a previously owned archived resource',()=>{
 const {c}=fixture(true),before=structuredClone(c);
 expect(syncFeatureResources(c)).toBe(false);expect(c).toEqual(before);
});

it('restores the original spent archive only after the conflicting active record is explicitly removed',()=>{
 const {c,key}=fixture(true),manual=structuredClone(c.runtime.resources[key]);
 syncFeatureResources(c);expect(c.runtime.resources[key]).toEqual(manual);
 delete c.runtime.resources[key];syncFeatureResources(c);
 expect(c.runtime.resources[key]).toMatchObject({max:3,current:1,featureGrant:{ownerId:'feature',spent:2}});
});

it('holds only the colliding grant while an independent declared resource still reconciles',()=>{
 const {c,key}=fixture(),manual=structuredClone(c.runtime.resources[key]);
 const second=structuredClone(c.selections[1]);second.id='independent-feature';second.entry.id='authored-independent-feature';second.entry.raw.resources=[{max:5,recovery:'short'}];c.selections.push(second);
 const report=planFeatureResources(c);expect(report.grants).toHaveLength(1);expect(report.grants[0].ownerId).toBe(second.id);
 syncFeatureResources(c);expect(c.runtime.resources[key]).toEqual(manual);
 expect(c.runtime.resources[report.grants[0].key]).toMatchObject({max:5,current:5,featureGrant:{ownerId:second.id}});
 expect(c.runtime.resources.unrelated).toEqual({name:'Authored unrelated resource',max:7,current:1});
});

it('keeps the collision suspended across source withdrawal, restoration and native reopening',()=>{
 const {c,key}=fixture(),manual=structuredClone(c.runtime.resources[key]);
 c.profile.enabledSources=[];syncFeatureResources(c);expect(c.runtime.resources[key]).toEqual(manual);
 const reopened=validateCharacter(exportCharacter(c));reopened.profile.enabledSources=['XPHB'];
 syncFeatureResources(reopened);expect(reopened.runtime.resources[key]).toEqual(manual);
 expect(planFeatureResources(reopened).grants).toEqual([]);
});
