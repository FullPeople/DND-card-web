import {it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {ownedTrainingReference} from '../src/ui/entryMenuEntries';
const fallback=(reference:string):Entry=>({id:'custom-reference:'+reference,kind:'feature',name:'stale label',english:'',source:'CUSTOM',packId:'custom',edition:'both',revision:'1',entries:['must not resurrect'],raw:{_custom:true,privateBody:'must not retain'}});
it('rebuilds a currently held training literal without accepting a stored body or another source identity',()=>{
 const c=newCharacter();c.training={weapons:'{@item 测试匕首|XPHB}',tools:'手写工具；另一项',languages:'{@language Test|XPHB|原创语言}'};
 const current=ownedTrainingReference(c,fallback('测试匕首|XPHB'))!;expect(current).toMatchObject({name:'测试匕首',entries:[],raw:{_custom:true}});expect(current.raw).not.toHaveProperty('privateBody');
 expect(ownedTrainingReference(c,fallback('测试匕首|PHB'))).toBeUndefined();expect(ownedTrainingReference(c,fallback('手写工具'))?.entries).toEqual([]);expect(ownedTrainingReference(c,fallback('Test|XPHB|原创语言'))?.name).toBe('原创语言');
 for(const patch of [{source:'IMPORTED'},{packId:'other'},{edition:'2014' as const},{edition:'2024' as const},{kind:'item' as const}])expect(ownedTrainingReference(c,{...fallback('测试匕首|XPHB'),...patch})).toBeUndefined();
 c.training.weapons='';expect(ownedTrainingReference(c,fallback('测试匕首|XPHB'))).toBeUndefined();expect(ownedTrainingReference(newCharacter(),fallback('手写工具'))).toBeUndefined();
});

it('keeps active source-declared training removable while explicit empty records and disabled sources revoke it',()=>{
 const c=newCharacter();c.selections=[{id:'owner',level:1,quantity:1,equipped:false,entry:{...fallback('owner'),id:'owner',kind:'class',source:'XPHB',packId:'fixture',edition:'2024',raw:{startingProficiencies:{weapons:['simple','未收录武器'],tools:["thieves' tools"]},languageProficiencies:[{common:true}]}}}];
 expect(ownedTrainingReference(c,fallback('简易武器|XPHB'))?.entries).toEqual([]);expect(ownedTrainingReference(c,fallback('未收录武器'))?.name).toBe('未收录武器');expect(ownedTrainingReference(c,fallback("thieves' tools|XPHB|盗贼工具"))?.name).toBe('盗贼工具');expect(ownedTrainingReference(c,fallback('通用语'))?.name).toBe('通用语');
 c.training={weapons:''};expect(ownedTrainingReference(c,fallback('未收录武器'))).toBeUndefined();delete c.training;c.profile.enabledSources=[];expect(ownedTrainingReference(c,fallback('未收录武器'))).toBeUndefined();
});
