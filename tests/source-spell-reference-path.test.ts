import {expect,it} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {syncSourceSpells,planSourceSpells} from '../src/core/automation/sourceSpells';
import {declaredSourceSpellOwnedChild} from '../src/core/automation/sourceSpellOwnership';
import {performSpellAction,spellActionRequest} from '../src/core/automation/actions';
import {specialSpellResource} from '../src/core/specialSpells';
import {readCharacter} from '../src/core/validation';

function setup(name:string,source='PHB'){
 const spell:Entry={id:'authored-spell-path:'+name+':'+source,kind:'spell',name,english:name,source,edition:'2014',packId:'authored-spell-path',revision:'1',entries:[],raw:{level:1}},c=newCharacter('2014');
 c.automation=newAutomationState();c.profile.enabledSources=['PHB',source];c.runtime.resources.manual={max:9,current:2};
 c.selections=[{id:'path-owner',quantity:1,level:3,equipped:false,entry:{...spell,id:'authored-spell-path-owner',kind:'feat',name:'Authored path source',english:'Authored path source',source:'PHB',raw:{additionalSpells:[{ability:'wis',innate:{'_':{daily:{'1e':[name+'|'+source]}}}}]}}}];
 syncSourceSpells(c,[spell]);return {c,spell,row:c.selections.find(row=>row.entry.kind==='spell')!};
}
for(const source of ['PHB','KT:O'])it('retains a literal slash in a saved source-qualified spell name: '+source,()=>{
 const {c,spell,row}=setup('Authored divided/name',source);expect(row).toBeDefined();expect(declaredSourceSpellOwnedChild(c,row)).toBe(true);expect(planSourceSpells(c,[spell]).grants.some(grant=>grant.id===row.id&&grant.config.sourceGrant?.active)).toBe(true);
 const resource=specialSpellResource(row.id,c);expect(performSpellAction(c,spellActionRequest(c,row.id,'source','authored-slash-cast')).status).toBe('applied');expect(c.runtime.resources[resource].current).toBe(0);
 const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;restored.profile.enabledSources=[];syncSourceSpells(restored,[spell]);expect(restored.spellSettings!.special![row.id].sourceGrant!.active).toBe(false);
 restored.profile.enabledSources=['PHB',source];syncSourceSpells(restored,[spell]);expect(restored.spellSettings!.special![row.id].sourceGrant!.active).toBe(true);expect(restored.runtime.resources[resource].current).toBe(0);expect(restored.runtime.resources.manual).toEqual({max:9,current:2});
});
it('does not adopt an unrelated future path merely because its tail matches the saved spell name',()=>{
 const {c,spell,row}=setup('Authored plain spell'),previous=row.id,config=c.spellSettings!.special![previous],resource=c.runtime.resources[specialSpellResource(previous,c)];
 const key='source-spell:0/innate/_/daily/1e/foreign-prefix/Authored plain spell|PHB';row.grantKey=key;row.id='auto-spell:path-owner:'+encodeURIComponent(key);config.sourceGrant!.key=key;
 delete c.spellSettings!.special![previous];c.spellSettings!.special![row.id]=config;delete c.runtime.resources['innate-spell:'+previous];c.runtime.resources['innate-spell:'+row.id]=resource;c.selections[0].entry.raw.additionalSpells=[];
 const before=JSON.stringify(c);expect(declaredSourceSpellOwnedChild(c,row)).toBe(false);syncSourceSpells(c,[spell]);expect(JSON.stringify(c)).toBe(before);
 expect(performSpellAction(c,spellActionRequest(c,row.id,'source','authored-foreign-tail'),{canEdit:true}).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
});
