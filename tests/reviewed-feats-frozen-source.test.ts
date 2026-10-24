import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
const directory=process.env.REVIEWED_FEATS_FROZEN_DIR;
const hashes={'feats.json':'0491b421f5f1db6628c3a8aeb86bbc3b72b56bf101a14ba96acbe19c829a56a6','class/class-fighter.json':'a4c5afc0e7ec7a444d1418a04ab4fe392b9a7a25907ac0fb9b8618a79d1ee509'};
function setup(english:'Tough'|'Resilient'){
 const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8'));
 const entries=Object.entries(hashes).flatMap(([suffix,expected])=>{const row=index.rows.find((r:any)=>r.url.endsWith(`/data/${suffix}`));expect(row).toBeDefined();const body=readFileSync(`${directory}/${row.path}`,'utf8'),data=JSON.parse(body);expect(createHash('sha256').update(JSON.stringify(data)).digest('hex')).toBe(expected);return normalizeData(data,'reviewed-feats-frozen');});
 const c=newCharacter('2014');c.automation=newAutomationState();c.abilities.dex=13;c.runtime.hp=7;c.runtime.tempHp=3;
 c.selections=[{id:'fighter',entry:entries.find(e=>e.kind==='class'&&e.english==='Fighter'&&e.source==='PHB')!,level:4,quantity:1,equipped:false}];syncFeatures(c,entries);
 const choice=sheetChoices(c,entries).find(x=>x.id.includes(':class-legacy-feat:')&&x.grantLevel===4)!,feat=entries.find(e=>e.kind==='feat'&&e.english===english&&e.source==='PHB')!;
 expect(choice).toBeDefined();setSheetChoiceSlot(c,choice.id,0,feat.id,entries);expect(c.classChoiceSnapshots?.[feat.id]).toEqual(feat);expect(c.selections.some(row=>row.entry.kind==='feat')).toBe(false);
 const source=c.selections.find(row=>row.parentId==='fighter'&&row.entry.id===choice.id.split(':class-legacy-feat:')[1])!;
 return {c,entries,choice,feat,source};
}
it.skipIf(!directory)('actual PHB2014 Tough from the real Fighter ASI adds confirmed 2 × total level, not a record-only answer',()=>{
 const {c,choice,feat,source}=setup('Tough');expect(evaluate(c).maxHp).toBe(28);
 (c as any).reviewedFeats={version:1,bindings:[{selectionId:source.id,choiceId:choice.id,entryId:feat.id,intent:{kind:'tough',confirmedManualHpExcluded:true}}]};
 expect(evaluate(c).maxHp).toBe(36);expect(c.runtime).toMatchObject({hp:7,tempHp:3});
});
it.skipIf(!directory)('actual PHB2014 Resilient from the real Fighter ASI adds chosen DEX and its save',()=>{
 const {c,choice,feat,source}=setup('Resilient');expect(evaluate(c).abilities.dex).toBe(13);
 (c as any).reviewedFeats={version:1,bindings:[{selectionId:source.id,choiceId:choice.id,entryId:feat.id,intent:{kind:'resilient',ability:'dex',confirmedManualAbilityExcluded:true}}]};
 expect(evaluate(c).abilities.dex).toBe(14);expect(evaluate(c).saves.dex).toEqual({value:4,proficient:true});
});
