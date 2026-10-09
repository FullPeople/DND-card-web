import {expect,it} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {planFeatureResources,restResources,syncFeatureResources} from '../src/core/automation/featureResources';
import {setResource} from '../src/core/resources';
import {exportCharacter} from '../src/core/export';
import {validateCharacter} from '../src/core/validation';

function card(spec:Record<string,unknown>={max:3,recovery:'long'}){
 const c=newCharacter();c.automation=newAutomationState();
 const entry:Entry={id:'authored-owner',kind:'class',name:'原创守望者',english:'Authored Watcher',source:'XPHB',edition:'2024',packId:'authored',revision:'1',entries:[],raw:{}};
 c.selections=[{id:'owner',entry,level:2,quantity:1,equipped:false},{id:'reserve-owner',entry:{...entry,id:'authored-reserve',name:'原创储备职业',english:'Authored Reserve',raw:{identifier:'reserve'}},level:5,quantity:1,equipped:false},{id:'feature',parentId:'owner',entry:{...entry,id:'authored-resource',kind:'feature',name:'原创资源',english:'Authored Resource',raw:{resources:[spec]}},level:1,quantity:1,equipped:false}];
 return c;
}

it('a named class formula reads the declared class rather than the feature owner',()=>{
 const c=card({max:'@classes.reserve.levels + @class.level',recovery:'long'});
 expect(planFeatureResources(c)).toMatchObject({grants:[{max:7}],issues:[]});
});

it.each(['missing','reserve-extra'])('an unresolved class reference %s remains manual',identifier=>{
 const c=card({max:`@classes.${identifier}.levels`,recovery:'long'});
 const before=JSON.stringify(c),report=planFeatureResources(c);
 expect(report.grants).toEqual([]);expect(report.issues).toHaveLength(1);expect(report.issues[0].message).toContain('未执行');expect(JSON.stringify(c)).toBe(before);
});

it('duplicate class identifiers and disabled referenced classes cannot supply a level',()=>{
 const c=card({max:'@classes.reserve.levels'});
 c.selections.push({...structuredClone(c.selections[1]),id:'duplicate'});
 expect(planFeatureResources(c).grants).toEqual([]);
 c.selections.pop();c.profile.disabledEntries=[c.selections[1].entry.id];
 expect(planFeatureResources(c).grants).toEqual([]);
});

it('total level and proficiency formulas exclude disabled class sources',()=>{
 const c=card({max:'@details.level + @prof'});c.selections[1].entry.source='MISSING';
 expect(planFeatureResources(c)).toMatchObject({grants:[{max:4}],issues:[]});
});

it('a class-level placeholder without a class owner cannot use an arbitrary selection level',()=>{
 const c=card({max:'@class.level'});c.selections[2].parentId=undefined;c.selections[2].level=8;
 expect(planFeatureResources(c).grants).toEqual([]);
});

it('zero structured uses are retained without falling back to prose',()=>{
 const c=card();c.selections[2].entry.raw={system:{uses:{max:0,recovery:'long'}}};
 c.selections[2].entry.entries=['可以使用此特性三次。完成一次长休后恢复所有使用次数。'];
 expect(planFeatureResources(c)).toMatchObject({grants:[{max:0,recovery:{long:'all'}}],issues:[]});
});

it.each(['unknown','recoverHalf','roll'])('unsupported recovery type %s cannot be treated as a numeric restoration',type=>{
 const c=card({max:3,recovery:[{period:'sr',type,formula:'1'}]});
 const report=planFeatureResources(c);expect(report.grants).toEqual([]);expect(report.issues).toHaveLength(1);
});

it('supported structured recovery keeps short and long periods separate',()=>{
 const c=card({max:7,recovery:[{period:'sr',type:'formula',formula:'@class.level'},{period:'lr',type:'recoverAll'}]});
 syncFeatureResources(c);const key=Object.keys(c.runtime.resources)[0];setResource(c,key,0);
 restResources(c,'short');expect(c.runtime.resources[key].current).toBe(2);
 restResources(c,'long');expect(c.runtime.resources[key].current).toBe(7);
});

it('multiple recovery rules for the same period remain manual instead of overwriting',()=>{
 const c=card({max:3,recovery:[{period:'lr',type:'recoverAll'},{period:'lr',type:'formula',formula:'1'}]});
 expect(planFeatureResources(c).grants).toEqual([]);
});

it.each(['一旦使用此特性后，直到你完成一次长休为止，你都不能再次使用此特性。','你必须完成一次长休，才能再次使用此特性。'])('long-rest-only prose never grants short-rest recovery: %s',text=>{
 const c=card();c.selections[2].entry.raw={};c.selections[2].entry.entries=[text];
 const report=planFeatureResources(c);expect(report).toMatchObject({grants:[{max:1,recovery:{long:'all'}}],issues:[]});
 syncFeatureResources(c);const key=report.grants[0].key;setResource(c,key,0);
 restResources(c,'short');expect(c.runtime.resources[key].current).toBe(0);
 restResources(c,'long');expect(c.runtime.resources[key].current).toBe(1);
});

it.each(['短休或长休','长休或短休','短暂或长休'])('once-use prose preserves both supported recovery periods: %s',periods=>{
 const c=card();c.selections[2].entry.raw={};c.selections[2].entry.entries=[`使用此特性后，你必须完成一次${periods}，才能再次使用此特性。`];
 expect(planFeatureResources(c)).toMatchObject({grants:[{max:1,recovery:{short:'all',long:'all'}}],issues:[]});
});

it.each(['。','，'])('a repeated-check difficulty that resets after rest is not a once-use resource: %s',separator=>{
 const c=card();c.selections[2].entry.raw={};
 c.selections[2].entry.entries=[`使用此特性后，下一次检定难度增加 5${separator}完成短休或长休后，难度重置为 10。`];
 expect(planFeatureResources(c).grants).toEqual([]);
});

it('a resolved dynamic class formula preserves spending through level changes, import and source toggles',()=>{
 const c=card({max:'@classes.reserve.levels',recovery:'long'});syncFeatureResources(c);
 const key=Object.keys(c.runtime.resources)[0];setResource(c,key,2);
 const restored=validateCharacter(exportCharacter(c));restored.selections[1].level=7;syncFeatureResources(restored);
 expect(restored.runtime.resources[key]).toMatchObject({max:7,current:4,featureGrant:{spent:3}});
 restored.profile.disabledEntries=[restored.selections[1].entry.id];syncFeatureResources(restored);expect(restored.runtime.resources[key]).toBeUndefined();
 restored.profile.disabledEntries=[];syncFeatureResources(restored);
 expect(restored.runtime.resources[key]).toMatchObject({max:7,current:4});
 for(let i=0;i<10;i++)syncFeatureResources(restored);expect(restored.runtime.resources[key].current).toBe(4);
});
