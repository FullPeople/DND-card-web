import 'fake-indexeddb/auto';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {planSourceSpells,setSourceSpellChoices,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {performSpellAction,spellActionRequest} from '../src/core/automation/actions';
import {specialSpellResource} from '../src/core/specialSpells';
import {readCharacter} from '../src/core/validation';
import type {Workspace} from '../src/platform/storage';

beforeEach(()=>{
 vi.resetModules();vi.doMock('../src/platform/buildMode',()=>({standalone:true,automationDevelopment:false}));
 vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('location',{search:'',hash:''});vi.stubGlobal('BroadcastChannel',undefined);
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.doUnmock('../src/platform/buildMode');});

function setup(){
 const make=(kind:Entry['kind'],name:string,raw:Entry['raw']):Entry=>({id:'authored-class-storage:'+kind+':'+name,kind,name,english:name,source:'PHB',edition:'2014',packId:'authored-class-storage',revision:'1',entries:[],raw});
 const catalog=[make('class','Wizard',{}),...['Authored first spell','Authored second spell'].map(name=>make('spell',name,{level:0,classes:{fromClassList:[{name:'Wizard',source:'PHB'}]}}))];
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.runtime.resources.manual={max:9,current:2};
 c.selections=[{id:'authored-storage-owner',quantity:1,level:3,equipped:false,entry:make('feat','Authored daily gift',{additionalSpells:[{ability:'wis',innate:{'_':{daily:{'2e':[{choose:'level=0|class=Wizard',count:1}]}}}}]})}];
 const choice=planSourceSpells(c,catalog).choices.find(row=>row.spells)!;expect(choice.spells).toHaveLength(2);
 setSourceSpellChoices(c,choice.key,['Authored first spell|PHB'],catalog);syncSourceSpells(c,catalog);
 const workspace:Workspace={schemaVersion:1,characters:[c],activeId:c.id,packs:[]};return {c,catalog,key:choice.key,workspace};
}

it('reopens the actual stored query snapshot and spends only the remaining source uses without a catalog',async()=>{
 const {saveWorkspace,loadWorkspace}=await import('../src/platform/storage'),{c,key,workspace}=setup();
 const row=c.selections.find(row=>row.entry.kind==='spell')!,resource=specialSpellResource(row.id,c);
 expect(performSpellAction(c,spellActionRequest(c,row.id,'source','authored-before-storage')).status).toBe('applied');expect(c.runtime.resources[resource].current).toBe(1);
 const context=structuredClone(c.sourceSpellChoiceContexts);await saveWorkspace(workspace);
 const stored=(await loadWorkspace(true))!;const reopened=readCharacter(stored.characters[0]).character;
 expect(reopened).not.toBe(c);expect(reopened.selections.some(row=>row.entry.kind==='class')).toBe(false);
 expect(reopened.sourceSpellChoiceContexts).toEqual(context);expect(reopened.automation!.spellChoices![key]).toEqual(['Authored first spell|PHB']);
 expect(reopened.runtime.resources[resource].current).toBe(1);expect(planSourceSpells(reopened).grants.some(grant=>grant.id===row.id&&grant.config.sourceGrant?.active)).toBe(true);
 expect(performSpellAction(reopened,spellActionRequest(reopened,row.id,'source','authored-after-storage')).status).toBe('applied');expect(reopened.runtime.resources[resource].current).toBe(0);
 stored.characters=[reopened];await saveWorkspace(stored);const final=readCharacter((await loadWorkspace(true))!.characters[0]).character;
 expect(final.sourceSpellChoiceContexts).toEqual(context);expect(final.runtime.resources[resource].current).toBe(0);expect(final.runtime.resources.manual).toEqual({max:9,current:2});
 const before=JSON.stringify(final);expect(performSpellAction(final,spellActionRequest(final,row.id,'source','authored-after-exhaustion')).status).toBe('rejected');expect(JSON.stringify(final)).toBe(before);
});

it.each(['request-error','transaction-abort'] as const)('rolls back the workspace and backup together when saving a changed class-filter choice fails: %s',async failure=>{
 const {saveWorkspace,loadWorkspace,restoreBackup}=await import('../src/platform/storage'),{c,catalog,key,workspace}=setup();
 await saveWorkspace(workspace);const first=structuredClone(workspace),row=c.selections.find(row=>row.entry.kind==='spell')!,resource=specialSpellResource(row.id,c);
 expect(performSpellAction(c,spellActionRequest(c,row.id,'source','authored-stored-first-use')).status).toBe('applied');c.name='Authored committed revision';c.revision++;
 await saveWorkspace(workspace);const committed=structuredClone(workspace);expect(await restoreBackup()).toEqual(first);expect(committed.characters[0].runtime.resources[resource].current).toBe(1);
 setSourceSpellChoices(c,key,['Authored second spell|PHB'],catalog);syncSourceSpells(c,catalog);c.name='Authored unsaved revision';c.revision++;
 const next=c.selections.find(row=>row.entry.kind==='spell'&&row.entry.english==='Authored second spell')!;
 expect(performSpellAction(c,spellActionRequest(c,next.id,'source','authored-new-choice-use')).status).toBe('applied');
 const draft=structuredClone(workspace),put=IDBObjectStore.prototype.put;let aborts=0;
 const injected=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value:unknown,key?:IDBValidKey){
  if(this.name==='documents'&&key==='workspace'){
   aborts++;if(failure==='transaction-abort'){const request=put.call(this,value,key);this.transaction.abort();return request;}
   this.transaction.abort();throw new DOMException('Authored atomic-save failure','QuotaExceededError');
  }
  return put.call(this,value,key);
 });
 await expect(saveWorkspace(workspace)).rejects.toThrow(failure==='request-error'?'Authored atomic-save failure':'aborted');injected.mockRestore();expect(aborts).toBe(1);
 expect(await loadWorkspace(true)).toEqual(committed);expect(await restoreBackup()).toEqual(first);expect(workspace).toEqual(draft);
 expect((await loadWorkspace())!.characters[0].automation!.spellChoices![key]).toEqual(['Authored first spell|PHB']);
 await saveWorkspace(workspace);expect(await loadWorkspace(true)).toEqual(draft);expect(await restoreBackup()).toEqual(committed);
 const reopened=readCharacter((await loadWorkspace())!.characters[0]).character;
 expect(reopened.sourceSpellChoiceContexts).toEqual(draft.characters[0].sourceSpellChoiceContexts);expect(reopened.automation!.spellChoices![key]).toEqual(['Authored second spell|PHB']);
 expect(reopened.runtime.resources[specialSpellResource(next.id,reopened)].current).toBe(1);expect(reopened.runtime.resources.manual).toEqual({max:9,current:2});
});
