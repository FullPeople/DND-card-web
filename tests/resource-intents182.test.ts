import {beforeEach,describe,expect,it,vi} from 'vitest';

const harness=vi.hoisted(()=>({card:null as any,requests:[] as any[],actions:[] as any[]}));
vi.mock('../src/platform/workbench',()=>({
 getWorkbench:()=>({cards:[harness.card],monsters:[]}),
 workbenchRequest:vi.fn((_type:string,payload:any)=>new Promise((resolve,reject)=>harness.requests.push({payload,resolve,reject}))),
}));
vi.mock('../src/platform/actionHistory',()=>({recordAction:(action:any)=>harness.actions.push(action)}));

function acknowledge(index:number){
 const request=harness.requests[index],{resourceId,resource}=request.payload;
 harness.card={...harness.card,resources:harness.card.resources.filter((row:any)=>row.id!==resourceId)};
 if(resource)harness.card.resources.push(structuredClone(resource));
 request.resolve({snapshot:{state:{resources:structuredClone(harness.card.resources)}}});
}
beforeEach(()=>{
 vi.resetModules();harness.requests=[];harness.actions=[];
 harness.card={id:'hero',itemId:'token',kind:'character',resources:[{id:'rage',name:'怒气',current:2,max:4,type:'count',locked:false}]};
});
describe('resource field intents survive acknowledgement races',()=>{
 it('retains A -> B -> A and a third edit while the first write is unconfirmed',async()=>{
  const {patchResource}=await import('../src/platform/resources'),card=harness.card;
  const first=patchResource(card,'rage',{current:1}),second=patchResource(card,'rage',{current:2}),third=patchResource(card,'rage',{current:0});
  await vi.waitFor(()=>expect(harness.requests).toHaveLength(1));expect(harness.requests[0].payload.resource.current).toBe(1);
  acknowledge(0);await vi.waitFor(()=>expect(harness.requests).toHaveLength(2));
  expect(harness.requests[1].payload.expected.current).toBe(1);expect(harness.requests[1].payload.resource.current).toBe(2);
  acknowledge(1);await vi.waitFor(()=>expect(harness.requests).toHaveLength(3));
  expect(harness.requests[2].payload.expected.current).toBe(2);expect(harness.requests[2].payload.resource.current).toBe(0);
  acknowledge(2);await Promise.all([first,second,third]);expect(harness.card.resources[0].current).toBe(0);expect(harness.actions).toHaveLength(3);
 });
 it('preserves unrelated remote resource settings when a queued counter executes',async()=>{
  const {patchResource}=await import('../src/platform/resources'),card=harness.card;
  const first=patchResource(card,'rage',{current:1}),second=patchResource(card,'rage',{current:2});
  await vi.waitFor(()=>expect(harness.requests).toHaveLength(1));acknowledge(0);
  harness.card={...harness.card,resources:[{...harness.card.resources[0],name:'远端改名',max:8,icon:'star'}]};
  await vi.waitFor(()=>expect(harness.requests).toHaveLength(2));
  expect(harness.requests[1].payload.resource).toMatchObject({current:2,name:'远端改名',max:8,icon:'star'});
  acknowledge(1);await Promise.all([first,second]);
 });
 it('locks and unlocks remain separate intents and undo keeps a strict expected value',async()=>{
  const {patchResource}=await import('../src/platform/resources'),card=harness.card;
  const lock=patchResource(card,'rage',{locked:true}),unlock=patchResource(card,'rage',{locked:false});
  await vi.waitFor(()=>expect(harness.requests).toHaveLength(1));acknowledge(0);
  await vi.waitFor(()=>expect(harness.requests).toHaveLength(2));expect(harness.requests[1].payload.resource.locked).toBe(false);
  acknowledge(1);await Promise.all([lock,unlock]);
  const undo=harness.actions[1].undo();await vi.waitFor(()=>expect(harness.requests).toHaveLength(3));
  expect(harness.requests[2].payload.expected.locked).toBe(false);expect(harness.requests[2].payload.resource.locked).toBe(true);
  acknowledge(2);await undo;
 });
 it('does not recreate a resource deleted remotely while a later edit is queued',async()=>{
  const {patchResource}=await import('../src/platform/resources'),card=harness.card;
  const first=patchResource(card,'rage',{current:1}),second=patchResource(card,'rage',{current:2});
  const rejected=expect(second).rejects.toThrow('已被移除');
  await vi.waitFor(()=>expect(harness.requests).toHaveLength(1));acknowledge(0);harness.card={...harness.card,resources:[]};
  await first;await rejected;expect(harness.requests).toHaveLength(1);
 });
});
