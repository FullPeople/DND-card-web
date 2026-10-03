import {editionAllows,selectionAllowed,classMatches,type Character,type Entry,type Selection} from './model';
import {syncFeatures} from './sheet';
import {syncAutoResources,setResource} from './resources';
import {rememberSourceSpellUses} from './automation/sourceSpellState';
import {syncSourceSpells} from './automation/sourceSpells';
import {evaluate} from './engine';
import {spellState} from './characterDetails';
import {validateCharacter} from './validation';

import {reviewClasses,sameClassSnapshot,migrationFingerprint as stable,type ClassMigrationPlan} from './classMigrationQuery';
export * from './classMigrationQuery';

/** Prepare a reviewable copy. No storage, browser APIs or mutation of the input. */
export function planClassMigration(original:Character,catalog:Entry[],choices:Record<string,string>,identity:{id:string;now:string}):ClassMigrationPlan{
 const card=structuredClone(original),owners=new Set<string>(),changed:string[]=[],warnings:string[]=[];
 for(const row of card.selections.filter(s=>s.entry.kind==='class')){
  const targetId=choices[row.id];if(!targetId)continue;
  const matches=catalog.filter(e=>e.id===targetId&&e.kind==='class'&&editionAllows(e,card.edition));
  if(matches.length!==1)throw Error(`「${row.entry.name}」的目标资料无法唯一确定，请重新选择。`);
  const target=matches[0];if(!selectionAllowed(card,target))throw Error(`「${target.name}」的来源未启用，请先在规则与扩展中调整。`);
  if(sameClassSnapshot(row.entry,target))continue;
  changed.push(`${row.entry.name}（${row.entry.source}） → ${target.name}（${target.source}） · ${row.level} 级`);
  row.entry=structuredClone(target);owners.add(row.id);
 }
 if(!owners.size)throw Error('请选择至少一项需要同步的职业资料。');
 const classIds=card.selections.filter(s=>s.entry.kind==='class').map(s=>`${s.entry.source}|${s.entry.id}`);
 if(new Set(classIds).size!==classIds.length)throw Error('多个职业不能同步为同一份职业资料；请分别核对兼职。');
 for(const row of card.selections.filter(s=>s.entry.kind==='subclass'&&s.parentId&&owners.has(s.parentId))){
  const parent=card.selections.find(s=>s.id===row.parentId)!;
  if(!classMatches(row.entry,parent.entry))warnings.push(`子职「${row.entry.name}」仍保留原记录，与目标职业的关联需手动核对。`);
 }
 rememberSourceSpellUses(card);
 syncFeatures(card,catalog,{owners,refresh:true});
 syncAutoResources(card,original);
 syncSourceSpells(card,catalog);
 // Migration is not a rest or a new grant of expendable resources. Preserve
 // the available count, clamp to a lower maximum, and start new counters at 0.
 for(const [id,resource] of Object.entries(card.runtime.resources))setResource(card,id,resource.unlimited?(original.runtime.resources[id]?.current??0):Math.min(resource.max,original.runtime.resources[id]?.current??0));
 rememberSourceSpellUses(card);
 const oldIds=new Set(original.selections.map(s=>s.id)),newIds=new Set(card.selections.map(s=>s.id));
 const added=card.selections.filter(s=>!oldIds.has(s.id)).map(s=>s.entry.name),removed=original.selections.filter(s=>!newIds.has(s.id)).map(s=>s.entry.name);
 const refreshed=card.selections.filter(s=>!owners.has(s.id)&&oldIds.has(s.id)&&!sameClassSnapshot(s.entry,original.selections.find(old=>old.id===s.id)!.entry)).map(s=>s.entry.name);
 const resources=[...new Set([...Object.keys(original.runtime.resources),...Object.keys(card.runtime.resources)])].flatMap(id=>{
  const before=original.runtime.resources[id],after=card.runtime.resources[id];
  return stable(before)===stable(after)?[]:[`${after?.name||before?.name||id}：${before?`${before.current}/${before.max}`:'无'} → ${after?`${after.current}/${after.max}`:'移除（原卡保留）'}`];
 });
 const beforeStats=evaluate(original),afterStats=evaluate(card);
 const stats=([['等级',beforeStats.level,afterStats.level],['生命值上限',beforeStats.maxHp,afterStats.maxHp],['护甲等级',beforeStats.ac,afterStats.ac],['熟练加值',beforeStats.proficiency,afterStats.proficiency],['预备法术上限',spellState(original).capacity,spellState(card).capacity]] as const).filter(([,a,b])=>a!==b).map(([label,a,b])=>`${label}：${a} → ${b}`);
 const retained=reviewClasses(card,catalog).filter(row=>row.status!=='current');
 if(retained.length)warnings.push(`仍保留 ${retained.length} 个未同步或自定义职业；这些内容继续按原记录使用。`);
 card.id=identity.id;card.name=`${original.name}（职业同步副本）`;card.revision=1;card.createdAt=card.updatedAt=identity.now;
 validateCharacter(card);
 return {card,originalId:original.id,originalRevision:original.revision,originalFingerprint:stable(original),changed,added,removed,refreshed,resources,stats,warnings};
}
