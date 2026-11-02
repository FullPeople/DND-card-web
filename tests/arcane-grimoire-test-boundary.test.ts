import assert from 'node:assert/strict';
import {it} from 'vitest';
import {runArcaneGrimoireCheck} from './helpers/arcaneGrimoireTestBoundary';

it('executes every supplied full check exactly once without skips',async()=>{
 const visited:number[]=[];
 for(let i=1;i<=18;i++)await runArcaneGrimoireCheck(i,()=>{visited.push(i);assert.deepEqual({a:[i,{ok:true}]},{a:[i,{ok:true}]});});
 assert.deepEqual(visited,Array.from({length:18},(_,i)=>i+1));
});
it('awaits asynchronous checks rather than reporting an early pass',async()=>{
 let complete=false;await runArcaneGrimoireCheck(1,async()=>{await Promise.resolve();complete=true;});assert.equal(complete,true);
});
it('retains a failing full deep comparison but replaces all error payload fields',async()=>{
 let compared=false;
 await assert.rejects(runArcaneGrimoireCheck(7,()=>{compared=true;assert.deepEqual({entry:{body:'synthetic private A'}},{entry:{body:'synthetic private B'}});}),error=>{
  assert.ok(error instanceof Error);assert.equal(error.message,'ARCANE_GRIMOIRE_CHECK_007_FAILED');
  assert.deepEqual(Reflect.ownKeys(error).sort(),['message','stack']);assert.ok(!String(error.stack).includes('synthetic private'));return true;
 });assert.equal(compared,true);
});
it('does not inspect original errors, accessors, cause or asynchronous rejection payloads',async()=>{
 let reads=0;const opaque=Object.create(null);
 for(const key of ['message','stack','cause','actual','expected'])Object.defineProperty(opaque,key,{get(){reads++;throw Error('must not inspect');}});
 await assert.rejects(runArcaneGrimoireCheck(8,()=>Promise.reject(opaque)),{message:'ARCANE_GRIMOIRE_CHECK_008_FAILED'});assert.equal(reads,0);
});
it('rejects invalid identifiers before invoking a check',async()=>{
 let called=false;await assert.rejects(runArcaneGrimoireCheck(NaN,()=>{called=true;}),{message:'ARCANE_GRIMOIRE_CHECK_INDEX_INVALID'});assert.equal(called,false);
});
