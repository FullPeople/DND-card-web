import {expect,it} from 'vitest';
import {newCharacter,type Entry,type Selection} from '../src/core/model';
import {cardDecorationSignature} from '../src/ui/cardDecorationSignature';
const selection=(id:string,kind:Entry['kind'],name:string,level=1):Selection=>({id,level,quantity:1,equipped:false,entry:{id,kind,name,english:name,source:'PHB',edition:'2014',packId:'fixture',revision:'1',entries:[],raw:{name,ENG_name:name}}});
it('keeps the decorative tree for nonvisual source, balance and palette changes, and refreshes actual status/identity changes',()=>{
 const card=newCharacter(),key=cardDecorationSignature(card),changed={...card,profile:{...card.profile,enabledSources:[...card.profile.enabledSources,'NEW']},runtime:{...card.runtime,hp:1},palette:{paper:'#FFFFFF'}};
 expect(cardDecorationSignature(changed)).toBe(key);expect(cardDecorationSignature({...card,id:'different-owner'})).not.toBe(key);
 expect(cardDecorationSignature({...card,selections:[selection('poison','condition','Poisoned')]})).not.toBe(key);
});
it('updates the watermark when the primary class changes, preserving the first class on tied levels',()=>{
 const card=newCharacter(),wizard=selection('wizard','class','Wizard',2),fighter=selection('fighter','class','Fighter',1),first={...card,selections:[wizard,fighter]},key=cardDecorationSignature(first);
 expect(cardDecorationSignature({...card,selections:[wizard,{...fighter,level:2}]})).toBe(key);expect(cardDecorationSignature({...card,selections:[wizard,{...fighter,level:3}]})).not.toBe(key);
});
