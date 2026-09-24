import {it,expect,vi} from 'vitest';

it('new edits during an asynchronous undo remain undoable and invalidate redo',async()=>{
 vi.resetModules();const {recordAction,travelHistory}=await import('../src/platform/actionHistory');
 let release!:()=>void;const events:string[]=[];
 recordAction({label:'old',undo:()=>new Promise<void>(resolve=>{release=resolve;events.push('old undo');}),redo:()=>{events.push('old redo');}});
 const undo=travelHistory();recordAction({label:'new',undo:()=>{events.push('new undo');},redo:()=>{events.push('new redo');}});
 release();await undo;await travelHistory(true);expect(events).toEqual(['old undo']);
 await travelHistory();expect(events).toEqual(['old undo','new undo']);
});

it('redo completion is inserted before edits made while it was in flight',async()=>{
 vi.resetModules();const {recordAction,travelHistory}=await import('../src/platform/actionHistory');
 let release!:()=>void;const events:string[]=[];
 recordAction({label:'old',undo:()=>{events.push('old undo');},redo:()=>new Promise<void>(resolve=>{release=resolve;})});
 await travelHistory();const redo=travelHistory(true);
 recordAction({label:'new',undo:()=>{events.push('new undo');},redo:()=>{}});release();await redo;
 await travelHistory();await travelHistory();expect(events).toEqual(['old undo','new undo','old undo']);
});
