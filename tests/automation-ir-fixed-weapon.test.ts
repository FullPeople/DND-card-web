import {it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {initializeAutomation} from '../src/core/automation/state';
import {automaticWeaponAttacks} from '../src/core/automation/weapons';
import {evaluate} from '../src/core/engine';
import {createIdentity} from '../src/data/automation/identity';
import {weaponAttacks} from '../src/core/weaponAttacks';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {snapshotRecordErrors} from '../src/data/automation/record-validation';

// XPHB p27: a fixed weapon damage amount is not a damage roll. The current
// equipment model cannot express which roll-only riders can affect that amount.
it('defers 2024 fixed weapon damage without adding an ability or roll-only rider, preserving explicit manual actions',()=>{
 const c=newCharacter();initializeAutomation(c);c.abilities.dex=20;
 const item:Entry={id:'fixed-source',kind:'item',name:'固定伤害原型',english:'Source fixed weapon',packId:'kiwee',source:'XPHB',edition:'2024',revision:'1',raw:{},entries:[],automationVersion:'source-regression',automation:{identity:createIdentity({kind:'baseitem',source:'XPHB',engName:'Source fixed weapon'}),edition:'2024',verdict:'unsupported',provenance:[{layer:'overlay',ref:'XPHB p27 Damage Rolls',reviewer:'model:Codex-main',reviewedAt:'2026-10-03'}],evidence:{page:27},mechanics:{equipmentModel:{category:'weapon',weaponType:'ranged',weaponCategory:'martial',damage:'1',damageType:'piercing',properties:['A','LD'],attackBonus:2,damageBonus:2}},unsupported:[{family:'weaponExecution',code:'fixed-amount-not-damage-roll',ref:'XPHB p27',deferred:true}]}};
 expect(snapshotRecordErrors(item.automation!,[item.automation!])).toEqual([]);
 c.selections=[{id:'fixed',entry:item,quantity:1,level:1,equipped:true}];c.runtime.resources.ammunition={max:10,current:3};
 c.quickbarActions=[{id:'manual-fixed',name:'手动固定伤害',attack:'+9',damage:'1'}];
 const report=()=>automaticWeaponAttacks(c,evaluate(c));
 for(const score of [20,8]){c.abilities.dex=score;const before=structuredClone(c);expect(report().attacks).toEqual([]);expect(report().issues.some(i=>i.id==='weapon-fixed-damage:fixed'&&i.message.includes('固定伤害'))).toBe(true);expect(c).toEqual(before);}
 expect(weaponAttacks(c).map(a=>[a.key,a.damage])).toEqual([['custom:manual-fixed','1']]);
 const restored=readCharacter(exportCharacter(c)).character;expect(weaponAttacks(restored).map(a=>[a.key,a.damage])).toEqual([['custom:manual-fixed','1']]);expect(restored.runtime.resources.ammunition.current).toBe(3);
 c.selections[0].equipped=false;expect(report().issues).toEqual([]);c.selections[0].equipped=true;c.profile.enabledSources=[];expect(report().issues).toEqual([]);
});

it('retains rolled 2024 damage and the distinct 2014 weapon damage rule without inspecting names or raw fields',()=>{
 const c=newCharacter();initializeAutomation(c);c.abilities.dex=14;
 for(const [source,edition,damage] of [['XPHB','2024','1d4'],['PHB','2014','1']] as const){const entry:Entry={id:source,kind:'item',name:'相同显示名',english:'Same display',revision:'1',packId:'kiwee',source,edition,raw:{dmg1:'999'},entries:[],automationVersion:'source-regression',automation:{identity:createIdentity({kind:'baseitem',source,engName:'Same display'}),edition,verdict:'automated',provenance:[{layer:'overlay',ref:source==='PHB'?'PHB p196':'XPHB p27',reviewer:'model:Codex-main',reviewedAt:'2026-10-03'}],evidence:{page:source==='PHB'?196:27},mechanics:{equipmentModel:{category:'weapon',weaponType:'ranged',damage,damageType:'piercing',attackBonus:1,damageBonus:1}},unsupported:[]}};c.selections.push({id:source,entry,quantity:1,level:1,equipped:true});}
 c.profile.enabledSources=['XPHB','PHB'];expect(automaticWeaponAttacks(c,evaluate(c)).attacks.map(a=>a.damage)).toEqual(['1d4+3','1+3']);
});
