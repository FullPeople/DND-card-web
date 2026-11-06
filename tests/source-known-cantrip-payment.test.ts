import {expect,it} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {performSpellAction,spellActionRequest,spellPayments} from '../src/core/automation/actions';
import {specialSpellResource} from '../src/core/specialSpells';
import {readCharacter} from '../src/core/validation';
function setup(mode:'known'|'daily'|'unknown'){
 const c=newCharacter('2014'),spell:Entry={id:'authored-source-cantrip',kind:'spell',name:'Authored source cantrip',english:'Authored source cantrip',source:'PHB',edition:'2014',packId:'authored-source-cantrip',revision:'1',entries:[],raw:{level:0}};
 const ref=spell.english+'|PHB',block=mode==='known'?{known:{'1':[ref]}}:mode==='daily'?{innate:{'_':{daily:{'1e':[ref]}}}}:{innate:{'_':[ref]}};
 c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.runtime.resources.manual={max:9,current:2};c.selections=[{id:'cantrip-source',quantity:1,level:1,equipped:false,entry:{...spell,id:'authored-cantrip-owner',kind:'feat',raw:{additionalSpells:[{ability:'wis',...block}]}}}];syncSourceSpells(c,[spell]);return {c,row:c.selections.find(row=>row.entry.kind==='spell')!};
}
it('casts an explicitly learned normal cantrip without requiring a class or spending slots',()=>{
 const {c,row}=setup('known');expect(row).toBeDefined();expect(c.selections.some(row=>row.entry.kind==='class')).toBe(false);
 const payment=spellPayments(c,row.id,{canEdit:true}).options.find(option=>option.id==='free'&&option.available);expect(payment).toBeDefined();
 expect(performSpellAction(c,spellActionRequest(c,row.id,'free','authored-known-cantrip'),{canEdit:true}).status).toBe('applied');expect(c.runtime.resources).toEqual({manual:{max:9,current:2}});
 const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;expect(spellPayments(restored,row.id,{canEdit:true}).options.some(option=>option.id==='free'&&option.available)).toBe(true);
});
it('keeps an explicitly limited cantrip charged and an undeclared casting cost held',()=>{
 const daily=setup('daily'),resource=specialSpellResource(daily.row.id,daily.c);expect(spellPayments(daily.c,daily.row.id,{canEdit:true}).options.some(option=>option.id==='free')).toBe(false);
 expect(performSpellAction(daily.c,spellActionRequest(daily.c,daily.row.id,'source','authored-limited-cantrip'),{canEdit:true}).status).toBe('applied');expect(daily.c.runtime.resources[resource].current).toBe(0);
 const unknown=setup('unknown'),before=JSON.stringify(unknown.c);expect(spellPayments(unknown.c,unknown.row.id,{canEdit:true}).options).toEqual([]);expect(performSpellAction(unknown.c,spellActionRequest(unknown.c,unknown.row.id,'free','authored-unknown-cantrip'),{canEdit:true}).status).toBe('rejected');expect(JSON.stringify(unknown.c)).toBe(before);
});
