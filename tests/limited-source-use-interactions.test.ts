// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {Character,Entry} from '../src/core/model';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {limitedSourceUseOffers} from '../src/core/automation/limitedSourceUses';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {SourceSpellActions} from '../src/ui/SourceSpellActions';
import {ResourceModuleEditor} from '../src/ui/ResourceModuleEditor';
import {ResourceWidgets} from '../src/ui/ResourceWidgets';
import {EntryDraggable,EntryDragProvider,DropZone} from '../src/ui/DragEntry';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {RetainedCardVisibility} from '../src/ui/RetainedCardVisibility';
import {FeedbackContext} from '../src/ui/InteractionFeedback';
import {localGm} from '../src/cloud/localRights';
import {evaluate} from '../src/core/engine';
import {limitedSourceFixture,limitedSnapshot} from './helpers/limitedSourceUseFixture';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let dispose:(()=>Promise<void>)|undefined,hitDescriptor:PropertyDescriptor|undefined;
beforeEach(()=>{hitDescriptor=Object.getOwnPropertyDescriptor(document,'elementFromPoint');vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));if(!globalThis.CSS?.escape)vi.stubGlobal('CSS',{escape:(value:string)=>Array.from(value).map(char=>'\\'+char.codePointAt(0)!.toString(16)+' ').join('')});});
afterEach(async()=>{await dispose?.();dispose=undefined;if(hitDescriptor)Object.defineProperty(document,'elementFromPoint',hitDescriptor);else delete(document as any).elementFromPoint;vi.restoreAllMocks();vi.unstubAllGlobals();});

/** Real catalog, pointer/drop controls, actor, source-child sync and events.
 * Only the host transaction/persistence boundary and geometry are authored;
 * no rule, saved authority, session or backend behavior is replaced. */
