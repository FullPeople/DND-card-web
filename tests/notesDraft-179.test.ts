import {describe,it,expect} from 'vitest';
import {notesDraftController,type NotesBackup,type NotesDocument} from '../src/core/notesDraft';
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(initial='base'){
 let remote:NotesDocument={revision:1,text:initial},draft:NotesBackup|undefined,reads=0;const writes:{text:string;expected:number}[]=[];
 const options:{read?:()=>Promise<NotesDocument>;write?:(value:{text:string;expected:number})=>Promise<NotesDocument>}={};
 const controller=notesDraftController({read:async()=>{reads++;return options.read?options.read():{...remote};},write:async value=>{writes.push(value);if(options.write)return options.write(value);if(value.expected!==remote.revision)throw Error('CAS conflict');remote={revision:remote.revision+1,text:value.text};return {...remote};}},{read:()=>draft,write:value=>{draft={...value};}},null);
 return {controller,options,writes,get reads(){return reads;},get remote(){return remote;},set remote(value){remote=value;},get draft(){return draft;},set draft(value){draft=value;}};
}
describe('notes draft controller',()=>{
 it('one save chain survives unmount/remount and a late ACK preserves newer editor text',async()=>{
  const f=fixture(),a=deferred<NotesDocument>(),b=deferred<NotesDocument>();await f.controller.load();let calls=0;f.options.write=()=>++calls===1?a.promise:b.promise;
  const off=f.controller.subscribe(()=>{});f.controller.change('A');const saving=f.controller.flush();off();const next=f.controller.subscribe(()=>{});await f.controller.load();f.controller.change('B');expect(f.writes).toHaveLength(1);a.resolve({revision:2,text:'A'});await Promise.resolve();await Promise.resolve();expect(f.draft).toEqual({text:'B',base:'A'});expect(f.controller.getSnapshot().text).toBe('B');b.resolve({revision:3,text:'B'});await saving;expect(f.writes).toEqual([{expected:1,text:'A'},{expected:2,text:'B'}]);expect(f.draft).toEqual({text:'B',base:'B'});next();
 });
 it('readback confirms a committed write whose response was lost without replaying it',async()=>{
  const f=fixture();await f.controller.load();f.options.write=async value=>{f.remote={revision:2,text:value.text};throw Error('lost ACK');};f.controller.change('A');await f.controller.flush();expect(f.writes).toHaveLength(1);expect(f.controller.getSnapshot()).toMatchObject({text:'A',error:'',blocked:false,status:'已保存'});expect(f.draft).toEqual({text:'A',base:'A'});
 });
 it('retry reads first and advances a lost-ACK base before saving newer edits',async()=>{
  const f=fixture();await f.controller.load();f.options.write=async value=>{f.remote={revision:2,text:value.text};throw Error('lost ACK');};f.options.read=async()=>{throw Error('offline');};f.controller.change('A');await f.controller.flush();f.controller.change('B');expect(f.controller.getSnapshot().blocked).toBe(true);f.options.read=undefined;f.options.write=undefined;await f.controller.retry();expect(f.writes).toEqual([{expected:1,text:'A'},{expected:2,text:'B'}]);expect(f.remote.text).toBe('B');expect(f.controller.getSnapshot().error).toBe('');
 });
 it('a real concurrent edit remains a conflict and retry never overwrites it',async()=>{
  const f=fixture();await f.controller.load();f.remote={revision:2,text:'other tab'};f.controller.change('my draft');await f.controller.flush();await f.controller.retry();expect(f.writes).toHaveLength(1);expect(f.remote.text).toBe('other tab');expect(f.controller.getSnapshot()).toMatchObject({text:'my draft',blocked:true});expect(f.draft).toEqual({text:'my draft',base:'base'});
 });
 it('loading remote content replaces a local draft only after a successful read',async()=>{
  const f=fixture();await f.controller.load();f.controller.change('keep this');f.options.read=async()=>{throw Error('offline');};await f.controller.replaceFromRemote();expect(f.controller.getSnapshot().text).toBe('keep this');expect(f.draft).toEqual({text:'keep this',base:'base'});f.options.read=undefined;f.remote={revision:2,text:'remote'};await f.controller.replaceFromRemote();expect(f.controller.getSnapshot()).toMatchObject({text:'remote',error:'',blocked:false});expect(f.draft).toEqual({text:'remote',base:'remote'});
 });
 it('edits made during the remote read are retained',async()=>{
  const f=fixture();await f.controller.load();const read=deferred<NotesDocument>();f.options.read=()=>read.promise;const replacing=f.controller.replaceFromRemote();f.controller.change('typed while reading');read.resolve({revision:2,text:'other text'});await replacing;expect(f.controller.getSnapshot()).toMatchObject({text:'typed while reading',blocked:true});expect(f.draft?.text).toBe('typed while reading');
 });
 it('an initial read failure cannot erase a persisted dirty draft',async()=>{
  const f=fixture();f.draft={text:'recover me',base:'base'};f.options.read=async()=>{throw Error('offline');};await f.controller.load();expect(f.draft).toEqual({text:'recover me',base:'base'});f.options.read=undefined;await f.controller.retry();await f.controller.flush();expect(f.remote.text).toBe('recover me');expect(f.controller.getSnapshot()).toMatchObject({text:'recover me',loaded:true,error:''});
 });
 it('clean reopening refreshes another tab changes but dirty reopening never replaces text',async()=>{
  const f=fixture();await f.controller.load();f.remote={revision:2,text:'new remote'};await f.controller.load();expect(f.controller.getSnapshot().text).toBe('new remote');f.controller.change('local change');f.remote={revision:3,text:'changed again'};await f.controller.load();expect(f.controller.getSnapshot().text).toBe('local change');expect(f.writes).toHaveLength(0);
 });
 it('dirty draft restored over a different remote base stays intact and blocked',async()=>{
  const f=fixture('new remote');f.draft={text:'offline draft',base:'old base'};await f.controller.load();expect(f.controller.getSnapshot()).toMatchObject({text:'offline draft',loaded:true,blocked:true});expect(f.writes).toHaveLength(0);expect(f.draft).toEqual({text:'offline draft',base:'old base'});
 });
});
