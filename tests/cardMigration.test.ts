import {describe,it,expect} from 'vitest';
import {newCharacter,type Character,type Entry,type Kind} from '../src/core/model';
import {cardMigrationIssues,migrationCandidates,migrationDraft,planCardMigration,emptyMigrationChoices,retainedProficiencies} from '../src/core/cardMigration';
import {readCharacterTransfer} from '../src/core/transfers';
import {readCharacter,validateCharacter} from '../src/core/validation';
import {syncFeatures,removeSelection} from '../src/core/sheet';
import {syncAutoResources} from '../src/core/resources';
import {spellState} from '../src/core/characterDetails';
const e=(id:string,kind:Kind,raw:Entry['raw']={}):Entry=>({id,name:id,english:id,kind,raw,entries:['原创验收资料'],source:'XPHB',packId:'fixture',revision:'1',edition:'2024'});
const add=(c:Character,entry:Entry,id=entry.id)=>{const row={id,entry:structuredClone(entry),level:1,quantity:1,equipped:false};c.selections.push(row);return row;};
const legacy=(entry:Entry):Entry=>({...entry,id:'old:'+entry.id,packId:'imported',source:'IMPORTED',edition:'both',raw:{}});
const identity={id:'copy',now:'2026-10-01T00:00:00.000Z'};
const mage=e('测试法师','class',{hd:{faces:6},casterProgression:'full',spellcastingAbility:'int',classFeatures:['初始特性|测试法师|XPHB|1']}),feature=e('初始特性','feature',{className:'测试法师',classSource:'XPHB',level:1});
describe('staged old card migration',()=>{
 it('warns on imported names even when they match, while confirmed custom retention and current native cards remain quiet',()=>{
  const c=newCharacter();add(c,legacy(mage));expect(cardMigrationIssues(c,[mage])).toHaveLength(1);
  const keep=planCardMigration(c,[mage],emptyMigrationChoices(),identity).card;expect(cardMigrationIssues(readCharacter(JSON.parse(JSON.stringify(keep))).character,[mage])).toEqual([]);
  keep.edition='2014';expect(cardMigrationIssues(keep,[mage])).toHaveLength(1);
  const native=newCharacter();add(native,mage);expect(cardMigrationIssues(native,[mage])).toEqual([]);
 });
 it('replaces all roots by confirmed source, retains quantity/equipment/ability and class level, and keeps the original unchanged',()=>{
  const c=newCharacter(),background=e('背景','background'),race=e('种族','race'),sub=e('子职','subclass',{className:mage.name,classSource:'XPHB'}),item=e('测试武器','item',{type:'M'});
  for(const entry of [background,mage,race,sub,item])add(c,legacy(entry));c.selections[1].level=4;c.selections[4]={...c.selections[4],quantity:3,equipped:true,attuned:true,weaponAbility:'cha'};c.proficiencies={perception:true};c.expertise={perception:true};c.notes='keep';
  const catalog=[background,mage,race,sub,item,feature],choices=emptyMigrationChoices();for(const row of c.selections)choices.roots[row.id]=catalog.find(e=>e.name===row.entry.name)!.id;
  const original=structuredClone(c),preview=migrationDraft(c,catalog,choices,1);expect(c).toEqual(original);expect(preview.grants).toHaveLength(1);
  choices.grants[preview.grants[0].key]={include:true};const plan=planCardMigration(c,catalog,choices,identity);
  expect(c).toEqual(original);expect(plan.card.selections.find(s=>s.entry.kind==='class')?.level).toBe(4);expect(plan.card.selections.find(s=>s.entry.kind==='subclass')?.parentId).toBe(c.selections[1].id);
  expect(plan.card.selections.find(s=>s.entry.kind==='item')).toMatchObject({id:c.selections[4].id,quantity:3,equipped:true,attuned:true,weaponAbility:'cha'});expect(plan.card.expertise).toEqual(c.expertise);expect(plan.card.proficiencies).toEqual(c.proficiencies);expect(validateCharacter(JSON.parse(JSON.stringify(plan.card)))).toEqual(plan.card);
 });
 it('matches source bubbles, reclassifies extras, and removes only explicitly unchecked leftovers in the copy',()=>{
  const c=newCharacter(),feat=e('额外专长','feat'),spell=e('额外法术','spell',{level:1}),item=e('额外物品','item');add(c,legacy(mage));add(c,legacy(feature),'bubble');add(c,{...legacy(feat),kind:'feature'},'feat');add(c,{...legacy(spell),kind:'feature'},'spell');add(c,{...legacy(item),kind:'feature'},'item');add(c,legacy(e('保留自定义','feature')),'keep');add(c,legacy(e('移除自定义','feature')),'remove');
  const catalog=[mage,feature,feat,spell,item],choices=emptyMigrationChoices();choices.roots[c.selections[0].id]=mage.id;const preview=migrationDraft(c,catalog,choices,1);choices.grants[preview.grants[0].key]={include:true,replaceId:'bubble'};choices.extras={feat:feat.id,spell:spell.id,item:item.id};choices.keep={keep:true,remove:false};
  const plan=planCardMigration(c,catalog,choices,identity);expect(plan.card.selections.find(s=>s.id==='bubble')).toMatchObject({parentId:c.selections[0].id,entry:feature});expect(plan.card.selections.find(s=>s.id==='feat')).toMatchObject({section:'heritage',entry:{kind:'feat'}});expect(plan.card.selections.find(s=>s.id==='spell')?.entry.kind).toBe('spell');expect(plan.card.selections.find(s=>s.id==='item')?.entry.kind).toBe('item');expect(plan.card.selections.some(s=>s.id==='remove')).toBe(false);expect(plan.card.selections.some(s=>s.id==='keep')).toBe(true);expect(c.selections.some(s=>s.id==='remove')).toBe(true);
 });
 it('retains prepared spell IDs, spent resources, and converts confirmed training references',()=>{
  const c=newCharacter(),spell=e('测试法术','spell',{level:1}),language=e('测试语言','rule',{_category:'language'});add(c,legacy(mage));add(c,legacy(spell),'prepared');c.training={languages:'测试语言',tools:'无法识别的工具'};c.spellSettings={...spellState(c),capacityAdjustment:2,prepared:['prepared']};c.runtime.resources.manual={name:'手动次数',current:1,max:3};
  const choices=emptyMigrationChoices();choices.roots[c.selections[0].id]=mage.id;choices.spells.prepared=spell.id;choices.training['languages:0']=language.id;
  const plan=planCardMigration(c,[mage,feature,spell,language],choices,identity);expect(plan.card.spellSettings?.prepared).toContain('prepared');expect(plan.card.runtime.resources.manual.current).toBe(1);expect(plan.card.runtime.resources['spell-slot:1'].current).toBe(0);expect(plan.card.training).toEqual({languages:'{@language 测试语言|XPHB}',tools:'无法识别的工具'});const resources=structuredClone(plan.card.runtime.resources);syncAutoResources(plan.card);expect(plan.card.runtime.resources).toEqual(resources);
 });
 it('does not grant starting equipment or cash now or on a later refresh',()=>{
  const c=newCharacter(),sword=e('Sword','item'),bg=e('Background','background',{startingEquipment:[{_:[{item:'Sword|XPHB'},{value:5000}]}]});add(c,legacy(bg));const choices=emptyMigrationChoices();choices.roots[c.selections[0].id]=bg.id;const plan=planCardMigration(c,[bg,sword],choices,identity);
  expect(plan.card.selections.filter(s=>s.entry.kind==='item')).toHaveLength(0);expect(plan.card.inventory?.coins.gp||0).toBe(0);expect(plan.card.inventory?.grantedCoins?.[c.selections[0].id+'|equipment:0']).toBe(50);expect(plan.card.dismissedFeatures).toContain(c.selections[0].id+'|equipment:0:_:0');const before=structuredClone(plan.card);syncFeatures(plan.card,[bg,sword],{owners:new Set([c.selections[0].id]),refresh:true});expect(plan.card.selections).toEqual(before.selections);expect(plan.card.inventory?.coins).toEqual(before.inventory?.coins);
 });
 it('preserves owned stacks after a changed background drops their old equipment key and later syncs run',()=>{
  const c=newCharacter(),oldItem=e('OldItem','item'),newItem=e('NewItem','item'),bg=e('NewBackground','background',{startingEquipment:[{_:[{item:'NewItem|XPHB'}]}]});
  add(c,legacy(bg),'bg');const owned=add(c,oldItem,'owned');Object.assign(owned,{parentId:'bg',grantKey:'equipment:0:a:0',quantity:3,equipped:true,attuned:true,weaponAbility:'cha'});
  const choices=emptyMigrationChoices();choices.roots={bg:bg.id,owned:oldItem.id};const before=structuredClone(c),catalog=[bg,oldItem,newItem];
  const plan=planCardMigration(c,catalog,choices,identity),stack=plan.card.selections.find(s=>s.id==='owned')!;
  expect(c).toEqual(before);expect(stack).toMatchObject({entry:oldItem,quantity:3,equipped:true,attuned:true,weaponAbility:'cha'});expect(stack.parentId).toBeUndefined();expect(stack.grantKey).toBeUndefined();expect(plan.warnings.some(s=>s.includes('独立已有物品'))).toBe(true);
  for(let n=0;n<3;n++){syncFeatures(plan.card,catalog);syncFeatures(plan.card,catalog,{owners:new Set(['bg']),refresh:true});expect(plan.card.selections.filter(s=>s.entry.kind==='item')).toEqual([stack]);}
  expect(plan.card.dismissedFeatures).toContain('bg|equipment:0:_:0');expect(validateCharacter(plan.card)).toEqual(plan.card);
 });
 it('does not replace an owned stack when the same grant key now declares a different item',()=>{
  const c=newCharacter(),kept=e('KeptItem','item'),newItem=e('NewItem','item'),bg=e('NewBackground','background',{startingEquipment:[{_:[{item:'NewItem|XPHB'}]}]});add(c,legacy(bg),'bg');Object.assign(add(c,kept,'owned'),{parentId:'bg',grantKey:'equipment:0:_:0',quantity:4,equipped:true});
  const choices=emptyMigrationChoices();choices.roots={bg:bg.id,owned:kept.id};const catalog=[bg,kept,newItem],plan=planCardMigration(c,catalog,choices,identity);expect(plan.card.selections.find(s=>s.id==='owned')?.parentId).toBeUndefined();expect(plan.card.dismissedFeatures).toContain('bg|equipment:0:_:0');syncFeatures(plan.card,catalog,{owners:new Set(['bg']),refresh:true});expect(plan.card.selections.filter(s=>s.entry.kind==='item')).toHaveLength(1);expect(plan.card.selections.find(s=>s.id==='owned')).toMatchObject({entry:kept,quantity:4,equipped:true});
 });
 it('keeps exact surviving equipment grants linked so deliberate removal remains dismissed',()=>{
  const c=newCharacter(),item=e('SameItem','item'),bg=e('Background','background',{startingEquipment:[{_:[{item:'SameItem|XPHB'}]}]});add(c,legacy(bg),'bg');Object.assign(add(c,item,'owned'),{parentId:'bg',grantKey:'equipment:0:_:0',quantity:2,equipped:true});const choices=emptyMigrationChoices();choices.roots={bg:bg.id,owned:item.id};const catalog=[bg,item],plan=planCardMigration(c,catalog,choices,identity);
  expect(plan.card.selections.find(s=>s.id==='owned')).toMatchObject({parentId:'bg',grantKey:'equipment:0:_:0',quantity:2,equipped:true});syncFeatures(plan.card,catalog);expect(plan.card.selections.filter(s=>s.entry.kind==='item')).toHaveLength(1);removeSelection(plan.card,'owned');expect(plan.card.dismissedFeatures).toContain('bg|equipment:0:_:0');syncFeatures(plan.card,catalog,{owners:new Set(['bg']),refresh:true});expect(plan.card.selections.filter(s=>s.entry.kind==='item')).toHaveLength(0);
 });
 it('keeps equipment and language candidate categories separate even when labels match',()=>{const c=newCharacter();c.training={languages:'同名',armor:'同名'};const language=e('language','rule',{_category:'language'}),armor=e('armor','item',{type:'S'});language.name=armor.name='同名';const rows=migrationDraft(c,[language,armor],emptyMigrationChoices()).training;expect(rows.find(r=>r.group==='languages')?.candidates.map(e=>e.id)).toEqual(['language']);expect(rows.find(r=>r.group==='armor')?.candidates.map(e=>e.id)).toEqual(['armor']);});
 it('recovers language and tool records from the original legacy snapshot without overwriting explicit native empty fields',()=>{const c=newCharacter();c.externalSnapshot={identity:{languages:['测试语言'],tool_proficiencies:[{name:'测试工具'}]}};c.training={languages:''};const draft=migrationDraft(c,[],emptyMigrationChoices(),5);expect(draft.card.training).toEqual({languages:'',tools:'测试工具'});expect(c.training).toEqual({languages:''});});
 it('keeps edition and source ambiguity explicit and rejects disabled targets',()=>{
  const c=newCharacter(),row=add(c,legacy(mage)),older={...mage,id:'2014',edition:'2014' as const,source:'PHB'},other={...mage,id:'other',source:'TCE'};expect(migrationCandidates(c,row,[mage,older,other]).map(e=>e.id)).toEqual([mage.id,other.id]);const choices=emptyMigrationChoices();choices.roots[row.id]=older.id;expect(()=>migrationDraft(c,[older,mage],choices)).toThrow(/版本/);choices.roots[row.id]=mage.id;c.profile.enabledSources=[];expect(()=>migrationDraft(c,[mage],choices)).toThrow(/未启用/);
 });
 it('keeps deliberately dismissed source bubbles dismissed',()=>{
  const c=newCharacter(),row=add(c,legacy(mage)),choices=emptyMigrationChoices();choices.roots[row.id]=mage.id;const first=migrationDraft(c,[mage,feature],choices,1),key=first.grants[0].key;choices.grants[key]={include:false};const plan=planCardMigration(c,[mage,feature],choices,identity);expect(plan.card.selections.some(s=>s.entry.id===feature.id)).toBe(false);syncFeatures(plan.card,[mage,feature],{owners:new Set([row.id]),refresh:true});expect(plan.card.selections.some(s=>s.entry.id===feature.id)).toBe(false);
 });
});
describe('legacy no-op save expertise compatibility',()=>{
 it('opens the observed boolean false save keys without mutating the original or losing real skill expertise',()=>{const c=newCharacter();c.expertise={perception:true,'save:cha':false,'save:con':false};const before=structuredClone(c);expect(()=>validateCharacter(c)).toThrow('专精记录无效');const read=readCharacter(c);expect(read.character.expertise).toEqual({perception:true});expect(read.repaired).toEqual(['旧版豁免的空专精标记']);expect(c).toEqual(before);expect(readCharacter(read.character).repaired).toEqual([]);});
 it('also imports a backed-up old native card without dropping any active proficiency',()=>{const c=newCharacter();c.expertise={arcana:true,'save:con':false};const [copy]=readCharacterTransfer([JSON.stringify({format:'dnd-card-web',version:1,character:c})]);expect(copy.expertise).toEqual({arcana:true});expect(c.expertise['save:con']).toBe(false);});
 it('still rejects active save expertise, unknown keys, and other malformed data',()=>{for(const expertise of [{'save:cha':true},{'save:unknown':false},{'unknown':false},{'save:con':false,perception:'yes'}])expect(()=>readCharacter({...newCharacter(),expertise})).toThrow('专精记录无效');});
});

