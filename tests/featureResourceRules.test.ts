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

it.each([['@class.level-1',1],['@details.level-6',1],['@level-1',1],['@prof-1',2],['@abilities.wis.mod-1',1]])('a supported variable permits subtraction without spaces: %s',(max,expected)=>{
 const c=card({max,recovery:'long'});c.abilities.wis=14;
 expect(planFeatureResources(c)).toMatchObject({grants:[{max:expected}],issues:[]});
});

it('a hyphenated named class can supply unspaced maximum and recovery formulas',()=>{
 const c=card({max:'@classes.reserve-extra.levels-1',recovery:[{period:'lr',type:'formula',formula:'@classes.reserve-extra.levels-3'}]});
 c.selections[1].entry.raw.identifier='reserve-extra';
 syncFeatureResources(c);const key=Object.keys(c.runtime.resources)[0];
 expect(c.runtime.resources[key]?.max).toBe(4);setResource(c,key,0);
 restResources(c,'long');expect(c.runtime.resources[key].current).toBe(2);
});

it.each(['@prof2','@class.levels','@abilities.wis.modifier','@classes.reserve.levels.extra'])('an unsupported variable cannot resolve a known prefix: %s',max=>{
 const report=planFeatureResources(card({max}));
 expect(report.grants).toEqual([]);expect(report.issues).toHaveLength(1);
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

it.each([
 '使用此特性后，你必须完成一次长休，才能再次使用。',
 '该特性在使用后必须完成一次短休或长休，才能再使用。',
 '创造原创护符后，你必须完成一次长休，才能再次创造新的护符。',
 '施展原创光环后，你必须完成一次长休，才能再次以这种方式施展。',
 '你必须完成一次长休，才能再次如此做。'
])('an explicit repeat-action restriction does not require repeating the feature name: %s',text=>{
 const c=card();c.selections[2].entry.raw={};c.selections[2].entry.entries=[text];
 expect(planFeatureResources(c)).toMatchObject({grants:[{max:1,recovery:{long:'all'}}],issues:[]});
});

it('tagged rest references keep both periods when the order is long then short',()=>{
 const c=card();c.selections[2].entry.raw={};c.selections[2].entry.entries=['你使用此特性后，必须在完成一次{@variantrule 长休|AUTHORED}或{@variantrule 短休|AUTHORED|短}后才能再次使用。'];
 expect(planFeatureResources(c)).toMatchObject({grants:[{max:1,recovery:{short:'all',long:'all'}}],issues:[]});
});

it('a quick reference uses its explicit rest label rather than the generic category',()=>{
 const c=card();c.selections[2].entry.raw={};c.selections[2].entry.entries=['使用此特性后，直到你完成一次{@quickref 休息|AUTHORED|2|0|长休}前，你都不能再次使用它。'];
 expect(planFeatureResources(c)).toMatchObject({grants:[{max:1,recovery:{long:'all'}}],issues:[]});
});

it.each([
 '你必须完成一次长休，才能再次对同一生物使用此特性。',
 '通过此特性恢复过生命值的生物，都必须完成一次长休才能再次使用此效果。',
 '通过此特性恢复过生命值的生物，都必须完成一次长休才能再次从中受益。',
 '使用此特性后，直到你完成{@dice 1d4}次长休后，你都不能再次使用此特性。',
 '使用此特性后，你必须完成两次短休，才能再次使用此特性。'
])('target-specific or multiple-rest cooldowns cannot become a global once-use pool: %s',text=>{
 const c=card();c.selections[2].entry.raw={};c.selections[2].entry.entries=[text];
 const report=planFeatureResources(c);expect(report.grants).toEqual([]);expect(report.issues).toHaveLength(1);
});

it('a restriction on resetting check difficulty still does not restrict reuse of the feature',()=>{
 const c=card();c.selections[2].entry.raw={};c.selections[2].entry.entries=['使用此特性后，检定难度增加 5；你必须完成一次长休，才能再次重置检定难度。'];
 expect(planFeatureResources(c).grants).toEqual([]);
});

it('distinct rest-limited actions cannot become one shared feature counter',()=>{
 const c=card();c.selections[2].entry.raw={};c.selections[2].entry.entries=[
  '你可以免费施展一个法术，并且你必须在完成一次长休后才能再次这么做。',
  '一旦你以此特性恢复过法术位，直到完成一次长休为止，你无法再次这么做。'
 ];
 const report=planFeatureResources(c);expect(report.grants).toEqual([]);expect(report.issues).toHaveLength(1);
});

it('identical cooldown wording for two declared spells does not establish shared uses',()=>{
 const c=card();c.selections[2].entry.raw={};c.selections[2].entry.entries=[
  '你可以通过此特性施展原创光幕。你必须完成一次长休才能再次通过此特性施放该法术。',
  '你可以通过此特性施展原创暗幕。你必须完成一次长休才能再次通过此特性施放该法术。'
 ];
 const report=planFeatureResources(c);expect(report.grants).toEqual([]);expect(report.issues).toHaveLength(1);
});

it('explicit separate resource declarations retain independent spending despite multiple prose cooldowns',()=>{
 const c=card();c.selections[2].entry.raw={resources:[{name:'原创光幕次数',max:3,recovery:'long'},{name:'原创暗幕次数',max:2,recovery:'long'}]};
 c.selections[2].entry.entries=['你必须完成一次长休才能再次施展原创光幕。你必须完成一次长休才能再次施展原创暗幕。'];
 syncFeatureResources(c);const keys=Object.keys(c.runtime.resources);expect(keys).toHaveLength(2);
 setResource(c,keys[0],1);syncFeatureResources(c);
 expect(keys.map(key=>c.runtime.resources[key].current)).toEqual([1,2]);expect(planFeatureResources(c).issues).toEqual([]);
});

it('an incidental second rest mention without a reuse restriction does not make a once-use rule ambiguous',()=>{
 const c=card();c.selections[2].entry.raw={};c.selections[2].entry.entries=['使用此特性后，你必须完成一次长休才能再次使用。你在短休时可以整理自己的装备。'];
 expect(planFeatureResources(c)).toMatchObject({grants:[{max:1,recovery:{long:'all'}}],issues:[]});
});

it('a source-bound uses column supplies the maximum and preserves spending while leveling',()=>{
 const c=card();c.selections[2].entry.raw={};c.selections[2].entry.entries=['用尽本特性的最大次数后，你必须完成一次长休，才能再次使用此特性。'];
 c.selections[0].entry.raw.classTableGroups=[{colLabels:['原创资源次数'],rows:Array.from({length:20},(_,i)=>[i<6?2:3])}];
 const plan=planFeatureResources(c);expect(plan).toMatchObject({grants:[{max:2}],issues:[]});
 syncFeatureResources(c);const key=plan.grants[0].key;setResource(c,key,0);c.selections[0].level=7;syncFeatureResources(c);
 expect(c.runtime.resources[key]).toMatchObject({max:3,current:1,featureGrant:{spent:2}});
});

it.each(['missing','symbolic','ambiguous','malformed'])('an unresolved source count table stays manual: %s',shape=>{
 const c=card();c.selections[2].entry.raw={};c.selections[2].entry.entries=['用尽本特性的最大次数后，你必须完成一次长休，才能再次使用此特性。'];
 if(shape==='symbolic')c.selections[0].entry.raw.classTableGroups=[{colLabels:['原创资源次数'],rows:[['2'],['无限']]}];
 if(shape==='ambiguous')c.selections[0].entry.raw.classTableGroups=[{colLabels:['原创资源','原创资源次数'],rows:[[2,3],[2,3]]}];
 if(shape==='malformed')c.selections[0].entry.raw.classTableGroups=[{colLabels:['原创资源次数'],rows:'22'}];
 const report=planFeatureResources(c);expect(report.grants).toEqual([]);expect(report.issues).toHaveLength(1);
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
