import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeData} from '../src/data/catalog';
import {infusionChargesFixture} from './helpers/infusionChargesFixture';
import {setInfusionTarget,setInfusionHeld} from '../src/core/automation/infusions';
import {infusionChargeOffer,infusionChargeActionRequest,performInfusionChargeAction} from '../src/core/automation/infusionCharges';
import evidence from '../src/core/automation/infusionEvidence.json';
const dir=process.env.INFUSION_FROZEN_DIR;
function frozen(name:string){
 const index=JSON.parse(readFileSync(`${dir}/index.json`,'utf8'));
 const data=(suffix:string)=>{const row=index.rows.find((row:any)=>row.url===`https://5e.kiwee.top/data/${suffix}`),value=JSON.parse(readFileSync(`${dir}/${row.path}`,'utf8'));expect(createHash('sha256').update(JSON.stringify(value)).digest('hex')).toBe(evidence.inputs[suffix as keyof typeof evidence.inputs]);return value;};
 const entries=normalizeData({...data('class/class-artificer.json'),...data('optionalfeatures.json'),...data('items-base.json'),...data('items.json')},'frozen-charge-identity');
 const f=infusionChargesFixture(name);f.c.selections[0].entry=entries.find(row=>row.kind==='class'&&row.english==='Artificer'&&row.source==='TCE')!;f.c.selections[1].entry=entries.find(row=>row.raw._category==='classFeature'&&row.english==='Infuse Item'&&row.source==='TCE')!;
 f.infusion=entries.find(row=>row.raw._category==='optionalfeature'&&row.english===name&&row.source==='TCE')!;f.c.answers[f.choiceId]=[f.infusion.id];f.c.classChoiceSnapshots={[f.infusion.id]:f.infusion};f.targetId=name==='Repulsion Shield'?'shield':'robes';const target=f.c.selections.find(row=>row.id===f.targetId)!;target.entry=entries.find(row=>row.kind==='item'&&row.english===(name==='Repulsion Shield'?'Shield':'Robes')&&row.source==='PHB')!;target.equipped=true;
 setInfusionTarget(f.c,f.choiceId,f.infusion.id,f.targetId);if(name==='Repulsion Shield')setInfusionHeld(f.c,f.choiceId,f.infusion.id,true);
 expect(performInfusionChargeAction(f.c,infusionChargeActionRequest(f.c,f.choiceId,f.infusion.id,'init',{kind:'initialize',initial:3})).status).toBe('applied');
 return f;
}
for(const name of ['Repulsion Shield','Mind Sharpener']){
 it.skipIf(!dir).each(['owner-English','owner-source','grant-English','grant-source','infusion-English','infusion-source','target-English','target-source'])(`${name} rejects exact-source normalized/raw identity drift: %s`,change=>{
  const f=frozen(name),entry=change.startsWith('owner')?f.c.selections[0].entry:change.startsWith('grant')?f.c.selections[1].entry:change.startsWith('infusion')?f.infusion:f.c.selections.find(row=>row.id===f.targetId)!.entry;
  entry.raw[change.endsWith('English')?'ENG_name':'source']=change.endsWith('English')?'Unrelated Rule':'XPHB';const before=JSON.stringify(f.c);
  const available=infusionChargeOffer(f.c,f.choiceId,f.infusion.id).canUse;
  const r=infusionChargeActionRequest(f.c,f.choiceId,f.infusion.id,'use',{kind:'use',triggerConfirmed:true,reactionConfirmed:true}),result=performInfusionChargeAction(f.c,r);expect(result.status).toBe('rejected');expect(available).toBe(false);expect(JSON.stringify(f.c)).toBe(before);
 });
 it.skipIf(!dir)(`${name} retains genuine frozen Chinese references and mutable display labels`,()=>{
  const f=frozen(name);f.c.selections[0].entry.name='My artificer';f.infusion.name='My infusion';f.c.selections.find(row=>row.id===f.targetId)!.entry.name='My equipment';expect(infusionChargeOffer(f.c,f.choiceId,f.infusion.id).canUse).toBe(true);expect(performInfusionChargeAction(f.c,infusionChargeActionRequest(f.c,f.choiceId,f.infusion.id,'use',{kind:'use',triggerConfirmed:true,reactionConfirmed:true})).status).toBe('applied');
 });
}
