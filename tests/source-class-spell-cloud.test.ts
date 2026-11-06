import {afterEach,expect,it} from 'vitest';
import {CloudStore} from '../server/cloud/store';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {planSourceSpells,setSourceSpellChoices,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {performSpellAction,spellActionRequest} from '../src/core/automation/actions';
import {specialSpellResource} from '../src/core/specialSpells';
import {readCharacter} from '../src/core/validation';

const stores:CloudStore[]=[];
afterEach(()=>{for(const store of stores.splice(0))store.close();});
function setup(){
 const store=new CloudStore(':memory:');stores.push(store);
 const owner=store.provisionVerifiedAccount('authored-class-owner'),editor=store.provisionVerifiedAccount('authored-class-editor'),stranger=store.provisionVerifiedAccount('authored-class-stranger');
 const make=(kind:Entry['kind'],name:string,raw:Entry['raw']):Entry=>({id:'authored-cloud-query:'+kind+':'+name,kind,name,english:name,source:'PHB',edition:'2014',packId:'authored-cloud-query',revision:'1',entries:[],raw});
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.runtime.resources.manual={max:9,current:2};
 c.selections=[{id:'authored-cloud-query-owner',quantity:1,level:3,equipped:false,entry:make('feat','Authored daily class gift',{additionalSpells:[{ability:'wis',innate:{'_':{daily:{'1e':[{choose:'level=0|class=Wizard',count:1}]}}}}]})}];
 const catalog=[make('class','Wizard',{}),make('spell','Authored cloud cantrip',{level:0,classes:{fromClassList:[{name:'Wizard',source:'PHB'}]}})],choice=planSourceSpells(c,catalog).choices.find(row=>row.spells)!;
 setSourceSpellChoices(c,choice.key,['Authored cloud cantrip|PHB'],catalog);syncSourceSpells(c,catalog);const row=c.selections.find(row=>row.entry.kind==='spell')!,resource=specialSpellResource(row.id,c);
 expect(performSpellAction(c,spellActionRequest(c,row.id,'source','authored-before-cloud')).status).toBe('applied');expect(c.runtime.resources[resource].current).toBe(0);
 return {store,owner,editor,stranger,c,key:choice.key,resource};
}
it('stores the class query snapshot and spent uses together through authorized SQLite cloud updates',()=>{
 const {store,owner,editor,stranger,c,key,resource}=setup(),created=store.create(owner,c);store.grantAccount(created.id,owner,editor.id);
 const remote=readCharacter(store.read(created.id,editor).character).character;expect(remote.sourceSpellChoiceContexts).toEqual(c.sourceSpellChoiceContexts);expect(remote.runtime.resources[resource].current).toBe(0);expect(remote.automation!.spellChoices![key]).toEqual(['Authored cloud cantrip|PHB']);expect(remote.selections.some(row=>row.entry.kind==='class')).toBe(false);
 remote.abilities.str=14;remote.revision++;const updated=store.update(created.id,editor,created.revision,remote),reopened=readCharacter(store.read(created.id,owner).character).character;
 expect(updated.revision).toBe(2);expect(reopened.sourceSpellChoiceContexts).toEqual(c.sourceSpellChoiceContexts);expect(reopened.runtime.resources[resource].current).toBe(0);expect(reopened.runtime.resources.manual).toEqual({max:9,current:2});expect(reopened.abilities.str).toBe(14);
 expect(()=>store.read(created.id,stranger)).toThrow('没有找到');store.grantAccount(created.id,owner,editor.id,true);expect(()=>store.read(created.id,editor)).toThrow('没有找到');
 const before=store.read(created.id,owner);expect(()=>store.update(created.id,editor,before.revision,remote)).toThrow('撤销');expect(store.read(created.id,owner)).toEqual(before);
});
it('rejects a damaged query snapshot before changing the cloud revision, source choices or spent counters',()=>{
 const {store,owner,c,resource}=setup(),created=store.create(owner,c),before=store.read(created.id,owner),bad=structuredClone(before.character);
 Object.values(bad.sourceSpellChoiceContexts!.records!)[0].entries[0].raw.classSpells=['Authored injected cloud spell|PHB'];bad.runtime.resources[resource].current=1;const draft=structuredClone(bad);
 expect(()=>store.update(created.id,owner,created.revision,bad)).toThrow('法表来源记录');expect(store.read(created.id,owner)).toEqual(before);expect(bad).toEqual(draft);
});
it('keeps the winning cloud context and the losing local draft on a revision conflict',()=>{
 const {store,owner,editor,c}=setup(),created=store.create(owner,c);store.grantAccount(created.id,owner,editor.id);
 const winning={...structuredClone(c),name:'Authored winning cloud card'},saved=store.update(created.id,owner,created.revision,winning),draft={...structuredClone(c),name:'Authored losing local draft'},before=structuredClone(draft);
 expect(()=>store.update(created.id,editor,created.revision,draft)).toThrow('草稿保留');expect(store.read(created.id,owner)).toEqual(saved);expect(draft).toEqual(before);expect(saved.character.sourceSpellChoiceContexts).toEqual(c.sourceSpellChoiceContexts);
});
