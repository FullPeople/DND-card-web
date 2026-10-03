import {newCharacter,type Entry,type Selection} from '../../src/core/model';
import {sheetChoices} from '../../src/core/automation/choices';
import {newAutomationState} from '../../src/core/automation/state';
import {syncFeatures} from '../../src/core/sheet';
// Authored rule-family fixtures. Real publisher snapshots are tested separately,
// never committed. Names are deliberately unrelated to any published feature.
export const sentence='穿戴护甲时，你的AC获得 +1 加值。';
export function armorFeatureFixture(edition:'2014'|'2024',normalizeData:(data:Record<string,any>,revision:string)=>Entry[]){
 const source=edition==='2024'?'XPHB':'PHB',style={name:'测试护甲加值',ENG_name:'Authored Armored Bonus',source,category:'FS',featureType:['FS:F'],entries:[sentence]};
 const data={class:[{name:'测试职业',ENG_name:'Authored Class',source,hd:{faces:10},classFeatures:[`测试风格|测试职业|${source}|1|${source}`]}],classFeature:[{name:'测试风格',source,className:'测试职业',classSource:source,level:1,entries:edition==='2024'?['你获得一项你选择的{@filter 测试类别|feats|category=FS}。']:[{type:'options',count:1,entries:[{type:'refOptionalfeature',optionalfeature:`测试护甲加值|${source}`},{type:'refOptionalfeature',optionalfeature:`测试替代|${source}`}]}]}],feat:edition==='2024'?[style,{...style,name:'测试替代',ENG_name:'Authored Alternative',entries:['没有护甲加值。']}]:[],optionalfeature:edition==='2014'?[style,{...style,name:'测试替代',ENG_name:'Authored Alternative',entries:['没有护甲加值。']}]:[],item:[{name:'测试身甲',source,type:'HA',ac:16},{name:'测试盾',source,type:'S',ac:2}]};
 const entries=normalizeData(data,'authored-fixture'),c=newCharacter(edition);c.automation=newAutomationState();c.training={armor:'轻甲、中甲、重甲、盾牌'};
 const row=(entry:Entry,id:string,equipped=false):Selection=>({id,entry,quantity:1,level:1,equipped});
 c.selections=[row(entries.find(e=>e.kind==='class')!,'class'),row(entries.find(e=>e.name==='测试身甲')!,'armor',true),row(entries.find(e=>e.name==='测试盾')!,'shield')];syncFeatures(c,entries);
 const choice=sheetChoices(c,entries).find(r=>r.channel==='content')!;
 return {c,entries,choice,data};
}
