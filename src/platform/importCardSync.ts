import type {Character} from '../core/model';
import type {ClassMigrationPlan} from '../core/classMigrationQuery';
import {migrationStillCurrent} from '../core/classMigrationQuery';
import {validateCharacter} from '../core/validation';

/** An unpublished import is synchronized in memory and saved only once. */
export function synchronizedImport(original: Character, reviewed: Character, plan: ClassMigrationPlan): Character {
  if (!migrationStillCurrent(plan, reviewed) || original.id !== reviewed.id) throw Error('导入资料已变化，请重新核对同步结果');
  const result = structuredClone(plan.card);
  result.id = original.id; result.name = original.name; result.createdAt = original.createdAt;
  result.updatedAt = new Date().toISOString(); result.revision = 1;
  return validateCharacter(result);
}
