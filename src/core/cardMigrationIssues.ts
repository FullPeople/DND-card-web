import type {Character,Entry,Selection} from './model';
import {classCompatibilityIssues} from './classMigration';
/** Read-only badge queries must not import the migration transaction engine. */
export function cardMigrationIssues(c:Character,entries:Entry[]):Selection[]{return classCompatibilityIssues(c,entries).map(issue=>issue.row);}
