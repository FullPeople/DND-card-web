import {it} from 'vitest';
import {arcaneGrimoireChecks} from './helpers/arcaneGrimoireChecks';
import {runArcaneGrimoireCheck} from './helpers/arcaneGrimoireTestBoundary';
for(const [index,check] of arcaneGrimoireChecks.entries())it(check.name,()=>runArcaneGrimoireCheck(index+1,check.run));
