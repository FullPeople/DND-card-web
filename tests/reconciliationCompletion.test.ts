import {expect,it,vi} from 'vitest';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {standaloneCardViews} from '../src/platform/standaloneCardViews';
import {snapshotMemo} from '../src/platform/snapshotMemo';
import {syncFeatures} from '../src/core/sheet';
import {syncAutoResources} from '../src/core/resources';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
it('a completed edit does not replay source reconciliation, but a new rule context and unknown snapshots still do',()=>{
 const c=newCharacter();c.automation=newAutomationState();c.runtime.resources.manual={name:'Authored',max:9,current:2};const views=standaloneCardViews([],undefined,[],snapshotMemo());syncFeatures(c,[]);syncAutoResources(c);syncSourceSpells(c,[]);
 expect(typeof (views as any).acceptReconciled).toBe('function');(views as any).acceptReconciled(c);const sync=vi.fn(syncSourceSpells);views.warmReconciliation(c,sync);expect(sync).not.toHaveBeenCalled();expect(c.runtime.resources.manual.current).toBe(2);
 const unknown=structuredClone(c);views.warmReconciliation(unknown,sync);expect(sync).toHaveBeenCalledTimes(1);const next=standaloneCardViews([],undefined,[],snapshotMemo());next.warmReconciliation(c,sync);expect(sync).toHaveBeenCalledTimes(2);
});
