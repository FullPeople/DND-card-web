import {describe,it,expect} from 'vitest';
import {newCharacter,type Character,type Entry,type Selection} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {planSourceSpells,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {specialSpellResource} from '../src/core/spellResourceKeys';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {sourceSpellEnabled,rememberSourceSpellUses} from '../src/core/automation/sourceSpellState';
import {readCharacter} from '../src/core/validation';

// Authored boundary tests; real full-source direct grants have a separate sealed
// native observation. These fixtures are not rule coverage or source evidence.
const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id,name:id,english:id,kind,source:'PHB',edition:'2014',packId:'authored-ownership',revision:'1',entries:[],raw});
const spell=entry('Owned spell','spell',{level:1}),other=entry('Other spell','spell',{level:1});
const owner=entry('Owner','class',{spellcastingAbility:'wis',additionalSpells:[{prepared:{1:['Owned spell|PHB']}}]});
function setup(){const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'owner',entry:structuredClone(owner),level:1,quantity:1,equipped:false}];const catalog=[owner,spell,other];syncSourceSpells(c,catalog);return {c,catalog,row:c.selections.find(s=>s.entry.kind==='spell')!};}
const held=(c:Character,id:string)=>planSourceSpells(c,[owner,spell,other]).issues.some(i=>i.id===`source-spell-collision:${id}`);
const manual=(row:Selection):Selection=>({id:row.id,entry:structuredClone(row.entry),level:1,quantity:1,equipped:false});

