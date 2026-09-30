import {it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {dropRejection} from '../src/ui/dropRejection';
const entry=(id='fixture',source='XPHB'):Entry=>({id,name:id,english:id,kind:'feat',source,edition:'2024',packId:'fixture',revision:'1',entries:[],raw:{}});
it('distinguishes wrong landing, edition, source, dependency, duplicate and disabled option without mutation',()=>{
 const c=newCharacter(),e=entry(),before=JSON.stringify(c);expect(dropRejection(c,e,{kinds:['race']})).toContain('需要种族');expect(JSON.stringify(c)).toBe(before);
 expect(dropRejection(c,entry('old','PHB'),{kinds:['feat']})).toContain('2014 规则');expect(dropRejection(c,entry('book','Other'),{kinds:['feat']})).toContain('来源 Other 未启用');
 expect(dropRejection(c,{...e,dependencies:['Other']},{kinds:['feat']})).toContain('依赖来源：Other');c.selections.push({id:'stored',entry:e,quantity:1,level:1,equipped:false});
 expect(dropRejection(c,e,{kinds:['feat']})).toContain('已经在');expect(dropRejection(c,e,{kinds:['feat'],allowExisting:true})).toBeUndefined();
 c.profile.disabledEntries=[e.id];expect(dropRejection(c,e,{allowExisting:true})).toContain('单独禁用');
 expect(dropRejection(c,e,{referenceOnly:true})).toBeUndefined();expect(dropRejection(c,e,{accepts:()=>false,rejectReason:'只能放戏法。'})).toBe('只能放戏法。');
});
