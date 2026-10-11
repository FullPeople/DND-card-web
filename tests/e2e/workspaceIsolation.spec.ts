import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

const protocol='full-suite-workbench/v1';
async function hostPage(host:Page){
 await mockSource(host);await suppressAnnouncement(host);
 await host.route('**/workspace-isolation-host',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Workspace isolation fixture</title>'}));
 await host.goto('/workspace-isolation-host');
 await host.evaluate(protocol=>window.addEventListener('message',event=>{
  const m=event.data;if(m?.protocol!==protocol||!m.session)return;
  if(m.type==='hello'||m.type==='ping')(event.source as Window).postMessage({protocol,session:m.session,hostStarted:1,type:m.type==='hello'?'ready':'pong'},location.origin);
 }),protocol);
}
async function viewer(host:Page,session:string){
 const opened=host.context().waitForEvent('page');
 await host.evaluate(session=>window.open('/#suite='+encodeURIComponent(session)+'&bridge='+encodeURIComponent(location.origin)),session);
 const page=await opened;await mockSource(page);await expect(page.locator('.app-shell')).toBeVisible();return page;
}
const locks=(host:Page)=>host.evaluate(async()=>navigator.locks.query());
test('distinct host workspaces own independent real browser locks and character databases',async({page:host})=>{
 await hostPage(host);const a=await viewer(host,'isolated-a'),b=await viewer(host,'isolated-b');
 await expect.poll(async()=>(await locks(host)).held?.map(lock=>lock.name).sort()).toEqual(['dnd-card-workbench-editor:isolated-a','dnd-card-workbench-editor:isolated-b']);
 expect((await locks(host)).pending).toHaveLength(0);
 await expect.poll(()=>host.evaluate(async()=>(await indexedDB.databases()).map(db=>db.name))).toEqual(expect.arrayContaining(['dnd-card-workbench:isolated-a','dnd-card-workbench:isolated-b']));
 await a.close();await b.close();
});
test('the second view of one workspace waits and takes over after the holder closes',async({page:host})=>{
 await hostPage(host);const a=await viewer(host,'same-workspace'),b=await viewer(host,'same-workspace');
 await expect.poll(async()=>{const state=await locks(host);return {held:state.held?.map(lock=>lock.name),pending:state.pending?.map(lock=>lock.name)};}).toEqual({held:['dnd-card-workbench-editor:same-workspace'],pending:['dnd-card-workbench-editor:same-workspace']});
 await a.close();await expect.poll(async()=>(await locks(host)).pending?.length).toBe(0);
 expect((await locks(host)).held?.map(lock=>lock.name)).toEqual(['dnd-card-workbench-editor:same-workspace']);await b.close();
});
test('a host workspace has its own lock beside the ordinary editor',async({page:host})=>{
 await hostPage(host);const standalone=await host.context().newPage();await mockSource(standalone);await standalone.goto('/?intro=0');await expect(standalone.locator('.paper')).toBeVisible();
 const workbench=await viewer(host,'beside-standalone');
 await expect.poll(async()=>(await locks(host)).held?.map(lock=>lock.name).sort()).toEqual(['dnd-card-editor','dnd-card-workbench-editor:beside-standalone']);
 expect((await locks(host)).pending).toHaveLength(0);await workbench.close();await standalone.close();
});
