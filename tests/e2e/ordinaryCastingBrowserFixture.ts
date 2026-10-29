import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
const evidence:{inputs:{url:string;sha256:string}[]}=JSON.parse(readFileSync(new URL('../../src/core/automation/ordinarySpellCastingEvidence.json',import.meta.url),'utf8'));

// Node-discovery safe: no sheet/choices/loader runtime imports. The real browser
// uses Vite's actual normalizer and shared loader helper, never copied hydration.
export const ordinaryBrowserPaths=['class/class-wizard.json','class/class-sorcerer.json','class/class-warlock.json','spells/spells-phb.json','spells/spells-xphb.json','generated/gendata-spell-source-lookup.json'] as const;
export const ordinaryBrowserInputs=ordinaryBrowserPaths.map(path=>{const rows=evidence.inputs.filter(row=>row.url===`https://5e.kiwee.top/data/${path}`);if(rows.length!==1)throw Error('Exact ordinary source metadata required');return rows[0];});
export const ordinaryBrowserInputSetSha256=createHash('sha256').update(JSON.stringify([...ordinaryBrowserInputs].sort((a,b)=>a.url.localeCompare(b.url)))).digest('hex');
export function readOrdinaryBrowserInputs(directory=process.env.ORDINARY_CASTING_FROZEN_DIR||process.env.REVIEWED_FEATS_FROZEN_DIR){
 if(!directory)throw Error('Ordinary App acceptance requires exact frozen originals; no fallback.');
 const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8')),bodies:Record<string,any>={};
 for(const path of ordinaryBrowserPaths){const expected=ordinaryBrowserInputs.find(row=>row.url===`https://5e.kiwee.top/data/${path}`)!,rows=index.rows.filter((row:any)=>row.url===expected.url&&row.sha256===expected.sha256);if(rows.length!==1)throw Error('Ordinary frozen input metadata mismatch');const body=JSON.parse(readFileSync(`${directory}/${rows[0].path}`,'utf8'));if(createHash('sha256').update(JSON.stringify(body)).digest('hex')!==expected.sha256)throw Error('Ordinary frozen input body mismatch');bodies[path]=body;}
 return bodies;
}
export const ordinaryClassIds={Wizard:'kiwee:class:phb:wizard::::::',Sorcerer:'kiwee:class:phb:sorcerer::::::',Warlock:'kiwee:class:phb:warlock::::::'} as const;
export const ordinarySpellIds={missile:'kiwee:spell:phb:magic%20missile::::::',bolt:'kiwee:spell:phb:fire%20bolt::::::',agathys:'kiwee:spell:phb:armor%20of%20agathys::::::'} as const;
export type OrdinaryBrowserCaster=keyof typeof ordinaryClassIds;
export function ordinaryClassOnlyCharacter(classes:{caster:OrdinaryBrowserCaster;entry:Entry}[]){
 const c=newCharacter('2014');c.name='普通施法交互验收';c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.profile.optional.multiclass=classes.length>1;c.abilities.int=c.abilities.cha=16;c.baseHp=20;c.runtime.hp=7;c.runtime.tempHp=3;c.notes='Authored manual sentinel: spell effects remain manual.';
 c.runtime.resources['ordinary-manual']={name:'手工保留资源',max:7,current:2,locked:true};c.runtime.resources['spell-slot:9']={name:'手工九环记录',max:3,current:1};
 c.selections=classes.map(({caster,entry})=>({id:`ordinary-${caster.toLowerCase()}`,entry,level:3,quantity:1,equipped:false}));return c;
}
