import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import {ordinarySpellFixture} from './ordinarySpellCastingFixture';
import {applyInventory,previewInventory,type InventoryState} from '../../src/core/inventory';
import {itemCastingBonusSnapshot} from '../../src/core/automation/itemCastingBonuses';
import evidence from '../../src/core/automation/arcaneGrimoireEvidence.json' with {type:'json'};
const pins=[['items-base.json','8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff'],['items.json','883f7bb4df2eb35fb37e7caa3a8765e0209014caa360d1c0358daa6f4b2da488'],['magicvariants.json','4a4b0f3c8b268d8b134386f16e705df9b14d60419b2f2fa160da45b78bd4967d']] as const;
let cache:ReturnType<typeof load>|undefined;
function load(){
 const root=process.env.ORDINARY_CASTING_FROZEN_DIR;if(!root)throw Error('EXACT_FROZEN_INPUT_REQUIRED');
 const bodies=pins.map(([,pin])=>{const bytes=readFileSync(root+'/files/'+pin+'.json');if(createHash('sha256').update(bytes).digest('hex')!==pin)throw Error('PIN_CHANGED');return JSON.parse(bytes.toString());});
 for(const r of evidence.rules){const n=bodies[1].item[r.sourceIndex];if(n.ENG_name!==r.english||n.source!=='TCE'||Number(n.bonusSpellAttack)!==r.rank||Number(n.bonusSpellSaveDc)!==r.rank)throw Error('SOURCE_HEADER');for(const clause of r.clauses){let v:any=bodies[1];for(const key of clause.path.split('/'))v=v[key];if(typeof v!=='string'||createHash('sha256').update(v).digest('hex')!==clause.sha256)throw Error('SOURCE_CLAUSE');}}
 const canonical=normalizeCatalogData(structuredClone(bodies[1]),pins[1][1],'kiwee'),app=new Map(canonical.map(e=>[e.id,e])),merged=Object.assign({},...bodies),revision=pins.map(([path,pin])=>`data/${path}:${pin}`).sort().join('|');
 for(const op of ['normalize','magicItems']as const)for(const e of normalizeCatalogData(structuredClone(merged),revision,'kiwee',op))app.set(e.id,e);
 return {canonical,app};
}
export function arcaneGrimoireFixture(rank=1,form:'canonical'|'app'='canonical'){
 const entries=cache??=load(),rule=evidence.rules.find(r=>r.rank===rank)!;if(!rule)throw Error('EXACT_RULE_REQUIRED');
 const entry=structuredClone(form==='canonical'?entries.canonical.find(e=>e.id===rule.id):entries.app.get(rule.id));if(!entry||!rule.forms.some(f=>f.revision===entry.revision&&f.snapshotSha256===itemCastingBonusSnapshot(entry)))throw Error('COMPLETE_FORM_MISMATCH');
 const f=ordinarySpellFixture({caster:'Wizard',level:5,spell:'Magic Missile'});f.c.profile.enabledSources.push('TCE');f.c.spellSettings!.attackBonus=7;f.c.spellSettings!.dcBonus=11;
 let inv:InventoryState={revision:1,publicId:'',silent:false,containers:{card:{id:'card',name:'Card',kind:'card',revision:1,columns:5,capacity:25,write:true,items:[]}}};
 inv=previewInventory(inv,{action:'add',container:'card',row:{id:'physical-book',kind:'item',name:entry.name,entry,quantity:1,slot:0,revision:1}});inv=previewInventory(inv,{action:'update',container:'card',id:'physical-book',patch:{attuned:true}});applyInventory(f.c,inv.containers.card);
 return {...f,book:f.c.selections.find(s=>s.id==='physical-book')!,rule};
}