it('warns only about classes, retaining arbitrary custom content on an already current card',()=>{
 const c=newCharacter();add(c,mage);
 for(const kind of ['race','background','subclass','item','spell','feature','feat'] as const)add(c,{...mage,id:'personal:'+kind,kind,source:'CUSTOM',packId:'custom',raw:{_custom:true}});
 expect(cardMigrationIssues(c,[mage])).toEqual([]);
 const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;
 expect(cardMigrationIssues(restored,[mage])).toEqual([]);
 restored.selections=restored.selections.filter(row=>row.entry.kind!=='class');
 expect(cardMigrationIssues(restored,[mage])).toEqual([]);
 add(restored,legacy(mage));expect(cardMigrationIssues(restored,[mage]).map(row=>row.entry.kind)).toEqual(['class']);
});

 it('accepts an explicitly searched training replacement but rejects another category or edition',()=>{
  const c=newCharacter();c.training={languages:'旧卡不一致的名称'};const language=e('不同名称的语言','rule',{_category:'language'}),armor=e('测试护甲','item',{type:'S'}),oldLanguage={...language,id:'old-language',edition:'2014' as const,source:'PHB'};const catalog=[language,armor,oldLanguage],choices=emptyMigrationChoices();choices.training['languages:0']=language.id;
  expect(migrationDraft(c,catalog,choices).card.training?.languages).toBe('{@language 不同名称的语言|XPHB}');expect(c.training.languages).toBe('旧卡不一致的名称');choices.training['languages:0']=armor.id;expect(()=>migrationDraft(c,catalog,choices)).toThrow('类别不同');choices.training['languages:0']=oldLanguage.id;expect(()=>migrationDraft(c,catalog,choices)).toThrow('当前规则版本');
 });

it('explains retained save abilities in Chinese in the migration preview',()=>{const c=newCharacter();c.proficiencies={'save:wis':true,athletics:true};expect(retainedProficiencies(c)).toEqual(['感知豁免','运动']);});
