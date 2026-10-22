import {describe,expect,it,vi} from 'vitest';
import {createSurfaceMotion} from '../src/ui/surfaceMotion';

function fixture(){
 let reduced=false;
 const handles:{cancel:ReturnType<typeof vi.fn>}[]=[];
 const animate=vi.fn(()=>{const handle={cancel:vi.fn()};handles.push(handle);return handle;});
 return {motion:createSurfaceMotion(animate,()=>reduced),animate,handles,reduce:(value:boolean)=>{reduced=value;}};
}
describe('navigation paint and numeric renders have independent lifetimes',()=>{
 it('keeps startup and ordinary value/save renders still',()=>{
  const f=fixture();for(let i=0;i<100;i++)f.motion.update('card-a:main');
  expect(f.animate).not.toHaveBeenCalled();
 });
 it('retains an active page entrance during value updates',()=>{
  const f=fixture();f.motion.update('card-a:main');f.motion.update('card-a:spells');
  for(let i=0;i<100;i++)f.motion.update('card-a:spells');
  expect(f.animate).toHaveBeenCalledTimes(1);expect(f.handles[0].cancel).not.toHaveBeenCalled();
 });
 it('replaces rapid navigation instead of queueing older pages',()=>{
  const f=fixture();f.motion.update('card-a:main');f.motion.update('card-a:spells');f.motion.update('card-a:features');
  expect(f.animate).toHaveBeenCalledTimes(2);expect(f.handles[0].cancel).toHaveBeenCalledTimes(1);
  expect(f.handles[1].cancel).not.toHaveBeenCalled();
  f.motion.cancel();f.motion.cancel();expect(f.handles[1].cancel).toHaveBeenCalledTimes(1);
 });
 it('separates equal page names on different characters',()=>{
  const f=fixture();f.motion.update('card-a:main');f.motion.update('card-b:main');
  expect(f.animate).toHaveBeenCalledTimes(1);
 });
 it('switches scoped cards immediately and cancels the previous page fade',()=>{
  const f=fixture();f.motion.update('main',true,'card-a');f.motion.update('spells',true,'card-a');
  expect(f.animate).toHaveBeenCalledTimes(1);
  f.motion.update('main',true,'card-b');
  expect(f.animate).toHaveBeenCalledTimes(1);expect(f.handles[0].cancel).toHaveBeenCalledTimes(1);
  f.motion.update('features',true,'card-b');expect(f.animate).toHaveBeenCalledTimes(2);
 });
 it('never dims warmed cards during repeated owner switches',()=>{
  const f=fixture();f.motion.update('main',true,'card-a');
  for(let i=0;i<30;i++)f.motion.update('main',true,i%2?'card-a':'card-b');
  expect(f.animate).not.toHaveBeenCalled();
  f.motion.update('spells',true,'card-a');expect(f.animate).toHaveBeenCalledTimes(1);
 });
 it('reduced motion cancels paint and never replays skipped pages',()=>{
  const f=fixture();f.motion.update('main');f.motion.update('spells');f.reduce(true);f.motion.update('features');
  expect(f.handles[0].cancel).toHaveBeenCalledTimes(1);expect(f.animate).toHaveBeenCalledTimes(1);
  f.reduce(false);f.motion.update('features');expect(f.animate).toHaveBeenCalledTimes(1);
  f.motion.update('main');expect(f.animate).toHaveBeenCalledTimes(2);
 });
 it('capture cancels an entrance before sampling and resumes without replay',()=>{
  const f=fixture();f.motion.update('main');f.motion.update('spells');f.motion.update('spells',false);
  expect(f.handles[0].cancel).toHaveBeenCalledTimes(1);
  f.motion.update('features',false);f.motion.update('features',true);
  expect(f.animate).toHaveBeenCalledTimes(1);
 });
 it('unsupported animation leaves navigation usable and cleanup safe',()=>{
  const animate=vi.fn(()=>undefined),motion=createSurfaceMotion(animate,()=>false);
  motion.update('main');motion.update('spells');motion.cancel();motion.update('features');motion.cancel();
  expect(animate).toHaveBeenCalledTimes(2);
 });
});
