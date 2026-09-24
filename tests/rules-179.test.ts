import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {editionAllows,entryEdition,newCharacter,selectionAllowed,subclassOwner} from '../src/core/model';
import {candidateReason,evaluate} from '../src/core/engine';
import {parseBbcode,bbUrl} from '../src/core/bbcode';

it('PHB subclass adaptations bind to the declared 2024 parent without merging identities',()=>{
 const entries=normalizeData({class:[{name:'术士',ENG_name:'Sorcerer',source:'XPHB'}],subclass:['PHB','XPHB'].flatMap(classSource=>['狂野魔法','龙族血脉'].map(name=>({name,source:'PHB',className:'术士',classSource})))},'test');
 const c=newCharacter();c.selections=[{id:'sorcerer',entry:entries.find(e=>e.kind==='class')!,quantity:1,level:3,equipped:false}];
 const subclasses=entries.filter(e=>e.kind==='subclass');expect(new Set(subclasses.map(e=>e.id)).size).toBe(4);
 for(const entry of subclasses){if(entry.raw.classSource==='XPHB'){expect(entryEdition(entry)).toBe('2024');expect(subclassOwner(c,entry)?.id).toBe('sorcerer');expect(candidateReason(c,entry)).toBeUndefined();}else{expect(candidateReason(c,entry)).toBeTruthy();}}
});
it('only core PHB and DMG gate editions; source and individually disabled rules still apply',()=>{
 const c=newCharacter('2014');
 for(const source of ['XGE','TCE','FRHoF','MM','XMM','CUSTOM']){const e=normalizeData({feat:[{name:'测试',source,edition:'one'}]},'1')[0];c.profile.enabledSources.push(e.source);expect(selectionAllowed(c,e)).toBe(true);expect(editionAllows(e,'2024')).toBe(true);c.profile.disabledEntries=[e.id];expect(selectionAllowed(c,e)).toBe(false);c.profile.disabledEntries=[];}
 for(const source of ['XPHB','XDMG']){const e=normalizeData({feat:[{name:'测试',source}]},'1')[0];c.profile.enabledSources.push(source);expect(selectionAllowed(c,e)).toBe(false);}
 const old=normalizeData({feat:[{name:'测试',source:'PHB'}]},'1')[0];expect(editionAllows(old,'2024')).toBe(false);expect(editionAllows(old,'2024',true)).toBe(true);
});
it('background attribute annotations survive but do not alter base scores or derived skills',()=>{
 const c=newCharacter(),e=normalizeData({background:[{name:'学者',source:'XPHB',ability:[{int:2}]}]},'1')[0];e.effects=[{op:'add',target:'int',value:2}];c.selections=[{id:'bg',entry:e,quantity:1,level:1,equipped:false}];c.backgroundChoices={bg:{abilities:{int:2,wis:1}}};c.abilities.int=15;
 const d=evaluate(c);expect(d.abilities.int).toBe(15);expect(d.modifiers.int).toBe(2);expect(d.skills.arcana.value).toBe(2);expect(c.backgroundChoices.bg.abilities?.int).toBe(2);
});
it('BBCode supports nested format and list items while preserving code text and rejecting executable links',()=>{
 expect(parseBbcode('[b]甲[i]乙[/i][/b]')).toEqual([{tag:'b',value:undefined,children:['甲',{tag:'i',value:undefined,children:['乙']}]}]);
 expect(parseBbcode('[list][*]一[*]二[/list]')).toEqual([{tag:'list',value:undefined,children:[{tag:'*',value:undefined,children:['一']},{tag:'*',value:undefined,children:['二']}]}]);
 expect(parseBbcode('[code][b]<script>[/b][/code]')[0]).toEqual({tag:'code',value:undefined,children:['[b]','<script>','[/b]']});
 expect(bbUrl('javascript:alert(1)')).toBeUndefined();expect(bbUrl('https://example.com')).toBe('https://example.com/');
});
