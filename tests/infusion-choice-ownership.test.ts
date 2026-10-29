import {describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {normalizeData} from '../src/data/catalog';
import {newCharacter,type Character} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {chooseSheetOption,setSheetChoiceSlot,sheetChoices} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {InfusionControl} from '../src/ui/InfusionControl';
import {setInfusionTarget} from '../src/core/automation/infusions';
import {exportCharacter,exportLinkedOwlbear} from '../src/core/export';
import {readCharacter,importOwlbear} from '../src/core/validation';
import {readCharacterTransfer} from '../src/core/transfers';

const directory=process.env.INFUSION_CHOICE_SOURCE_DIR;
if(process.env.INFUSION_CHOICE_SOURCE_REQUIRED==='1'&&!directory)throw Error('Exact private frozen infusion source directory is required.');
const snapshot=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pins={
 'class/class-artificer.json':'c65cad57eebdfff6508a0cfb821ec670a41cc3f057512cadd19f3805cf1a01d7',
 'optionalfeatures.json':'031970dfac1770a548549bd30535319c2493c47ebeaedfdb6a601651bbfc3844',
 'items-base.json':'8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff'
} as const;
function frozen(path:keyof typeof pins){
 const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8')),rows=index.rows.filter((row:any)=>row.url===`https://5e.kiwee.top/data/${path}`);
 if(rows.length!==1||rows[0].sha256!==pins[path])throw Error(`Exact frozen input required: ${path}`);
 const body=JSON.parse(readFileSync(`${directory}/${rows[0].path}`,'utf8'));
 if(snapshot(body)!==pins[path])throw Error(`Frozen input hash mismatch: ${path}`);
 return body;
}
function setup(){
 const entries=normalizeData({...frozen('class/class-artificer.json'),...frozen('optionalfeatures.json'),...frozen('items-base.json')},'choice-ownership-frozen');
 const find=(kind:string,english:string,source:string)=>{const found=entries.filter(entry=>entry.kind===kind&&entry.english===english&&entry.source===source);if(found.length!==1)throw Error(`Unique real source entry required: ${kind}/${english}/${source}`);return found[0];};
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['TCE','PHB'];
 c.runtime.hp=3;c.runtime.resources.manual={name:'Authored spent resource',current:2,max:7};c.notes='Authored manual sentinel';
 c.training={tools:'Authored manual tools',languages:'Authored manual languages'};c.sheetBonuses={hp:2,speed:5};c.proficiencies={athletics:true};c.quickbarActions=[{id:'manual',name:'Authored attack',attack:'+12',damage:'3d6'}];
 c.selections=[{id:'owner',entry:find('class','Artificer','TCE'),level:2,quantity:1,equipped:false},{id:'armor',entry:find('item','Leather Armor','PHB'),level:1,quantity:1,equipped:true},{id:'manual-shield',entry:find('item','Shield','PHB'),level:1,quantity:1,equipped:false},{id:'weapon',entry:find('item','Longsword','PHB'),level:1,quantity:1,equipped:false}];
 c.selections.find(row=>row.id==='manual-shield')!.entry.raw.bonusAc='+3';
 syncFeatures(c,entries);
 const infusion=find('feature','Enhanced Defense','TCE'),choice=sheetChoices(c,entries).find(row=>row.ownerId==='owner'&&row.sourceProgression==='optional'&&row.options.some(option=>option.value===infusion.id));
 if(!choice)throw Error('Real class progression must expose Enhanced Defense.');
 return {c,entries,infusion,choice,find};
}
const manual=(c:Character)=>snapshot({selections:c.selections,runtime:c.runtime,notes:c.notes,abilities:c.abilities,sheetBonuses:c.sheetBonuses,training:c.training,proficiencies:c.proficiencies,quickbarActions:c.quickbarActions});
const reopen=(c:Character)=>readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;
function control(state:ReturnType<typeof setup>){
 const render=()=>{const before=snapshot(state.c),html=renderToStaticMarkup(createElement(InfusionControl,{c:state.c,choiceId:state.choice.id,ownerId:'owner',entry:state.infusion,unavailable:false,writable:true,edit:(edit:(c:Character)=>void)=>{edit(state.c);}}));expect(snapshot(state.c)).toBe(before);return html;};
 // Exercise the same real core intent invoked by InfusionControl, not a copied
 // activation implementation. Rendering below uses the unmocked component.
 const confirm=()=>setInfusionTarget(state.c,state.choice.id,state.infusion.id,'armor');
 return {render,confirm};
}
describe.skipIf(!directory)('actual optional-choice activation ownership',()=>{
 it('real Enhanced Defense concept forget/relearn stays AC 11 until fresh InfusionControl confirmation',()=>{
  const state=setup(),{c,entries,infusion,choice}=state;
  const saved=manual(c);
  expect(evaluate(c).ac).toBe(11);chooseSheetOption(c,choice.id,infusion.id,entries);expect(evaluate(c).ac).toBe(11);
  const ui=control(state);expect(ui.render()).toContain('尚未指定灌注目标');ui.confirm();expect(evaluate(c).ac).toBe(12);
  chooseSheetOption(c,choice.id,infusion.id,entries);expect(evaluate(c).ac).toBe(11);
  chooseSheetOption(c,choice.id,infusion.id,entries);expect(evaluate(c).ac).toBe(11);expect(ui.render()).toContain('尚未指定灌注目标');
  ui.confirm();expect(evaluate(c).ac).toBe(12);expect(manual(c)).toBe(saved);
 });
 it('slot replacement removes only the replaced target intent and native/linked reopen cannot resurrect it',()=>{
  const state=setup(),{c,entries,infusion,choice,find}=state;chooseSheetOption(c,choice.id,infusion.id,entries);control(state).confirm();expect(evaluate(c).ac).toBe(12);
  const saved=manual(c),replacement=find('feature','Enhanced Arcane Focus','TCE');
  setSheetChoiceSlot(c,choice.id,0,replacement.id,entries);expect(c.infusions!.bindings).toEqual([]);expect(evaluate(c).ac).toBe(11);
  for(const restored of [reopen(c),importOwlbear(JSON.parse(JSON.stringify(exportLinkedOwlbear(c,evaluate(c))))),...readCharacterTransfer([JSON.stringify(exportCharacter(c))])]){
   setSheetChoiceSlot(restored,choice.id,0,infusion.id,[]);syncFeatures(restored,[]);expect(evaluate(restored).ac).toBe(11);expect(restored.infusions!.bindings).toEqual([]);expect(manual(restored)).toBe(saved);
   setInfusionTarget(restored,choice.id,infusion.id,'armor');expect(evaluate(restored).ac).toBe(12);
  }
 });
 it('no-op and reorder preserve both still-learned bindings rather than treating slot movement as unlearning',()=>{
  const state=setup(),{c,entries,infusion,choice,find}=state,weapon=find('feature','Enhanced Weapon','TCE');
  setSheetChoiceSlot(c,choice.id,0,infusion.id,entries);setSheetChoiceSlot(c,choice.id,1,weapon.id,entries);control(state).confirm();setInfusionTarget(c,choice.id,weapon.id,'weapon');
  const saved=JSON.stringify(c.infusions),items=manual(c);setSheetChoiceSlot(c,choice.id,0,infusion.id,entries);setSheetChoiceSlot(c,choice.id,1,infusion.id,entries);
  expect(c.answers[choice.id].slice(0,2)).toEqual([weapon.id,infusion.id]);expect(JSON.stringify(c.infusions)).toBe(saved);expect(evaluate(c).ac).toBe(12);expect(manual(c)).toBe(items);
 });
 it('forgetting one owner preserves another real owner binding and an unrelated retained record in the same choice',()=>{
  const state=setup(),{c,entries,infusion,choice,find}=state;
  c.selections.push({id:'other-owner',entry:structuredClone(c.selections[0].entry),level:2,quantity:1,equipped:false});syncFeatures(c,entries);
  const other=sheetChoices(c,entries).find(row=>row.ownerId==='other-owner'&&row.sourceProgression==='optional')!,weapon=find('feature','Enhanced Weapon','TCE');
  setSheetChoiceSlot(c,other.id,0,weapon.id,entries);setInfusionTarget(c,other.id,weapon.id,'weapon');chooseSheetOption(c,choice.id,infusion.id,entries);control(state).confirm();
  c.infusions!.bindings.push({choiceId:choice.id,entryId:'authored-retained-unlearned-entry',targetId:'manual-shield'});
  const retained=structuredClone(c.infusions!.bindings.filter(binding=>binding.entryId!==infusion.id)),saved=manual(c);
  chooseSheetOption(c,choice.id,infusion.id,entries);expect(c.infusions!.bindings).toEqual(retained);expect(manual(c)).toBe(saved);
  chooseSheetOption(c,choice.id,infusion.id,entries);expect(evaluate(c).ac).toBe(11);expect(c.infusions!.bindings).toEqual(retained);
 });
 it('source/feature and level suspension preserve consent, native state and manual data until explicitly forgotten',()=>{
  const state=setup(),{c,entries,infusion,choice}=state;chooseSheetOption(c,choice.id,infusion.id,entries);control(state).confirm();const saved=JSON.stringify(c.infusions),items=manual(c);
  c.profile.enabledSources=['PHB'];expect(evaluate(c).ac).toBe(11);const restored=reopen(c);expect(JSON.stringify(restored.infusions)).toBe(saved);restored.profile.enabledSources=['TCE','PHB'];expect(evaluate(restored).ac).toBe(12);
  const source=restored.selections.find(row=>row.entry.english==='Infuse Item')!;restored.profile.disabledEntries=[source.entry.id];expect(evaluate(restored).ac).toBe(11);restored.profile.disabledEntries=[];expect(evaluate(restored).ac).toBe(12);
  restored.selections[0].level=1;expect(evaluate(restored).ac).toBe(11);restored.selections[0].level=2;expect(evaluate(restored).ac).toBe(12);expect(JSON.stringify(restored.infusions)).toBe(saved);expect(manual(restored)).toBe(items);
 });
 it.each([{version:7,future:{untouched:['opaque']}},{version:1,bindings:null},{version:1,bindings:[null]}])('choice edits preserve opaque or malformed activation state %# without repair',store=>{
  const {c,entries,infusion,choice}=setup();chooseSheetOption(c,choice.id,infusion.id,entries);(c as any).infusions=structuredClone(store);const saved=JSON.stringify(c.infusions);
  chooseSheetOption(c,choice.id,infusion.id,entries);expect(JSON.stringify(c.infusions)).toBe(saved);
  setSheetChoiceSlot(c,choice.id,0,infusion.id,entries);setSheetChoiceSlot(c,choice.id,0,undefined,entries);expect(JSON.stringify(c.infusions)).toBe(saved);
 });
});
