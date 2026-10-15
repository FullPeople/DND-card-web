import {describe,it,expect} from 'vitest';
import {advanceFailedChanges,settleFailedChanges} from '../src/core/failedChanges';

const card=(revision=1,name='A',player='')=>({revision,name,player,runtime:{hp:10}});
describe('failed draft intent and request confirmation have separate lifetimes',()=>{
 it('a later successful replacement retires the obsolete failed value',()=>{
  const before=card(),failed=advanceFailedChanges(undefined,before,card(2,'B'));
  const replaced=advanceFailedChanges(failed,failed.after,card(3,'C'));
  expect(settleFailedChanges(replaced,card(4,'C'))).toBeUndefined();
 });
 it('an unrelated success and a partial replacement retain the remaining failed field',()=>{
  const before=card(),failed=advanceFailedChanges(undefined,before,card(2,'B','failed'));
  const replaced=advanceFailedChanges(failed,failed.after,card(3,'C','failed'));
  const remaining=settleFailedChanges(replaced,card(4,'C'))!;
  expect(remaining.after.player).toBe('failed');expect(remaining.before.name).toBe('C');expect(remaining.before.player).toBe('');
  // A peer may change an already-confirmed field while our other draft is pending.
  expect(settleFailedChanges(remaining,{...card(5,'peer','failed'),runtime:{hp:7}})).toBeUndefined();
 });
 it('a late first receipt does not retire a newer draft blocked behind an unknown request',()=>{
  const before=card(),first=card(2,'B'),blocked=card(3,'B','not sent');
  const failed=advanceFailedChanges(advanceFailedChanges(undefined,before,first),first,blocked);
  const remaining=settleFailedChanges(failed,card(4,'B'))!;
  expect(remaining.after).toBe(blocked);expect(remaining.before.name).toBe('B');expect(remaining.before.player).toBe('');
  expect(advanceFailedChanges(remaining,before,first).after).toBe(blocked);
 });
 it('uses matching fields rather than a newer revision as evidence',()=>{
  const failed=advanceFailedChanges(undefined,card(),card(2,'B'));
  expect(settleFailedChanges(failed,card(999,'peer'))).toEqual(failed);
 });
 it('retires confirmed ID-array edits and removals without losing another row draft',()=>{
  const before={revision:1,rows:[{id:'one',name:'A'},{id:'two',name:'B'},{id:'remove',name:'R'}]},after={revision:2,rows:[{id:'one',name:'changed'},{id:'two',name:'pending'}]};
  const remaining=settleFailedChanges({before,after},{revision:3,rows:[{id:'one',name:'changed'},{id:'two',name:'B'}]})!;
  expect(remaining.before.rows).toEqual([{id:'one',name:'changed'},{id:'two',name:'B'}]);
  expect(settleFailedChanges(remaining,{revision:4,rows:[{id:'one',name:'peer later'},{id:'two',name:'pending'}]})).toBeUndefined();
  expect(before.rows[0].name).toBe('A');expect(after.rows[1].name).toBe('pending');
 });
});