async function setup(options:{empty?:boolean;english?:string;source?:string}={}){
 await dispose?.();const source=limitedSourceFixture(options.english,options.source);let c=source.c,writable=true,active=true,defer=false,submit=true,showResources=false,saveLabel='已保存到本机',pending:((draft:Character)=>void)|undefined;
 if(options.empty)c.selections=[];
 const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);
 const edit=vi.fn((fn:(draft:Character)=>void)=>{if(!submit)return;if(defer){pending=fn;return;}const draft=structuredClone(c);fn(draft);syncSourceSpells(draft,source.entries);c=draft;draw();});
 // Same root-selection construction as App.add after the actual drag control
 // has accepted the authenticated catalog entry. This is not an App test hook.
 const add=(entry:Entry)=>edit(draft=>{draft.selections.push({id:crypto.randomUUID(),entry:structuredClone(entry),quantity:1,level:1,equipped:false});});
 function draw(){const child=c.selections.find(row=>row.entry.kind==='spell'&&c.spellSettings?.special?.[row.id]?.sourceGrant?.usage==='limited'),offer=limitedSourceUseOffers(c)[0];root?.render(createElement(RetainedCardVisibility.Provider,{value:active},createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:writable,open:()=>{},close:()=>{}}},createElement(FeedbackContext.Provider,{value:{scope:c.id,saveLabel,announce:()=>{}}},createElement(EntryDragProvider,{character:c,receive:add,editing:writable,disabledReason:writable?undefined:'Authored readonly host',children:createElement('div',null,createElement(EntryDraggable,{entry:source.entry,'aria-label':'真实有限来源目录项',children:source.entry.name}),createElement('main',{className:'paper','data-active-sheet':'true'},createElement(DropZone,{kinds:['feature'],onReceive:add,children:createElement(AutomationPanel,{c,d:evaluate(c),entries:source.entries,edit,writable})}),child&&createElement(SourceSpellActions,{c,id:child.id,edit,readOnly:!writable}),showResources&&offer&&createElement(ResourceModuleEditor,{c,id:offer.key,edit,close:()=>{},disabled:!writable,gm:localGm()}),showResources&&createElement(ResourceWidgets,{c,rows:Object.entries(c.runtime.resources),editing:false,enabled:writable,gm:localGm(),edit,manage:()=>{}})))})))));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const field=(label:string)=>{const node=host.querySelector<HTMLInputElement>(`input[aria-label=${JSON.stringify(label)}]`);expect(node).not.toBeNull();return node!;};
 const button=(name:string)=>{const rows=[...host.querySelectorAll<HTMLButtonElement>('button')].filter(row=>row.textContent===name||row.getAttribute('aria-label')===name);expect(rows,`one authored control ${name}`).toHaveLength(1);return rows[0];};
 const fill=async(label:string,value:string)=>act(()=>{const node=field(label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
 const confirm=async(value:string)=>{await fill('有限来源当前已知剩余',value);await click(field('确认本次有限来源是真实当前授予'));await click(field('确认有限来源当前剩余已核对'));await click(button('确认记录有限来源'));};
 const unmount=async()=>{if(root)await act(()=>root!.unmount());root=undefined;};
 dispose=async()=>{await unmount();host.remove();};await render();
 return{source,host,edit,field,button,fill,click,confirm,render,unmount,replace:(next:Character)=>{c=next;},get c(){return c;},get pending(){return pending;},get offer(){return limitedSourceUseOffers(c)[0];},set writable(v:boolean){writable=v;},set active(v:boolean){active=v;},set defer(v:boolean){defer=v;},set submit(v:boolean){submit=v;},set saveLabel(v:string){saveLabel=v;},set showResources(v:boolean){showResources=v;}};
}
it('a genuine catalog pointer acquisition grants no balance or child until explicit known zero is recorded, then survives native reopening',async()=>{
 const s=await setup({empty:true});expect(s.host.querySelector('[data-limited-source-use]')).toBeNull();const target=s.host.querySelector<HTMLElement>('[data-drop-zone]')!,from=s.button('真实有限来源目录项');
 Object.defineProperty(document,'elementFromPoint',{configurable:true,value:()=>target});vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return new DOMRect(this===from?10:200,20,120,40);});
 const pointer=(node:EventTarget,type:string,x:number)=>{const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:30});Object.defineProperties(event,{pointerId:{value:17},pointerType:{value:'mouse'},isPrimary:{value:true}});node.dispatchEvent(event);};
 await act(()=>{pointer(from,'pointerdown',20);pointer(document,'pointermove',230);pointer(document,'pointerup',230);});
 expect(s.c.selections.filter(row=>row.entry.id===s.source.entry.id)).toHaveLength(1);expect(s.c.runtime.limitedSourceUses).toBeUndefined();expect(s.c.selections.filter(row=>row.entry.kind==='spell')).toHaveLength(0);expect(s.field('有限来源当前已知剩余').value).toBe('');expect(s.button('确认记录有限来源').disabled).toBe(true);
 await s.confirm('0');expect(s.offer.initialized).toBe(true);expect(s.offer.remaining).toBe(0);expect(s.c.runtime.resources[s.offer.key].current).toBe(0);const reopened=readCharacter(exportCharacter(s.c)).character;syncSourceSpells(reopened,s.source.entries);expect(limitedSnapshot(reopened.runtime.limitedSourceUses)).toBe(limitedSnapshot(s.c.runtime.limitedSourceUses));expect(reopened.runtime.resources[s.offer.key].current).toBe(0);expect(reopened.runtime.resources.manual.current).toBe(2);
});
it('one known remaining use requires a fresh per-cast source attestation and exhausts through the actual source child without recovery or refill',async()=>{
 const s=await setup(),manual=limitedSnapshot(s.c.runtime.resources.manual);await s.confirm('1');expect(s.button('使用').disabled).toBe(true);await s.click(s.field('确认有限来源本次施法当前仍有效'));await s.click(s.button('使用'));
 expect(s.offer.remaining).toBe(0);expect(s.c.runtime.automationActions?.sequence).toBe(1);expect(s.field('确认有限来源本次施法当前仍有效').checked).toBe(false);expect(s.button('使用').disabled).toBe(true);expect([...s.host.querySelectorAll('button')].some(node=>/恢复.*次数/.test(node.textContent||''))).toBe(false);const before=limitedSnapshot(s.c.runtime.limitedSourceUses);syncSourceSpells(s.c,s.source.entries);await s.render();expect(limitedSnapshot(s.c.runtime.limitedSourceUses)).toBe(before);expect(limitedSnapshot(s.c.runtime.resources.manual)).toBe(manual);
});
it('known conditional and future-version sources remain held; acknowledgement cannot promote or reinitialize them',async()=>{
 const s=await setup({english:'Arcane Study Charm',source:'XDMG'}),before=limitedSnapshot(s.c);expect(s.button('确认记录有限来源').disabled).toBe(true);expect(s.field('确认本次有限来源是真实当前授予').disabled).toBe(true);await s.click(s.button('确认记录有限来源'));expect(limitedSnapshot(s.c)).toBe(before);
 const f=await setup();(f.c.runtime as any).limitedSourceUses={version:9,opaque:{keep:true}};const future=limitedSnapshot(f.c);await f.render();expect(f.button('确认记录有限来源').disabled).toBe(true);await f.click(f.button('确认记录有限来源'));expect(limitedSnapshot(f.c)).toBe(future);
});
it('cancel, readonly, retained hide, unmount and source change revoke a queued acquisition; replay cannot create a second record',async()=>{
 for(const mode of ['cancel','readonly','hide','unmount','source','apply'] as const){const s=await setup();s.defer=true;await s.confirm('1');await s.click(s.button('确认记录有限来源'));expect(s.edit).toHaveBeenCalledTimes(1);const pending=s.pending!;if(mode==='cancel')await s.click(s.button('取消有限来源核对'));else if(mode==='readonly'){s.writable=false;await s.render();}else if(mode==='hide'){s.active=false;await s.render();}else if(mode==='unmount')await s.unmount();const draft=structuredClone(s.c);if(mode==='source')draft.profile.enabledSources=[];const before=limitedSnapshot(draft);await act(()=>pending(draft));if(mode==='apply'){expect(draft.runtime.limitedSourceUses?.records).toHaveLength(1);const once=limitedSnapshot(draft);await act(()=>pending(draft));expect(limitedSnapshot(draft)).toBe(once);}else expect(limitedSnapshot(draft)).toBe(before);}
});
it('source pause preserves an owned balance and permits explicit withdrawal, never a new grant; save labels and rejected hosts stay honest',async()=>{
 const s=await setup();s.saveLabel='保存失败：authored failure';await s.confirm('1');expect(s.host.querySelector('[data-testid=limited-source-save-state]')?.textContent).toBe('保存失败：authored failure');s.c.profile.enabledSources=[];await s.render();expect(s.offer.remaining).toBe(1);expect(s.button('确认记录有限来源').disabled).toBe(true);await s.click(s.button('撤销有限来源授权'));expect(s.offer.withdrawn).toBe(true);expect(s.offer.remaining).toBe(1);s.c.profile.enabledSources=['DMG','PHB'];await s.render();expect(s.button('确认记录有限来源').disabled).toBe(true);
 const rejected=await setup();rejected.submit=false;const before=limitedSnapshot(rejected.c);await rejected.confirm('1');expect(limitedSnapshot(rejected.c)).toBe(before);expect(rejected.host.querySelector('[data-limited-phase=applied]')).toBeNull();
});
it('real generic owned resource controls are readonly even for the actual solo GM, while legitimate lock controls and manual collisions remain intact',async()=>{
 const s=await setup();await s.confirm('1');s.showResources=true;await s.render();expect(s.field('资源剩余').readOnly).toBe(true);expect(s.field('资源上限').disabled).toBe(true);const face=s.host.querySelector<HTMLButtonElement>(`[data-resource-id=${JSON.stringify(s.offer.key)}] .resource-widget-face`)!;await s.click(face);const dialog=document.querySelector('[role=dialog].resource-widget-popover')!;for(const pip of dialog.querySelectorAll<HTMLButtonElement>('.resource-pips button'))expect(pip.disabled).toBe(true);const lock=dialog.querySelector<HTMLButtonElement>('.resource-lock')!;expect(lock.disabled).toBe(false);await s.click(lock);expect(s.c.runtime.resources[s.offer.key].locked).toBe(true);expect(s.offer.remaining).toBe(1);expect(s.c.runtime.limitedSourceUses?.sequence).toBe(1);
 const manual=await setup();manual.c.runtime.resources[manual.offer.key]={name:'Authored independent exact-key collision',max:3,current:1};manual.showResources=true;await manual.render();expect(manual.field('资源剩余').readOnly).toBe(false);expect(manual.c.runtime.limitedSourceUses).toBeUndefined();
});
it('editing the known remaining value revokes its confirmation; a subsequent queued acquisition cannot apply after the current source changes',async()=>{
 const s=await setup(),initial=limitedSnapshot(s.c);await s.fill('有限来源当前已知剩余','1');await s.click(s.field('确认本次有限来源是真实当前授予'));await s.click(s.field('确认有限来源当前剩余已核对'));expect(s.button('确认记录有限来源').disabled).toBe(false);await s.fill('有限来源当前已知剩余','2');expect(s.field('确认有限来源当前剩余已核对').checked).toBe(false);expect(s.button('确认记录有限来源').disabled).toBe(true);expect(limitedSnapshot(s.c)).toBe(initial);
 await s.click(s.button('取消有限来源核对'));s.defer=true;await s.confirm('1');const pending=s.pending!;s.c.profile.enabledSources=[];await s.render();const draft=structuredClone(s.c),before=limitedSnapshot(draft);await act(()=>pending(draft));expect(limitedSnapshot(draft)).toBe(before);expect(draft.runtime.limitedSourceUses).toBeUndefined();
});
it('future or mismatched raw last IDs cannot acknowledge an uncommitted finite operation or repair its history',async()=>{
 for(const kind of ['future','mismatched-key'] as const){const s=await setup();s.defer=true;await s.confirm('1');const uncommitted=structuredClone(s.c);await act(()=>s.pending!(uncommitted));const history=uncommitted.runtime.limitedSourceUses!;expect(history.last).toBeDefined();if(kind==='future')(s.c.runtime as any).limitedSourceUses={version:9,last:structuredClone(history.last),opaque:{keep:true}};else{s.c.runtime.limitedSourceUses=structuredClone(history);s.c.runtime.limitedSourceUses.last!.key='authored-not-the-owned-pool';const key=history.records[0].key;s.c.runtime.resources[key]=structuredClone(uncommitted.runtime.resources[key]);}const before=limitedSnapshot(s.c);await s.render();expect(s.host.querySelector('[data-limited-phase=applied]')).toBeNull();expect(limitedSnapshot(s.c)).toBe(before);}
});
