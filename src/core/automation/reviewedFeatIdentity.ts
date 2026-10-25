import type {Entry} from '../model';
import evidence from './reviewedFeatEvidence.json' with {type:'json'};
import modernEvidence from './modernArmorTrainingEvidence.json' with {type:'json'};

/** Deny-family recognition is not permission to execute. An edited kind, source
 * or edition must not let this known identity fall back to generic raw grants. */
export function reviewedArmorFeatIdentity(entry:Entry):boolean{
 return evidence.rules.some(rule=>'armorTraining' in rule&&(entry.english===rule.english||entry.raw.ENG_name===rule.english));
}

/** Narrow compatibility exception, not authorization for PHB intents or ability
 * increases. Source/edition alone cannot turn an edited PHB row into this shape. */
export function retainedModernArmorRule(entry:Entry){
 const raw=entry.raw,rule=modernEvidence.rules.find(row=>row.english===entry.english),same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
 if(!rule||entry.kind!=='feat'||entry.edition!=='2024'||entry.source!=='XPHB'||raw.source!=='XPHB'||raw.ENG_name!==entry.english||raw._category!=='feat'||raw.category!=='G'||entry.page!==rule.page||raw.page!==rule.page||entry.effects?.length||entry.choices?.length)return;
 if(Object.keys(raw).some(key=>!['ENG_name','name','source','page','category','prerequisite','ability','armorProficiencies','entries','translator','_category'].includes(key)))return;
 if(!same(raw.ability,[{choose:{from:rule.abilities}}])||!same(raw.armorProficiencies,[Object.fromEntries(rule.armorTraining.map(category=>[category,true]))])||!same(raw.prerequisite,[{level:4,...(rule.requiredArmor?{proficiency:[{armor:rule.requiredArmor}]}:{})}]))return;
 if(!entry.entries.length||!Array.isArray(raw.entries)||raw.entries.length!==2||typeof raw.entries[0]!=='string'||!raw.entries[0].trim())return;
 const block=raw.entries[1];
 if(!block||typeof block!=='object'||Array.isArray(block)||Object.keys(block).some(key=>!['ENG_name','name','type','entries'].includes(key))||block.ENG_name!=='Armor Training'||typeof block.name!=='string'||!block.name.trim()||block.type!=='entries'||!Array.isArray(block.entries)||block.entries.length!==1||typeof block.entries[0]!=='string'||!block.entries[0].trim())return;
 return rule;
}
