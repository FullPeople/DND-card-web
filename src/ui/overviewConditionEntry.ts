import type {Entry} from '../core/model';

export type OverviewCondition={id:string;name:string;entry?:Entry;level?:number};
export function overviewConditionEntry(condition:OverviewCondition):Entry{
 return condition.entry||{id:`overview-condition:${condition.id}`,name:condition.name,english:condition.id,kind:'condition',source:'IMPORTED',packId:'imported',edition:'both',revision:'1',entries:[],raw:{_suiteStatusId:condition.id}};
}
