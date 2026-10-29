import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {validateInputs,validateMapping,readMapping} from './fetchReviewedAlertCorpus.mjs';

const {values}=parseArgs({options:{corpus:{type:'string'},policies:{type:'string'},'old-reader':{type:'string'}}});
if(!values.corpus||!values.policies||!values['old-reader'])throw Error('Explicit corpus, policies and immutable old-reader directories are required');
const corpus=resolve(values.corpus),policies=resolve(values.policies),old=resolve(values['old-reader']);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report=JSON.parse(readFileSync(new URL('../docs/data/automation-runtime-coverage.json',import.meta.url),'utf8'));
const pins=validateMapping(readMapping(),validateInputs(report.inputs));
const index=JSON.parse(readFileSync(join(corpus,'index.json'),'utf8'));
for(const pin of pins){
 const rows=index.rows.filter(row=>row.url===pin.url&&row.sha256===pin.sha256&&row.path===`files/${pin.sha256}.json`);
 if(rows.length!==1)throw Error('Integration corpus input is missing or ambiguous');
 const bytes=readFileSync(join(corpus,rows[0].path));
 if(sha(JSON.stringify(JSON.parse(bytes)))!==pin.sha256)throw Error('Integration corpus body mismatch');
}
if(index.rows.length!==229)throw Error('Integration corpus must retain all 229 inputs');
const sourceVariables=['ORDINARY_CASTING','LIMITED_SOURCE','ITEM_CHARGE','RACIAL_DARKVISION','ITEM_ABILITY_FLOOR','RACIAL_MOVEMENT','OPTIONAL_CLASS_LIST','CHARGED_ITEM_SPELL','NONUNIT_ITEM_CHARGE','ITEM_PASSIVE_BONUS','ITEM_CASTING_BONUS','ITEM_RESISTANCE_BONUS','RELATIVE_RACIAL_MOVEMENT','VARIANT_ITEM_RESISTANCE_BONUS','CLASS_MOVEMENT','RACIAL_RESISTANCE','INHERITED_RACIAL_RESISTANCE','RACIAL_CARRYING','RACIAL_NATURAL_ARMOR','SOURCE_LEVEL_HP','ITEM_AFFINE_HP'];
const environment=Object.fromEntries(sourceVariables.map(key=>[key+'_FROZEN_DIR',corpus]));
const policyPins=[
 ['CHARGED_ITEM_SPELL_POLICY_DMG_FILE','book-dmg.json',1312030,'2cd30ce20ef2786b1153a85bec25beee8747793491a8f38123a1a9fb6aee06ba'],
 ['CHARGED_ITEM_SPELL_POLICY_XDMG_FILE','book-xdmg.json',1452650,'0be2e1fc83321379fb949d699dcf7c2aec9011a3278c1fce93ae4424737fc5aa'],
];
mkdirSync(policies,{recursive:true});
for(const [key,file,size,hash] of policyPins){
 const path=join(policies,file);let bytes;
 if(existsSync(path))bytes=readFileSync(path);
 else{
  const response=await fetch(`https://raw.githubusercontent.com/tjliqy/5etools-cn/5cc0bbe2c2b241a334e731af4448bdba2168e8bd/data/book/${file}`,{redirect:'error',signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error('Immutable item-spell policy download failed');
  const parts=[];let length=0;for await(const part of response.body){length+=part.length;if(length>size)throw Error('Item-spell policy exceeds its exact byte bound');parts.push(part);}bytes=Buffer.concat(parts);
 }
 if(bytes.length!==size||sha(bytes)!==hash)throw Error('Immutable item-spell policy bytes mismatch');
 writeFileSync(path,bytes);environment[key]=path;
}
// The fixture reconstructs and authenticates all 619 source files and the
// committed package locks before executing this separate old reader.
if(!existsSync(join(old,'src/core/validation.ts')))throw Error('Complete immutable old reader is required');
environment.NONUNIT_ITEM_CHARGE_OLD_WEB_ROOT=old;
if(!process.env.GITHUB_ENV)throw Error('A GitHub environment file is required; no implicit process setup');
for(const [key,value] of Object.entries(environment)){if(/[\r\n]/.test(value))throw Error('Invalid source directory');appendFileSync(process.env.GITHUB_ENV,`${key}=${value}\n`);}
console.log(JSON.stringify({verified:true,inputs:229,sourceFamilies:19,policySources:2,privateBodiesPublished:false}));
