// @vitest-environment jsdom
// Authored actual-DOM coverage; NOT RUN where installed jsdom is absent.
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const live=vi.hoisted(()=>({wb:{online:true,role:'PLAYER',target:undefined as any}}));
vi.mock('../src/platform/workbench',()=>({inWorkbench:true,useWorkbench:()=>live.wb,getWorkbench:()=>live.wb,workbenchCharacterId:(target:any)=>target?.characterId,workbenchRequest:vi.fn(),requestInventory:vi.fn(),composeRoll:vi.fn()}));
import type {Character} from '../src/core/model';
import {ItemChargeUseControl} from '../src/ui/ItemChargeUseControl';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {RetainedCardVisibility} from '../src/ui/RetainedCardVisibility';
import {FeedbackContext} from '../src/ui/InteractionFeedback';
import {itemChargeOffers} from '../src/core/automation/itemChargeDebits';
import {nonunitItemChargeFixture} from './helpers/nonunitItemChargeFlowFixture';
import {nonunitItemChargeSnapshot as snapshot} from './helpers/nonunitItemChargeSourceFixture';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const RING='kiwee:item:dmg:ring%20of%20the%20ram::::::',FANGS='kiwee-homebrew:item:humblewoodtales:fangs%20of%20guile::::::';
let dispose:(()=>Promise<void>)|undefined;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
/** Actual frozen-source leaf and actor. The host models deferred writes/save
 * captions and live workbench rights, not mounted App or server acceptance. */
async function setup(id=RING){
 await dispose?.();const f=nonunitItemChargeFixture(id);let c=f.c,writable=true,active=true,defer=false,submit=true,saveLabel='已保存到本机',pending:((draft:Character)=>void)|undefined;const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);live.wb.role='PLAYER';live.wb.target={write:true,characterId:c.id};
 const edit=vi.fn((fn:(draft:Character)=>void)=>{if(!submit)return;if(defer){pending=fn;return;}const draft=structuredClone(c);fn(draft);c=draft;draw();});
 function draw(){root?.render(createElement(RetainedCardVisibility.Provider,{value:active},createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:writable,open:()=>{},close:()=>{}}},createElement(FeedbackContext.Provider,{value:{scope:c.id,saveLabel,announce:()=>{}}},createElement(ItemChargeUseControl,{c,ownerId:f.owner.id,edit,writable})))));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const control=()=>{const nodes=host.querySelectorAll<HTMLElement>(`[data-item-charge-owner="${f.owner.id}"]`);expect(nodes).toHaveLength(1);return nodes[0];};
 const field=(label:string)=>{const node=control().querySelector<HTMLInputElement>(`input[aria-label=${JSON.stringify(label)}]`);expect(node).not.toBeNull();return node!;};
 const select=(label:string)=>{const node=control().querySelector<HTMLSelectElement>(`select[aria-label=${JSON.stringify(label)}]`);expect(node).not.toBeNull();return node!;};
 const button=(label:string)=>{const nodes=[...control().querySelectorAll<HTMLButtonElement>('button')].filter(node=>node.textContent===label);expect(nodes).toHaveLength(1);return nodes[0];};
 const debitButton=()=>{const nodes=[...control().querySelectorAll<HTMLButtonElement>('button')].filter(node=>node.textContent?.startsWith('记录所选来源分支'));expect(nodes).toHaveLength(1);return nodes[0];};
 const fill=async(value:string)=>act(()=>{const node=field('物品充能当前已知剩余');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
 const choose=async(label:string,value:string)=>act(()=>{const node=select(label);Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('change',{bubbles:true}));});
 const current=()=>itemChargeOffers(c,{canEdit:writable,gm:live.wb.role==='GM'}).find(row=>row.ownerId===f.owner.id)!;
 const acquire=async()=>{await fill('3');await click(field('确认本次物品是真实物理实例'));await click(field('确认物品当前充能已核对'));await click(button('确认记录物品充能'));};
 const attest=async()=>{const branch=current().variableActions!.find(row=>row.key===select('物品充能来源分支').value)!;for(const code of branch.requiredContext)await click(field('核对本次来源条件 '+code));};
 const prepare=async(cost='2',branch=current().variableActions![0].key)=>{await choose('物品充能来源分支',branch);await choose('物品充能来源费用',cost);await attest();};
 const unmount=async()=>{if(root)await act(()=>root!.unmount());root=undefined;};dispose=async()=>{await unmount();host.remove();};await render();return{host,field,select,button,debitButton,fill,choose,click,acquire,prepare,attest,render,unmount,ownerId:f.owner.id,get c(){return c;},get pending(){return pending;},get offer(){return current();},set defer(value:boolean){defer=value;},set submit(value:boolean){submit=value;},set writable(value:boolean){writable=value;},set active(value:boolean){active=value;},set saveLabel(value:string){saveLabel=value;},async commit(next:Character){c=next;await render();}};
}

