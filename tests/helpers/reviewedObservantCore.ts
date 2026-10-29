import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeData} from '../../src/data/catalog';
import {newCharacter,type Character} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {syncFeatures} from '../../src/core/sheet';
import {sheetChoices,setSheetChoiceSlot} from '../../src/core/automation/choices';
import {setReviewedObservantIntent,type ReviewedObservantIntent} from '../../src/core/automation/reviewedObservant';
import evidence from '../../src/core/automation/reviewedObservantEvidence.json';
export const observantDirectory=process.env.REVIEWED_FEATS_FROZEN_DIR;
const bodies=new Map<string,any>();
export function observantFrozenInput(path:string,hash:string){if(bodies.has(path))return bodies.get(path);const index=JSON.parse(readFileSync(`${observantDirectory}/index.json`,'utf8')),rows=index.rows.filter((r:any)=>r.url.endsWith('/data/'+path));if(rows.length!==1)throw Error('Unique exact frozen input required: '+path);const body=JSON.parse(readFileSync(`${observantDirectory}/${rows[0].path}`,'utf8'));if(rows[0].sha256!==hash||createHash('sha256').update(JSON.stringify(body)).digest('hex')!==hash)throw Error('Frozen input hash mismatch: '+path);bodies.set(path,body);return body;}
export const observantIntent=(ability:'int'|'wis'='int'):ReviewedObservantIntent=>({kind:'observant',ability,confirmedManualAbilityExcluded:true,confirmedManualPassivesExcluded:true});
export function setupObservant(level=4){
 const entries=[...normalizeData(structuredClone(observantFrozenInput('feats.json',evidence.inputs['feats.json'])),'observant-core-real'),...normalizeData(structuredClone(observantFrozenInput('class/class-wizard.json',evidence.legacyClassInputs['class/class-wizard.json'])),'observant-core-real')],c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB','TCE'];c.abilities={str:10,dex:10,con:10,int:19,wis:10,cha:10};c.baseHp=31;c.training={tools:'手工工具',languages:'手工语言'};c.proficiencies={athletics:true};c.expertise={athletics:true};c.skillBonuses={athletics:1};c.sheetBonuses={ac:1,hp:2,speed:5};c.runtime.hp=7;c.runtime.tempHp=3;c.runtime.resources.manual={max:7,current:2,name:'已消耗资源'};c.quickbarActions=[{id:'manual',name:'手工攻击',attack:'+12',damage:'3d6'}];c.selections=[{id:'observant-owner',entry:entries.find(row=>row.kind==='class'&&row.english==='Wizard'&&row.source==='PHB')!,level,quantity:1,equipped:false}];syncFeatures(c,entries);
 const choices=()=>sheetChoices(c,entries).filter(row=>row.id.includes(':class-legacy-feat:')).sort((a,b)=>a.grantLevel!-b.grantLevel!),feat=entries.find(row=>row.id===evidence.feat.entryId)!,choice=choices()[0];const select=(slot=0)=>{const selected=choices()[slot];setSheetChoiceSlot(c,selected.id,0,feat.id,entries);return selected;};const confirm=(intent=observantIntent(),slot=0)=>{const selected=select(slot);setReviewedObservantIntent(c,selected.id,feat.id,intent,entries);return selected;};return {c,entries,feat,choice,choices,select,confirm};
}
export const observantSnapshot=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const observantManualSnapshot=(c:Character)=>observantSnapshot({...c,reviewedObservant:undefined});
