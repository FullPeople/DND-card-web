import {expect,it,vi} from 'vitest';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {standaloneCardViews} from '../src/platform/standaloneCardViews';
import {settledSnapshotCheck} from '../src/platform/settledSnapshotCheck';
import {snapshotMemo} from '../src/platform/snapshotMemo';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {displayBiographyEdit,applyDisplayCharacterEdit} from '../src/core/displayCharacterEdit';
import {runtimeCharacterBase} from '../src/core/runtimeCharacterEdit';
const card=()=>{const c=newCharacter();c.automation=newAutomationState();c.runtime.resources.manual={name:'Authored reserve',max:9,current:2};return c;};
it('a completed transaction settles the SAME checker used by the actual active-card effect and background preparation',()=>{
 const c=card(),check=settledSnapshotCheck(true),views=standaloneCardViews([],undefined,[],snapshotMemo(),check),activeEffect=vi.fn(()=>false),sync=vi.fn(syncSourceSpells);
 views.acceptReconciled(c);expect(check(c,activeEffect)).toBe(false);expect(activeEffect).not.toHaveBeenCalled();expect(views.reconcile(c,sync)).toBeUndefined();views.warmReconciliation(c,sync);expect(sync).not.toHaveBeenCalled();
 const text=applyDisplayCharacterEdit(c,displayBiographyEdit('story','Authored new story'))!;check(runtimeCharacterBase(text),activeEffect);expect(activeEffect).not.toHaveBeenCalled();expect(text.runtime.resources.manual.current).toBe(2);
});
it('warming a legacy view that still changes is not a committed transaction and cannot suppress the active check',()=>{
 const c=card(),check=settledSnapshotCheck(true),views=standaloneCardViews([],undefined,[],snapshotMemo(),check),sync=vi.fn(()=>true);views.warmReconciliation(c,sync);expect(sync).toHaveBeenCalledTimes(1);expect(views.reconcile(c,sync)).toBeDefined();expect(sync).toHaveBeenCalledTimes(2);expect(c.runtime.resources.manual.current).toBe(2);
});
it('a remote snapshot or a new source context still performs its own complete check',()=>{
 const c=card(),check=settledSnapshotCheck(true),views=standaloneCardViews([],undefined,[],snapshotMemo(),check);views.acceptReconciled(c);const sync=vi.fn(syncSourceSpells);views.reconcile(structuredClone(c),sync);expect(sync).toHaveBeenCalledTimes(1);standaloneCardViews([],undefined,[],snapshotMemo(),settledSnapshotCheck(true)).reconcile(c,sync);expect(sync).toHaveBeenCalledTimes(2);
});
