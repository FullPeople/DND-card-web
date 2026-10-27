import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {applyPatch} from '../src/core/merge';
import {itemChargeFixture,itemChargeSnapshot} from './helpers/itemChargeDebitFixture';
import {itemChargeOffers,itemChargeRequest,performItemChargeAction} from '../src/core/automation/itemChargeDebits';

function spentItem(){const f=itemChargeFixture();f.owner.equipped=true;const offer=itemChargeOffers(f.c)[0];expect(performItemChargeAction(f.c,itemChargeRequest(f.c,offer.ownerId,'history-acquire',{kind:'acquire',knownRemaining:2,confirmedGenuineItem:true,confirmedKnownBalance:true})).status).toBe('applied');const before=structuredClone(f.c),current=itemChargeOffers(f.c)[0];expect(performItemChargeAction(f.c,itemChargeRequest(f.c,offer.ownerId,'history-debit',{kind:'debit',actionKey:current.actionKey!})).status).toBe('applied');return{...f,key:offer.key,before,after:structuredClone(f.c)};}

it('the actual App restore seam must guard a real-source locked debit Undo before persistence, without changing three-way merge',()=>{
 const f=spentItem();f.c.runtime.resources[f.key].locked=true;
 const candidate=applyPatch(f.c,f.after,f.before);expect(candidate.runtime.resources[f.key].current).toBe(2);expect(f.c.runtime.resources[f.key].current).toBe(1);
 const app=readFileSync('src/ui/App.tsx','utf8'),restore=app.slice(app.indexOf('const restore=async(from:Character'),app.indexOf('recordAction({label:after.name'));
 expect(restore).toContain('applyCharacterHistoryPatch(');
 expect(restore.indexOf('applyCharacterHistoryPatch(')).toBeLessThan(restore.indexOf('persist('));
});

import {applyCharacterHistoryPatch} from '../src/ui/characterHistoryPatch';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {syncAutoResources} from '../src/core/resources';
import {removeSelection} from '../src/core/sheet';
import type {SpellActionAuthority} from '../src/core/automation/spellActionAuthority';

// This executes the exact patch/guard seam called by App, not a mounted App.
// The unchanged App revision stamp is separately bound below; DOM remains a CI gate.
it('authorized real-item debit Undo and Redo preserve unrelated later manual edits and native state; old requests become stale after the App revision stamp',()=>{
 const f=spentItem(),stale=itemChargeRequest(f.c,f.owner.id,'pre-travel-request',{kind:'debit',actionKey:itemChargeOffers(f.c)[0].actionKey!});
 f.c.notes='Authored later independent note';f.c.runtime.hp=3;f.c.runtime.resources.manual.current=1;
 const liveBefore=itemChargeSnapshot(f.c),undo=applyCharacterHistoryPatch(f.c,f.after,f.before,()=>({canEdit:true,gm:false}));
 expect(itemChargeSnapshot(f.c)).toBe(liveBefore);expect(undo.runtime.resources[f.key].current).toBe(2);expect(undo.runtime.itemChargeDebits).toEqual(f.before.runtime.itemChargeDebits);expect(undo.notes).toBe(f.c.notes);expect(undo.runtime.hp).toBe(3);expect(undo.runtime.resources.manual.current).toBe(1);
 const app=readFileSync('src/ui/App.tsx','utf8');expect(app).toContain('restored.revision=live.revision+1;');undo.revision=f.c.revision+1;
 const reopened=readCharacter(exportCharacter(undo)).character;syncAutoResources(reopened);expect(reopened.runtime.resources[f.key].current).toBe(2);const unchanged=itemChargeSnapshot(reopened);expect(performItemChargeAction(reopened,stale).status).toBe('rejected');expect(itemChargeSnapshot(reopened)).toBe(unchanged);
 const redo=applyCharacterHistoryPatch(reopened,f.before,f.after,()=>({canEdit:true,gm:false}));expect(redo.runtime.resources[f.key].current).toBe(1);expect(redo.runtime.itemChargeDebits).toEqual(f.after.runtime.itemChargeDebits);expect(redo.notes).toBe(f.c.notes);expect(redo.runtime.hp).toBe(3);expect(redo.runtime.resources.manual.current).toBe(1);
});

