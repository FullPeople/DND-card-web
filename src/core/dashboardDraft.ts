import type {Character} from './model';
import {applyPatch,sameValue} from './merge';
import {dashboardOverlaps,freeDashboardLayout,resourceCanvasRows,resourceModules,migrateDashboardWidgets} from './resourceWidgets';
import {validateCharacter} from './validation';

/** A detached editing snapshot. Missing geometry is materialized once without
 * spending resources, choosing random appearances or repacking neighbours. */
export function createDashboardDraft(character:Character):Character{
 const draft=structuredClone(character),layout=draft.quickbarLayout||={order:[],hidden:[]};
 const visible=freeDashboardLayout(resourceModules(resourceCanvasRows(draft),layout.widgets,draft.selections),layout.widgets,layout.attacks);
 layout.widgets={...migrateDashboardWidgets(layout.widgets,layout.attacks),...visible.widgets};layout.attacks=visible.attacks;
 return draft;
}

/** Merge only changed fields against their opening snapshot. Remote counters and
 * unrelated character edits survive; conflicting edits and collisions fail
 * before a caller receives any replacement character. */
export function commitDashboardDraft(live:Character,base:Character,draft:Character,options:{gm?:boolean}={}):Character{
 if(live.id!==base.id||draft.id!==base.id)throw Error('角色已切换，请重新打开仪表盘');
 validateCharacter(draft);
 for(const id of new Set([...Object.keys(base.runtime.resources),...Object.keys(draft.runtime.resources)])){
  const before=base.runtime.resources[id],after=draft.runtime.resources[id],current=live.runtime.resources[id];
  if(sameValue(before,after))continue;
  if(!after&&(before?.automatic||current?.automatic))throw Error('自动资源不能在仪表盘中删除');
  if(!options.gm&&(current?.locked||after&&!!before?.locked!==!!after.locked))throw Error('资源已锁定，请由房主调整');
 }
 // Compare equally hydrated snapshots: merely opening a legacy card must not
 // overwrite a layout another client saved while the editor was open.
 const previous=createDashboardDraft(base),remote=createDashboardDraft(live);
 const merged:Character=applyPatch(remote,previous,draft);
 merged.revision=live.revision;merged.updatedAt=live.updatedAt;
 const result=validateCharacter(merged),layout=result.quickbarLayout!;
 const visible=freeDashboardLayout(resourceModules(resourceCanvasRows(result),layout.widgets,result.selections),layout.widgets,layout.attacks);
 if(dashboardOverlaps(visible).count)throw Error('模块有重叠，请调整位置后再保存');
 layout.widgets={...layout.widgets,...visible.widgets};layout.attacks=visible.attacks;
 return result;
}
