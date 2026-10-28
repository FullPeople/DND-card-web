import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import {newCharacter,type Entry,type Selection,type Ability} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
export const itemAbilityFloorPin={url:'https://5e.kiwee.top/data/items.json',sha256:'883f7bb4df2eb35fb37e7caa3a8765e0209014caa360d1c0358daa6f4b2da488'};
export const itemAbilityFloorSpecs:{english:string;ability:Ability;floor:number}[]=[
 {english:'Amulet of Health',ability:'con',floor:19},{english:'Headband of Intellect',ability:'int',floor:19},{english:'Gauntlets of Ogre Power',ability:'str',floor:19},
 ...[['Hill',21],['Stone',23],['Frost',23],['Fire',25],['Cloud',27],['Storm',29]].map(([giant,floor])=>({english:`Belt of ${giant} Giant Strength`,ability:'str' as const,floor:Number(floor)})),
];
export const itemAbilityFloorDigest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const itemAbilityFloorSnapshot=(entry:Entry)=>{const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sorted(v[k])])):v;return itemAbilityFloorDigest(sorted(entry));};
let cached:Entry[]|undefined;
export function itemAbilityFloorEntries():Entry[]{
 if(cached)return cached;
 const directory=process.env.ITEM_ABILITY_FLOOR_FROZEN_DIR;if(!directory)throw Error('Mandatory ITEM_ABILITY_FLOOR_FROZEN_DIR required');
 const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8')),rows=index.rows.filter((r:any)=>r.url===itemAbilityFloorPin.url&&r.sha256===itemAbilityFloorPin.sha256);
 if(rows.length!==1)throw Error('Exact original item ability-floor pin required');
 const bytes=readFileSync(`${directory}/${rows[0].path}`),body=JSON.parse(bytes.toString('utf8'));
 if(bytes.length!==2458443||itemAbilityFloorDigest(body)!==itemAbilityFloorPin.sha256)throw Error('Original item source bytes/SHA mismatch');
 const selected=body.item.filter((raw:any)=>['DMG','XDMG'].includes(raw.source)&&itemAbilityFloorSpecs.some(spec=>spec.english===raw.ENG_name));
 if(selected.length!==18||selected.some((raw:any)=>raw._copy||raw._versions||raw.type||raw.property||raw.mastery||raw.entries.some((x:any)=>typeof x!=='string'||x.includes('{#itemEntry '))))throw Error('Native item cohort has unexpected dependencies');
 // Run the installed normalizer on the complete original input, not a tag-only
 // or name-rebuilt synthetic entry. These literal rows require no other input.
 const normalized=normalizeCatalogData(body,itemAbilityFloorPin.sha256,'kiwee');
 cached=normalized.filter(e=>e.kind==='item'&&e.raw._category==='item'&&['DMG','XDMG'].includes(e.source)&&itemAbilityFloorSpecs.some(spec=>spec.english===e.english));
 if(cached.length!==18||new Set(cached.map(e=>e.id)).size!==18)throw Error('Exact18 normalized native items required');
 return cached;
}
export function itemAbilityFloorFixture(english='Amulet of Health',source='DMG'){
 const entries=itemAbilityFloorEntries(),matches=entries.filter(e=>e.english===english&&e.source===source);if(matches.length!==1)throw Error('Unique original native item required');
 const entry=structuredClone(matches[0]),spec=itemAbilityFloorSpecs.find(s=>s.english===english)!,c=newCharacter(source==='XDMG'?'2024':'2014');c.automation=newAutomationState();c.profile.enabledSources.push(source);
 c.notes='Authored manual notes';c.runtime.hp=3;c.runtime.tempHp=2;c.runtime.resources.manual={name:'Authored spent resource',current:1,max:7,locked:true};
 const owner:Selection={id:'floor-owner',entry,quantity:1,level:1,equipped:true,attuned:true};c.selections.push(owner);return {c,owner,entry,entries,spec};
}
