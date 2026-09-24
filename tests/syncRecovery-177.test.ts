import {expect,it} from 'vitest';
import {confirmedChanges} from '../src/core/syncRecovery';
it('does not treat unrelated remote revisions as confirmation of lost status/resource changes',()=>{
 const before={revision:1,runtime:{hp:5,resources:{r:{current:2}}},selections:[{id:'status',entry:{name:'束缚'}}]};
 const after={revision:2,runtime:{hp:5,resources:{r:{current:0}}},selections:[]};
 expect(confirmedChanges(before,after,{...before,revision:100})).toBe(false);
 expect(confirmedChanges(before,after,{...after,revision:101,runtime:{hp:8,resources:{r:{current:0}}},selections:[{id:'other',entry:{name:'新状态'}}]})).toBe(true);
});
it('retains every queued intention until each changed field is present remotely',()=>{
 const before={runtime:{hp:5,tempHp:0}},after={runtime:{hp:8,tempHp:4}};
 expect(confirmedChanges(before,after,{runtime:{hp:8,tempHp:0}})).toBe(false);
 expect(confirmedChanges(before,after,{runtime:{hp:8,tempHp:4}})).toBe(true);
});
