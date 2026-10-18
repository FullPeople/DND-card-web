import {afterEach,describe,expect,it,vi} from 'vitest';
import {localRoll} from '../src/standalone/localRoll';
import {createRollPresentation,ROLL_REVEAL_MS} from '../src/standalone/rollPresentation';
afterEach(()=>vi.useRealTimers());
describe('real local dice outcomes',()=>{
 it('keeps each die, sign and modifier in the displayed total',()=>{
  const values=[6,2,3],face=vi.fn(()=>values.shift()!);
  expect(localRoll(' 2D6 - d4 + 5 ',face)).toEqual({formula:'2d6-d4+5',modifier:5,total:10,groups:[{sign:1,sides:6,values:[6,2]},{sign:-1,sides:4,values:[3]}]});
  expect(face.mock.calls).toHaveLength(3);
 });
 it('validates all terms and total count before generating any outcome',()=>{
  for(const expression of ['1d6+bad','60d6+41d4','d0','d10001','0d6','1d6+9007199254740991+1-9007199254740991']){const face=vi.fn(()=>1);expect(()=>localRoll(expression,face)).toThrow();expect(face).not.toHaveBeenCalled();}
 });
 it('supports the boundary and constants without phantom dice',()=>{
  expect(localRoll('100d1-4',()=>1).total).toBe(96);expect(localRoll('-5+2',()=>{throw Error('unexpected die');})).toMatchObject({total:-3,groups:[]});
 });
 it('rejects invalid random-provider results',()=>{
  for(const result of [0,7,NaN,1.5])expect(()=>localRoll('d6',()=>result)).toThrow('骰子结果无效');
 });
});
function fixture(){
 vi.useFakeTimers();let reduced=false;
 const rolling=vi.fn(),reveal=vi.fn(),error=vi.fn();
 return {rolling,reveal,error,reduce:()=>{reduced=true;},presentation:createRollPresentation({rolling,reveal,error,reduced:()=>reduced})};
}
describe('roll presentation is not a second roll',()=>{
 it('generates once and never exposes the outcome before reveal',()=>{
  const f=fixture(),generate=vi.fn(()=>17);f.presentation.start(generate);f.presentation.start(generate);
  expect(generate).toHaveBeenCalledTimes(1);expect(f.rolling).toHaveBeenCalledTimes(1);expect(f.reveal).not.toHaveBeenCalled();
  vi.advanceTimersByTime(ROLL_REVEAL_MS-1);expect(f.reveal).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(f.reveal).toHaveBeenCalledWith(17);
 });
 it('closing or switching suppresses a stale reveal',()=>{
  const f=fixture();f.presentation.start(()=>17);f.presentation.cancel();f.presentation.start(()=>3);vi.runAllTimers();
  expect(f.reveal.mock.calls).toEqual([[3]]);
 });
 it('reduced motion reveals immediately without an extra random sample',()=>{
  const f=fixture(),generate=vi.fn(()=>11);f.reduce();f.presentation.start(generate);vi.runAllTimers();expect(generate).toHaveBeenCalledTimes(1);expect(f.reveal.mock.calls).toEqual([[11]]);
 });
 it('changing motion preference flushes the held outcome once',()=>{
  const f=fixture();f.presentation.start(()=>12);f.reduce();f.presentation.reveal();vi.runAllTimers();expect(f.reveal.mock.calls).toEqual([[12]]);
 });
 it('invalid expressions never enter the rolling state',()=>{
  const f=fixture();f.presentation.start(()=>{throw Error('invalid');});vi.runAllTimers();expect(f.error).toHaveBeenCalledWith('invalid');expect(f.rolling).not.toHaveBeenCalled();expect(f.reveal).not.toHaveBeenCalled();f.presentation.start(()=>5);vi.runAllTimers();expect(f.reveal).toHaveBeenCalledWith(5);
 });
});
