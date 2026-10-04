import {describe,it,expect} from 'vitest';
import {permissionNoticeState} from '../src/platform/playerPermissionNotice';
import {readFileSync} from 'node:fs';

describe('DM permission notice read status',()=>{
 it('opening and unread/invalid status never hide the entry',async()=>{
  const changes:boolean[]=[];let value:unknown={seen:false};const state=permissionNoticeState(async()=>value,v=>changes.push(v));
  await state.refresh();value=undefined;await state.refresh();value={seen:'true'};await state.refresh();expect(changes).toEqual([false,false,false]);
 });
 it('only an explicit true status from the host hides the entry',async()=>{
  const changes:boolean[]=[];const state=permissionNoticeState(async()=>({seen:true}),v=>changes.push(v));await state.refresh();expect(changes).toEqual([true]);
 });
 it('failed status lookup preserves current visibility and allows a later retry',async()=>{
  const changes:boolean[]=[];let fail=true;const state=permissionNoticeState(async()=>{if(fail)throw Error('offline');return {seen:true};},v=>changes.push(v));
  await state.refresh();expect(changes).toEqual([]);fail=false;await state.refresh();expect(changes).toEqual([true]);
 });
 it('a late reply cannot override a newer acknowledgment',async()=>{
  const pending:Array<(value:unknown)=>void>=[],changes:boolean[]=[];const state=permissionNoticeState(()=>new Promise(resolve=>pending.push(resolve)),v=>changes.push(v));
  const first=state.refresh(),second=state.refresh();pending[1]({seen:true});await second;pending[0]({seen:false});await first;expect(changes).toEqual([true]);
 });
 it('role change or unmount retires all pending status replies',async()=>{
  let resolve!:(value:unknown)=>void;const changes:boolean[]=[];const state=permissionNoticeState(()=>new Promise(r=>resolve=r),v=>changes.push(v));const pending=state.refresh();state.dispose();resolve({seen:true});await pending;await state.refresh();expect(changes).toEqual([]);
 });
 it('the real DM toolbar puts the entry directly after Music and keeps explicit labels',()=>{
  const source=readFileSync(new URL('../src/ui/Workbench.tsx',import.meta.url),'utf8');expect(source).toContain('>音乐板</button>}<PlayerPermissionButton');
  const entry=readFileSync(new URL('../src/ui/PlayerPermissionButton.tsx',import.meta.url),'utf8');expect(entry).toContain('关于玩家分配卡和权限');expect(entry).toContain('if(!gm||seen)return null');expect(entry).toContain("statusOnly:true");expect(entry).not.toContain('setItem');
 });
});

describe('permission notice stays in the detached workbench',()=>{
 it('opens the original guide in a local permissions panel instead of an OBR scene modal',()=>{
  const entry=readFileSync(new URL('../src/ui/PlayerPermissionButton.tsx',import.meta.url),'utf8');
  expect(entry).toContain('panel="permissions"');
  expect(entry).not.toContain("request('console',{action:'playerPermissions'})");
  const panel=readFileSync(new URL('../src/ui/WorkbenchPanel.tsx',import.meta.url),'utf8');
  expect(panel).toContain("source.searchParams.set('permissions','1')");
 });
});