it('actual Ring choices remain blank until selected; each source fee1 or2 upgrades only on execution, debits its units once and ACKs observed state without claiming a failed save',async()=>{
 for(const fee of [1,2]){const s=await setup(),protectedBefore=snapshot([s.c.selections,s.c.notes,s.c.runtime.hp,s.c.runtime.resources.manual]);expect(s.select('物品充能来源分支').value).toBe('');expect(s.select('物品充能来源费用').value).toBe('');await s.acquire();expect(s.c.runtime.itemChargeDebits?.version).toBe(1);const acquireEvents=snapshot(s.c.runtime.itemChargeDebits!.records[0].events);await s.prepare(String(fee));expect([...s.select('物品充能来源费用').options].map(option=>option.value)).toEqual(['','1','2','3']);s.saveLabel='保存失败：authored failure';await s.render();const use=s.debitButton();await act(()=>{use.click();use.click();});expect(s.c.runtime.itemChargeDebits?.version).toBe(2);expect(s.c.runtime.itemChargeDebits?.sequence).toBe(2);expect(s.c.runtime.itemChargeDebits!.records[0].spent).toBe(fee);expect(s.offer.remaining).toBe(3-fee);expect(snapshot(s.c.runtime.itemChargeDebits!.records[0].events.slice(0,1))).toBe(acquireEvents);expect(s.host.querySelector('[data-item-charge-phase=applied]')).not.toBeNull();expect(s.host.querySelector('[data-testid=item-charge-save-state]')?.textContent).toBe('保存失败：authored failure');expect(s.select('物品充能来源分支').value).toBe('');expect(s.select('物品充能来源费用').value).toBe('');expect(snapshot([s.c.selections,s.c.notes,s.c.runtime.hp,s.c.runtime.resources.manual])).toBe(protectedBefore);}
});

it('actual branch and fee changes clear every per-event attestation; Fangs retains listed fee3 but cannot spend through its last required charge',async()=>{
 const ring=await setup();await ring.acquire();await ring.prepare();await ring.choose('物品充能来源分支','ram-object-breaking');expect(ring.select('物品充能来源费用').value).toBe('');expect([...ring.host.querySelectorAll<HTMLInputElement>('input[aria-label^="核对本次来源条件 "]')].every(node=>!node.checked)).toBe(true);await ring.choose('物品充能来源费用','1');await ring.attest();await ring.choose('物品充能来源费用','2');expect([...ring.host.querySelectorAll<HTMLInputElement>('input[aria-label^="核对本次来源条件 "]')].every(node=>!node.checked)).toBe(true);expect(ring.debitButton().disabled).toBe(true);
 const fangs=await setup(FANGS);await fangs.acquire();await fangs.prepare('3');expect([...fangs.select('物品充能来源费用').options].map(option=>option.value)).toEqual(['','1','2','3']);expect(fangs.debitButton().disabled).toBe(true);expect(fangs.host.textContent).toContain('当前余额不足以支付所选费用');const before=snapshot(fangs.c);await fangs.click(fangs.debitButton());expect(snapshot(fangs.c)).toBe(before);await fangs.choose('物品充能来源费用','2');await fangs.attest();expect(fangs.debitButton().disabled).toBe(false);await fangs.click(fangs.debitButton());expect(fangs.offer.remaining).toBe(1);expect(fangs.c.runtime.itemChargeDebits!.records[0].spent).toBe(2);
});

