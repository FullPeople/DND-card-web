import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {radiantRefuelingFixture} from './fixtures/radiantRefuelingFixture';
import {normalizeData} from '../src/data/catalog';
import {setInfusionTarget,setInfusionHeld} from '../src/core/automation/infusions';
import {refuelingRingOffer,refuelingRingActionRequest,performRefuelingRingAction} from '../src/core/automation/refuelingRing';
import {infusionChargeOffer,infusionChargeActionRequest,performInfusionChargeAction} from '../src/core/automation/infusionCharges';
import evidence from '../src/core/automation/infusionEvidence.json';
const directory=process.env.INFUSION_FROZEN_DIR;
function fixture(name:string,full=false){
 const f=radiantRefuelingFixture(name);f.c=structuredClone(f.c);
 if(full){const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8'));const read=(file:string)=>{const row=index.rows.find((row:any)=>row.url===`https://5e.kiwee.top/data/${file}`),data=JSON.parse(readFileSync(`${directory}/${row.path}`,'utf8'));expect(createHash('sha256').update(JSON.stringify(data)).digest('hex')).toBe(evidence.inputs[file as keyof typeof evidence.inputs]);return data;};
  const entries=normalizeData({...read('class/class-artificer.json'),...read('optionalfeatures.json'),...read('items.json'),...read('items-base.json')},'frozen-radiant-refueling');
  for(const row of f.c.selections)row.entry=structuredClone(entries.find(e=>e.kind===row.entry.kind&&e.english===row.entry.english&&e.source===row.entry.source&&(e.raw.classSource===undefined||e.raw.classSource==='TCE'))!);
  f.entry=entries.find(e=>e.raw._category==='optionalfeature'&&e.english===name&&e.source==='TCE')!;f.c.classChoiceSnapshots={[f.entry.id]:f.entry};f.c.answers[f.choiceId]=[f.entry.id];
 }
 f.c.spellSettings={mode:'prepared',ability:'int',capacity:3,attackBonus:0,dcBonus:0,prepared:[],slots:{'1':{max:4,used:2}}};f.c.runtime.resources['spell-slot:1']={automatic:true,max:4,current:2};
 const ring=name==='Spell-Refueling Ring',targetId=ring?'ring-a':'sword-a';setInfusionTarget(f.c,f.choiceId,f.entry.id,targetId);if(!ring)setInfusionHeld(f.c,f.choiceId,f.entry.id,true);
 const offered=()=>ring?refuelingRingOffer(f.c,f.choiceId,f.entry.id):infusionChargeOffer(f.c,f.choiceId,f.entry.id);
 const init=ring?performRefuelingRingAction(f.c,refuelingRingActionRequest(f.c,f.choiceId,f.entry.id,'init',{kind:'initialize',initial:1})):performInfusionChargeAction(f.c,infusionChargeActionRequest(f.c,f.choiceId,f.entry.id,'init',{kind:'initialize',initial:1}));expect(init.status).toBe('applied');
 const use=()=>ring?performRefuelingRingAction(f.c,refuelingRingActionRequest(f.c,f.choiceId,f.entry.id,'use',{kind:'use',slotKey:'spell-slot:1',actionConfirmed:true})):performInfusionChargeAction(f.c,infusionChargeActionRequest(f.c,f.choiceId,f.entry.id,'use',{kind:'use',triggerConfirmed:true,reactionConfirmed:true}));
 return {...f,offered,use,targetId};
}
for(const name of ['Radiant Weapon','Spell-Refueling Ring']){
 it.each(['owner-English','owner-source','grant-English','grant-source','infusion-English','infusion-source','target-English','target-source'])(`${name} fails closed on normalized/raw identity drift: %s`,change=>{
  const f=fixture(name);const entry=change.startsWith('owner')?f.c.selections.find(r=>r.id==='artificer')!.entry:change.startsWith('grant')?f.c.selections.find(r=>r.entry.english==='Infuse Item')!.entry:change.startsWith('infusion')?f.c.classChoiceSnapshots![f.entry.id]:f.c.selections.find(r=>r.id===f.targetId)!.entry;
  entry.raw[change.endsWith('English')?'ENG_name':'source']=change.endsWith('English')?'Unreviewed Impostor':'CUSTOM';const before=structuredClone(f.c);expect(f.offered().canUse).toBe(false);expect(f.use().status).toBe('rejected');expect(f.c).toEqual(before);
 });
 it.skipIf(!directory)(`${name} actual frozen inputs produce authorized binding and actions without publishing source prose`,()=>{
  const f=fixture(name,true);expect(f.offered().canUse).toBe(true);for(const row of f.c.selections.filter(row=>row.entry.kind==='class'||row.entry.kind==='item'))row.entry.name='Player chosen display label';f.c.classChoiceSnapshots![f.entry.id].name='Custom infusion label';expect(f.offered().canUse).toBe(true);expect(f.use().status).toBe('applied');
 });
}
