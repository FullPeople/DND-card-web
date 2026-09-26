import {beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({card:{id:'card',itemId:'card:card',kind:'character',stats:{health:20}} as any,requests:[] as any[]}));
vi.mock('../src/platform/workbench',()=>({getWorkbench:()=>({cards:[mock.card],monsters:[],target:mock.card}),workbenchRequest:async(_type:string,message:any)=>{mock.requests.push(message);const expr=message.patch.health;mock.card.stats.health=typeof expr==='string'?mock.card.stats.health+Number(expr):expr;return {snapshot:{state:{stats:{...mock.card.stats}}}};}}));
vi.mock('../src/platform/actionHistory',()=>({recordAction:vi.fn()}));
import {saveVital} from '../src/platform/stats';
beforeEach(()=>{mock.card.stats.health=20;mock.requests.length=0;});
it('evaluates consecutive relative formulas against the last saved value and keeps relative wire semantics',async()=>{
 const results=await Promise.all([saveVital(mock.card,'health','-5','生命'),saveVital(mock.card,'health','/2','生命')]);
 expect(results).toEqual([15,7]);expect(mock.requests.map(m=>m.patch.health)).toEqual(['-5','-8']);expect(mock.requests.map(m=>m.expected.health)).toEqual([20,15]);
 await saveVital(mock.card,'health','=20','生命');expect(mock.requests.at(-1).patch.health).toBe(20);
});
it('rejects unsafe or invalid formulas before sending an update',async()=>{
 await expect(saveVital(mock.card,'health','1/0','生命')).rejects.toThrow('除以零');expect(mock.requests).toHaveLength(0);expect(mock.card.stats.health).toBe(20);
});
