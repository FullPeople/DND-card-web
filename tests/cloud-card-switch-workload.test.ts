import {expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {sheetChoices} from '../src/core/automation/choices';
import {newAutomationState} from '../src/core/automation/state';
import {acknowledgedView} from '../src/platform/choiceReview';
import {cardMigrationIssues} from '../src/core/cardMigrationIssues';
import {snapshotMemo} from '../src/platform/snapshotMemo';

it('compares warm A-B-A work with the real sheet computations, without changing either card',()=>{
 const entries:Entry[]=Array.from({length:200},(_,i)=>({id:'switch-fixture:'+i,kind:'feature',name:'Authored feature '+i,english:'Authored feature '+i,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:['Authored content for switch workload.'],raw:{}}));
 const cards=Array.from({length:2},()=>{const c=newCharacter();c.automation=newAutomationState();c.selections=entries.map(entry=>({id:entry.id,entry,level:1,quantity:1,equipped:false}));return c;}),original=JSON.stringify(cards);
 const run=(enabled:boolean)=>{const memo=snapshotMemo(enabled);let builds=0,choices=0,reviews=0,derivations=0;
  const read=(card:Character)=>{const build=memo('build',card,()=>{builds++;return acknowledgedView(card,sheetChoices(card,entries));});return {choices:memo('choices',build,()=>{choices++;return sheetChoices(build,entries);}),review:memo('review',build,()=>{reviews++;return cardMigrationIssues(build,entries);}),derived:memo('derived',build,()=>{derivations++;return evaluate(build);})};};
  const first=cards.map(read),started=performance.now();for(let i=0;i<20;i++)expect(read(cards[i%2])).toEqual(first[i%2]);
  return {switches:20,builds,choices,reviews,derivations,computeMs:Math.round((performance.now()-started)*100)/100};
 };
 const before=run(false),after=run(true);expect(before.derivations).toBe(22);expect(after).toMatchObject({builds:2,choices:2,reviews:2,derivations:2});expect(JSON.stringify(cards)).toBe(original);
 mkdirSync('.local-evidence/cloud-stage2',{recursive:true});writeFileSync('.local-evidence/cloud-stage2/card-switch-workload.json',JSON.stringify({scope:'Node computations on two authored 200-selection cards; not whole-page or user-device latency',before,after},null,2));
},30000);