describe('declared source-spell generated IDs never authorize adoption',()=>{
 it.each([false,true])('preserves a native-valid manual row, configuration and preparation at the exact generated ID; manualSource=%s',linked=>{
  const {c,catalog,row}=setup();c.selections[c.selections.indexOf(row)]=manual(row);c.spellSettings!.special![row.id]={mode:'locked',label:'Authored manual record',...(linked?{manualSource:{ownerId:'manual'}}:{})};c.spellSettings!.prepared=[row.id];
  const saved=readCharacter(JSON.parse(JSON.stringify(c))).character,before=JSON.stringify(saved);expect(held(saved,row.id)).toBe(true);expect(JSON.stringify(saved)).toBe(before);
  syncSourceSpells(saved,catalog);expect(JSON.stringify(saved)).toBe(before);expect(sourceSpellEnabled(saved,row.id)).toBe(true);expect(readCharacter(JSON.parse(JSON.stringify(saved))).character).toEqual(saved);
 });
 it.each(['parent','grant-key','target','missing-config','config-owner','config-key','config-target','manual-config','duplicate'] as const)('holds %s rather than changing special/prepared or taking the inactive-cleanup path',kind=>{
  const {c,catalog,row}=setup(),g=c.spellSettings!.special![row.id].sourceGrant!;
  if(kind==='parent')row.parentId='other-owner';
  if(kind==='grant-key')row.grantKey+='-other';
  if(kind==='target')row.entry=structuredClone(other);
  if(kind==='missing-config')delete c.spellSettings!.special![row.id];
  if(kind==='config-owner')g.ownerId='other-owner';
  if(kind==='config-key')g.key+='-other';
  if(kind==='config-target')g.targetEntryId=other.id;
  if(kind==='manual-config'){delete c.spellSettings!.special![row.id].sourceGrant;c.spellSettings!.special![row.id].manualSource={ownerId:'manual'};}
  if(kind==='duplicate')c.selections.push(structuredClone(row));
  c.spellSettings!.prepared=[row.id];const before=JSON.stringify(c);expect(held(c,row.id)).toBe(true);syncSourceSpells(c,catalog);expect(JSON.stringify(c)).toBe(before);
 });
 it.each(['configuration','source-grant'] as const)('preserves a native-valid future field on an owned %s, not just on manual collisions',place=>{
  const {c,catalog,row}=setup(),config=c.spellSettings!.special![row.id];c.runtime.resources['spell-slot:1']={max:2,current:2};expect(spellPayments(c,row.id,{canEdit:true}).options.some(o=>o.available)).toBe(true);
  if(place==='configuration')(config as any).futureConfig={version:2,retained:['authored']};else(config.sourceGrant as any).future={version:2,retained:['authored']};
  c.spellSettings!.prepared=[row.id];const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;expect(restored).toEqual(c);const before=JSON.stringify(restored);
  expect(held(restored,row.id)).toBe(true);expect(sourceSpellEnabled(restored,row.id)).toBe(false);expect(spellPayments(restored,row.id,{canEdit:true}).options).toEqual([]);expect(performSpellAction(restored,spellActionRequest(restored,row.id,'slot:spell-slot:1','future-held'),{canEdit:true}).status).toBe('rejected');expect(JSON.stringify(restored)).toBe(before);syncSourceSpells(restored,catalog);syncSourceSpells(restored,catalog);expect(JSON.stringify(restored)).toBe(before);expect(readCharacter(JSON.parse(JSON.stringify(restored))).character).toEqual(restored);
 });
 it.each(['itemChargedSpell','targetScope','targetEntryId','sourceActionTiming'] as const)('does not recognize the known but foreign item marker %s on a declared-list grant',field=>{
  const {c,catalog,row}=setup();(c.spellSettings!.special![row.id].sourceGrant as any)[field]=field==='targetEntryId'?row.entry.id:field==='targetScope'?'self':field==='sourceActionTiming'?'action':{version:1};
  const before=JSON.stringify(c);expect(held(c,row.id)).toBe(true);expect(sourceSpellEnabled(c,row.id)).toBe(false);expect(spellPayments(c,row.id,{canEdit:true}).options).toEqual([]);expect(performSpellAction(c,spellActionRequest(c,row.id,'slot:spell-slot:1','foreign-held'),{canEdit:true}).status).toBe('rejected');syncSourceSpells(c,catalog);expect(JSON.stringify(c)).toBe(before);
 });
 it('updates the legitimate owned availability/ability without touching a manual same-spell copy',()=>{
  const {c,catalog,row}=setup();const independent={...manual(row),id:'manual-copy'};c.selections.push(independent);c.spellSettings!.special![independent.id]={mode:'locked',label:'Authored manual record'};c.spellSettings!.prepared=[independent.id];
  const kept=structuredClone([independent,c.spellSettings!.special![independent.id],c.spellSettings!.prepared]);expect(held(c,row.id)).toBe(false);
  c.profile.enabledSources=[];syncSourceSpells(c,catalog);expect(sourceSpellEnabled(c,row.id)).toBe(false);
  c.profile.enabledSources=['PHB'];c.selections[0].entry.raw.spellcastingAbility='cha';syncSourceSpells(c,catalog);expect(sourceSpellEnabled(c,row.id)).toBe(true);expect(c.spellSettings!.special![row.id].sourceGrant!.ability).toBe('cha');
  expect([c.selections.find(s=>s.id===independent.id),c.spellSettings!.special![independent.id],c.spellSettings!.prepared]).toEqual(kept);const before=JSON.stringify(c);syncSourceSpells(c,catalog);expect(JSON.stringify(c)).toBe(before);
 });
 it('excludes an opaque owned uses configuration from debt capture outside sync as well as inside it',()=>{
  const {c,catalog}=setup();c.selections=c.selections.filter(s=>s.entry.kind!=='spell');c.spellSettings!.special={};c.selections[0].entry.raw.additionalSpells=[{innate:{'_':{daily:{pbe:['Owned spell|PHB']}}}}];c.selections[0].level=5;syncSourceSpells(c,catalog);
  const row=c.selections.find(s=>s.entry.kind==='spell')!,config=c.spellSettings!.special![row.id],key=specialSpellResource(row.id,c);c.runtime.resources[key].current=0;(config.sourceGrant as any).future={version:2};
  const before=JSON.stringify(c);expect(readCharacter(JSON.parse(before)).character).toEqual(c);rememberSourceSpellUses(c);expect(JSON.stringify(c)).toBe(before);syncSourceSpells(c,catalog);expect(JSON.stringify(c)).toBe(before);expect(sourceSpellEnabled(c,row.id)).toBe(false);expect(spellPayments(c,row.id,{canEdit:true}).options).toEqual([]);expect(performSpellAction(c,spellActionRequest(c,row.id,'source','future-restore','restore'),{canEdit:true}).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
 });
 it('keeps legitimate PB maxima and individual/shared pool transitions without replenishing',()=>{
  const {c,catalog}=setup();c.selections=c.selections.filter(s=>s.entry.kind!=='spell');c.spellSettings!.special={};
  c.selections[0].entry.raw.additionalSpells=[{innate:{'_':{daily:{pbe:['Owned spell|PHB','Other spell|PHB']}}}}];c.selections[0].level=5;syncSourceSpells(c,catalog);
  const row=c.selections.find(s=>s.entry.kind==='spell')!,key=specialSpellResource(row.id,c);expect(c.runtime.resources[key].max).toBe(3);c.runtime.resources[key].current=1;
  c.selections[0].level=1;syncSourceSpells(c,catalog);expect(c.runtime.resources[key]).toMatchObject({max:2,current:0});c.selections[0].level=5;syncSourceSpells(c,catalog);expect(c.runtime.resources[key]).toMatchObject({max:3,current:1});expect(held(c,row.id)).toBe(false);
  c.selections[0].entry.raw.additionalSpells=[{innate:{'_':{daily:{pb:['Owned spell|PHB','Other spell|PHB']}}}}];
  const choice=planSourceSpells(c,catalog).choices.find(q=>q.usageModes)!;c.automation!.spellUsageModes={[choice.key]:'each'};syncSourceSpells(c,catalog);const current=c.selections.filter(s=>s.grantKey?.includes('/daily/pb/'));expect(current).toHaveLength(2);
  for(const row of current)c.runtime.resources[specialSpellResource(row.id,c)].current=2;
  c.automation!.spellUsageModes![choice.key]='shared';syncSourceSpells(c,catalog);expect(specialSpellResource(current[0].id,c)).toBe(specialSpellResource(current[1].id,c));expect(c.runtime.resources[specialSpellResource(current[0].id,c)].current).toBe(1);expect(held(c,current[0].id)).toBe(false);
 });
 it('still withdraws only an owned declared grant when its declaration disappears',()=>{
  const {c,catalog,row}=setup();delete c.selections[0].entry.raw.additionalSpells;syncSourceSpells(c,catalog);expect(c.spellSettings!.special![row.id].sourceGrant!.active).toBe(false);expect(c.selections.find(s=>s.id===row.id)).toEqual(row);
 });
});