it('cancel, readonly, hidden/unmounted/card/owner/source/attunement/balance changes and current GM-lock loss reject delayed fees; a repeated valid callback applies once and waits for observed ACK',async()=>{
 for(const mode of ['cancel','readonly','hide','unmount','card','owner','source','attunement','balance','role','apply'] as const){const s=await setup();await s.acquire();if(mode==='role'){s.c.runtime.resources[s.offer.key].locked=true;live.wb.role='GM';await s.render();}s.defer=true;await s.prepare();await s.click(s.debitButton());const pending=s.pending!;expect(pending).toBeDefined();if(mode==='cancel')await s.click(s.button('取消物品充能核对'));else if(mode==='readonly'){s.writable=false;await s.render();}else if(mode==='hide'){s.active=false;await s.render();}else if(mode==='unmount')await s.unmount();else if(mode==='role')live.wb.role='PLAYER';const draft=structuredClone(s.c);if(mode==='card')draft.id='authored-other-card';if(mode==='owner')draft.selections=draft.selections.filter(row=>row.id!==s.ownerId);if(mode==='source')draft.profile.enabledSources=[];if(mode==='attunement')draft.selections.find(row=>row.id===s.ownerId)!.attuned=false;if(mode==='balance')draft.runtime.resources[s.offer.key].current--;const before=snapshot(draft);await act(()=>pending(draft));if(mode==='apply'){expect(draft.runtime.itemChargeDebits!.records[0].spent).toBe(2);expect(s.host.querySelector('[data-item-charge-phase=applied]')).toBeNull();const once=snapshot(draft);await act(()=>pending(draft));expect(snapshot(draft)).toBe(once);await s.commit(draft);expect(s.host.querySelector('[data-item-charge-phase=applied]')).not.toBeNull();}else expect(snapshot(draft)).toBe(before);}
});

it('ignored fees time out unconfirmed, while unknown-version or forged unit-history receipts cannot acknowledge an operation',async()=>{
 const ignored=await setup();await ignored.acquire();ignored.submit=false;await ignored.prepare();vi.useFakeTimers();const before=snapshot(ignored.c);await ignored.click(ignored.debitButton());expect(ignored.host.querySelector('[data-item-charge-phase=applied]')).toBeNull();await act(async()=>{await vi.advanceTimersByTimeAsync(4501);});expect(ignored.host.querySelector('[data-item-charge-phase=unconfirmed]')).not.toBeNull();expect(snapshot(ignored.c)).toBe(before);vi.useRealTimers();
 for(const mode of ['future','units','snapshot','policy'] as const){const s=await setup();await s.acquire();s.defer=true;await s.prepare();await s.click(s.debitButton());const draft=structuredClone(s.c);await act(()=>s.pending!(draft));const history=structuredClone(draft.runtime.itemChargeDebits!);expect(history.version).toBe(2);if(mode==='future')history.version=9;else if(mode==='snapshot')history.records[0].snapshotSha256='0'.repeat(64);else if(mode==='policy')(history.records[0].events.at(-1)as any).policySha256='0'.repeat(64);else (history.records[0].events.at(-1)as any).units=999;s.c.runtime.resources=structuredClone(draft.runtime.resources);s.c.runtime.itemChargeDebits=history;await s.render();expect(s.host.querySelector('[data-item-charge-phase=applied]')).toBeNull();}
});
