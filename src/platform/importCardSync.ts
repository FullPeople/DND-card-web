import type {Character,Entry} from '../core/model';
import {ignoreUnfilledSheetChoices} from '../core/automation/choices';
import type {ClassMigrationPlan} from '../core/classMigrationQuery';
import {migrationStillCurrent} from '../core/classMigrationQuery';
import {validateCharacter} from '../core/validation';

/** An unpublished import is synchronized in memory and saved only once. */
export function synchronizedImport(original: Character, reviewed: Character, plan: ClassMigrationPlan, catalog:Entry[]=[]): Character {
  if (!migrationStillCurrent(plan, reviewed) || original.id !== reviewed.id) throw Error('导入资料已变化，请重新核对同步结果');
  const result = structuredClone(plan.card);
  result.id = original.id; result.name = original.name; result.createdAt = original.createdAt;
  result.updatedAt = new Date().toISOString(); result.revision = 1;
  ignoreUnfilledSheetChoices(result,catalog);
  return validateCharacter(result);
}
