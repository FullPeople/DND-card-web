import {it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {syncFeatures} from '../src/core/sheet';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {setInfusionTarget} from '../src/core/automation/infusions';
import {infusionChargeOffer} from '../src/core/automation/infusionCharges';
import {infusionChargeData} from './fixtures/infusionChargeData';
it.each(['Repulsion Shield','Mind Sharpener'])('player fixture generates the canonical class grant before learning %s rather than seeding a parent',english=>{
 const entries=normalizeData(infusionChargeData,'fixture'),c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['TCE','PHB'];
 c.selections=[{id:'artificer',entry:entries.find(row=>row.kind==='class')!,level:1,quantity:1,equipped:false},{id:'target',entry:entries.find(row=>row.english===(english==='Mind Sharpener'?'Robes':'Shield'))!,level:1,quantity:1,equipped:false}];syncFeatures(c,entries);expect(c.selections).toHaveLength(2);
 c.selections[0].level=english==='Mind Sharpener'?2:6;syncFeatures(c,entries);const source=c.selections.find(row=>row.parentId==='artificer'&&row.grantKey==='ref:物品注法|奇械师|TCE|2')!;
 expect(source).toBeDefined();expect(source.entry).toMatchObject({id:'kiwee:feature:tce:infuse%20item:tce:%E5%A5%87%E6%A2%B0%E5%B8%88:::2:',english:'Infuse Item',edition:'both',packId:'kiwee'});
 const choice=sheetChoices(c,entries).find(row=>row.id==='artificer:class-optional:0')!;expect(choice.label).toBe('已知注法');const option=choice.options.find(row=>row.entry.english===english)!;expect(option.unavailable).toBeUndefined();setSheetChoiceSlot(c,choice.id,0,option.value,entries);setInfusionTarget(c,choice.id,option.value,'target');expect(infusionChargeOffer(c,choice.id,option.value)).toMatchObject({supported:true,canInitialize:true});expect(c.runtime.infusionCharges).toBeUndefined();
});