it('intentional source-association Undo and Redo may restore and revoke the same matched history without re-acquisition or unrelated writes',()=>{
 const f=spentItem(),beforeRemoval=structuredClone(f.c);removeSelection(f.c,f.owner.id);const removed=structuredClone(f.c);expect(removed.runtime.itemChargeDebits!.records[0].withdrawn).toBe(true);expect(removed.selections.some(row=>row.id===f.owner.id)).toBe(false);
 const restored=applyCharacterHistoryPatch(removed,removed,beforeRemoval,()=>({canEdit:true,gm:false}));expect(restored.selections.some(row=>row.id===f.owner.id)).toBe(true);expect(restored.runtime.itemChargeDebits).toEqual(beforeRemoval.runtime.itemChargeDebits);expect(restored.runtime.resources[f.key].current).toBe(1);expect(restored.runtime.resources.manual).toEqual(beforeRemoval.runtime.resources.manual);
 const redo=applyCharacterHistoryPatch(restored,beforeRemoval,removed,()=>({canEdit:true,gm:false}));expect(redo.selections.some(row=>row.id===f.owner.id)).toBe(false);expect(redo.runtime.itemChargeDebits).toEqual(removed.runtime.itemChargeDebits);expect(redo.runtime.resources[f.key].current).toBe(1);
});

it('a queued history seam reads current authority: GM demotion, readonly and malformed flags reject a locked delta without mutating either card',()=>{
 const f=spentItem();f.c.runtime.resources[f.key].locked=true;let authority:SpellActionAuthority={canEdit:true,gm:true},reads=0;
 const travel=()=>applyCharacterHistoryPatch(f.c,f.after,f.before,()=>{reads++;return authority;});
 const before=itemChargeSnapshot(f.c),target=itemChargeSnapshot(f.before);authority={canEdit:true,gm:false};expect(travel).toThrow();authority={canEdit:false,gm:true};expect(travel).toThrow();authority={canEdit:true,gm:'true'} as unknown as SpellActionAuthority;expect(travel).toThrow();expect(reads).toBe(3);expect(itemChargeSnapshot(f.c)).toBe(before);expect(itemChargeSnapshot(f.before)).toBe(target);
 authority={canEdit:true,gm:true};const allowed=travel();expect(allowed.runtime.resources[f.key].current).toBe(2);expect(allowed.runtime.resources[f.key].locked).toBe(true);expect(itemChargeSnapshot(f.c)).toBe(before);
 const app=readFileSync('src/ui/App.tsx','utf8'),restore=app.slice(app.indexOf('const restore=async(from:Character'),app.indexOf('recordAction({label:after.name'));expect(restore).toContain('()=>{const currentAccess=getWorkbench(),room=qqRoom?roomState():undefined;');expect(restore).toContain('canEdit:writable.current&&!cloudAccessRef.current[live.id]');expect(restore).toContain("gm:inWorkbench?currentAccess.role==='GM':localGm()");
});

it('unrelated ordinary/manual history keeps the original merge behavior and does not acquire a new protected permission rule',()=>{
 const f=itemChargeFixture(),before=structuredClone(f.c);f.c.runtime.hp=5;f.c.runtime.resources.manual.current=1;const after=structuredClone(f.c),expected=applyPatch(f.c,after,before),actual=applyCharacterHistoryPatch(f.c,after,before,()=>({canEdit:false,gm:false}));expect(itemChargeSnapshot(actual)).toBe(itemChargeSnapshot(expected));expect(actual.runtime.hp).toBe(7);expect(actual.runtime.resources.manual.current).toBe(2);expect(actual.runtime.itemChargeDebits).toBeUndefined();expect(actual.runtime.limitedSourceUses).toBeUndefined();
});
