import {expect,it} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {syncAutoResources,setResource} from '../src/core/resources';
import {restResources} from '../src/core/automation/featureResources';
import {sourceResourceBindingKey} from '../src/core/automation/sourceResourcePools';
const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id,kind,name:id,english:id,source:'XPHB',edition:'2024',packId:'authored',revision:'fixture',entries:[],raw});
function setup(name='原创星火'){
 const c=newCharacter();c.automation=newAutomationState();
 c.selections=[{id:'class',entry:entry('原创导引者','class',{classTableGroups:[{colLabels:['原创星火','其他数值'],rows:Array.from({length:20},(_,i)=>[i+1,5])}]}),level:6,quantity:1,equipped:false},{id:'owner',parentId:'class',entry:entry('原创引火法','feature',{additionalSpells:[{resourceName:name,innate:{3:{resource:{2:['原创光焰|XPHB']}}}}]}),level:3,quantity:1,equipped:false}];
 return c;
}
const point=(c:ReturnType<typeof setup>)=>Object.entries(c.runtime.resources).find(([,value])=>value.name==='原创星火');
it('only the source-declared numeric class resource column becomes a point pool',()=>{
 const c=setup();syncAutoResources(c);expect(Object.values(c.runtime.resources).map(r=>r.name)).toEqual(['原创星火']);expect(point(c)![1]).toMatchObject({max:6,current:6,featureGrant:{ownerId:'class',classPool:{entryId:'原创导引者',label:'原创星火'}}});
});
it('level changes, retirement of the spell source and class disablement preserve spent points',()=>{
 const c=setup();syncAutoResources(c);const [key]=point(c)!;setResource(c,key,3);
 c.selections=c.selections.filter(row=>row.id!=='owner');c.selections[0].level=8;syncAutoResources(c);expect(c.runtime.resources[key]).toMatchObject({max:8,current:5});
 c.profile.disabledEntries=[c.selections[0].entry.id];syncAutoResources(c);expect(c.runtime.resources[key]).toBeUndefined();
 c.profile.disabledEntries=[];syncAutoResources(c);expect(c.runtime.resources[key]).toMatchObject({max:8,current:5});
});
it('a different resource name needs an explicit validated column intent rather than a translation guess',()=>{
 const c=setup('Authored Sparks');syncAutoResources(c);expect(point(c)).toBeUndefined();
 c.automation!.spellResourceColumns={[sourceResourceBindingKey(c,c.selections[1],0,'Authored Sparks')]:'原创星火'};syncAutoResources(c);expect(point(c)![1].max).toBe(6);
});
it.each(['missing','duplicate','symbolic','malformed'])('an unsupported or ambiguous table %s cannot initialize points',shape=>{
 const c=setup(),group=c.selections[0].entry.raw.classTableGroups[0];
 if(shape==='missing')group.colLabels=['其他'];if(shape==='duplicate')group.colLabels=['原创星火','原创星火'];if(shape==='symbolic')group.rows[5]=['无限'];if(shape==='malformed')group.rows[5]={0:6};
 syncAutoResources(c);expect(point(c)).toBeUndefined();
});
it('unselected spell schemes and incompatible class editions cannot declare an active point pool',()=>{
 const c=setup();c.selections[1].entry.raw.additionalSpells.push(structuredClone(c.selections[1].entry.raw.additionalSpells[0]));syncAutoResources(c);expect(point(c)).toBeUndefined();
 c.automation!.spellSets={owner:0};c.selections[0].entry.edition='2014';syncAutoResources(c);expect(point(c)).toBeUndefined();
});
it('an existing explicit class-owned pool wins over a duplicate table-derived pool',()=>{
 const c=setup();c.selections.push({id:'explicit',parentId:'class',entry:entry('原创点数声明','feature',{resources:[{name:'原创星火',max:9,recovery:'long'}]}),level:1,quantity:1,equipped:false});
 syncAutoResources(c);expect(Object.values(c.runtime.resources)).toHaveLength(1);expect(point(c)![1]).toMatchObject({max:9,featureGrant:{ownerId:'explicit'}});
});
it('undeclared rest recovery never replenishes a class table pool',()=>{
 const c=setup();syncAutoResources(c);const [key]=point(c)!;setResource(c,key,1);restResources(c,'short');restResources(c,'long');expect(c.runtime.resources[key].current).toBe(1);
});
