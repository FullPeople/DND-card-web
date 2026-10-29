import {it,expect,vi} from 'vitest';
vi.mock('../src/platform/workbench',()=>{const state={};return{inWorkbench:false,useWorkbench:()=>state,getWorkbench:()=>state,workbenchRequest:vi.fn(),composeRoll:vi.fn()};});
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4',useSheetCaptureActive:()=>false}));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {ResourceModuleEditor} from '../src/ui/ResourceModuleEditor';
import {evaluate} from '../src/core/engine';
import {itemChargeFixture,itemChargeSnapshot} from './helpers/itemChargeDebitFixture';
import {itemChargeOffers,itemChargeRequest,performItemChargeAction} from '../src/core/automation/itemChargeDebits';
const input=(html:string,label:string)=>html.match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0]||'';
function acquired(){const f=itemChargeFixture(),offer=itemChargeOffers(f.c)[0];expect(performItemChargeAction(f.c,itemChargeRequest(f.c,offer.ownerId,'ui-item-acquire',{kind:'acquire',knownRemaining:2,confirmedGenuineItem:true,confirmedKnownBalance:true})).status).toBe('applied');return{...f,key:offer.key};}
it('actual Earring exposes blank explicit current-known acquisition without a free full counter or item effects',()=>{const f=itemChargeFixture(),before=itemChargeSnapshot(f.c),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d:evaluate(f.c),entries:f.entries,edit:()=>{}}));expect(f.entry.id).toBe('kiwee:item:crcotn:earring%20of%20message::::::');expect(html).toContain('aria-label="物品充能当前已知剩余"');expect(input(html,'物品充能当前已知剩余')).toContain('value=""');expect(itemChargeSnapshot(f.c)).toBe(before);expect(f.c.runtime.itemChargeDebits).toBeUndefined();});
it('an authoritatively owned item mirror remains readonly after marker loss in the existing generic editor',()=>{const f=acquired();delete f.c.runtime.resources[f.key].itemChargeDebitGrant;const before=itemChargeSnapshot(f.c),html=renderToStaticMarkup(createElement(ResourceModuleEditor,{c:f.c,id:f.key,edit:()=>{},close:()=>{},disabled:false,gm:true}));expect(input(html,'资源剩余')).toMatch(/\b(?:readonly|disabled)/i);expect(input(html,'资源上限')).toMatch(/\b(?:readonly|disabled)/i);expect(html).not.toContain('>移除</button>');expect(itemChargeSnapshot(f.c)).toBe(before);});
import {ItemChargeUseControl} from '../src/ui/ItemChargeUseControl';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
const renderControl=(f:ReturnType<typeof itemChargeFixture>,writable=true)=>renderToStaticMarkup(createElement(ItemChargeUseControl,{c:f.c,ownerId:f.owner.id,edit:()=>{},writable}));
it('real fixed1 routes show their technical identity and zero/nonterminal boundary without authorizing spell effects or recovery',()=>{
 const f=acquired();f.owner.equipped=true;let html=renderControl(f);expect(html).toContain('primary-charge-action');expect(html).toContain('本分支可记录至 0');expect(html).toContain('不执行物品动作、施法或效果');expect(html).not.toMatch(/>恢复[^<]*<\/button>/);
 const wand=itemChargeFixture('Wand of Magic Missiles','DMG');const offer=itemChargeOffers(wand.c)[0];expect(performItemChargeAction(wand.c,itemChargeRequest(wand.c,offer.ownerId,'ui-nonterminal-acquire',{kind:'acquire',knownRemaining:1,confirmedGenuineItem:true,confirmedKnownBalance:true})).status).toBe('applied');html=renderControl(wand);expect(html).toContain('cast-magic-missile-rank-1');expect(html).toContain('必须至少保留 1');expect(html).toContain('spellRank=1');expect(html.match(/<button[^>]*>记录固定费用分支 · 扣 1 充能<\/button>/)?.[0]).toContain('disabled');
});
it('explicit known zero survives native reopening, remains spent/readonly, and source pause never offers a fresh acquisition',()=>{
 const f=itemChargeFixture(),offer=itemChargeOffers(f.c)[0];expect(performItemChargeAction(f.c,itemChargeRequest(f.c,offer.ownerId,'ui-known-zero',{kind:'acquire',knownRemaining:0,confirmedGenuineItem:true,confirmedKnownBalance:true})).status).toBe('applied');const reopened=readCharacter(exportCharacter(f.c)).character;f.c=reopened;let html=renderControl(f);expect(html).toContain('当前已记录剩余 0 / 5');expect(html.match(/<button[^>]*>确认记录物品充能<\/button>/)?.[0]).toContain('disabled');f.c.profile.enabledSources=[];html=renderControl(f);expect(html).toContain('当前已记录剩余 0 / 5');expect(html.match(/<button[^>]*>撤销此物品充能记账<\/button>/)?.[0]).not.toContain('disabled');expect(renderControl(f,false).match(/<fieldset[^>]*>/)?.[0]).toContain('disabled');
});
it('actual held source, future history and unrelated manual prefix/marker collisions cannot be promoted or silently owned',()=>{
 const held=itemChargeFixture('Clockwork Amulet','XDMG'),html=renderControl(held);expect(itemChargeOffers(held.c)[0].canAcquire).toBe(false);expect(html.match(/<button[^>]*>确认记录物品充能<\/button>/)?.[0]).toContain('disabled');
 const f=itemChargeFixture();(f.c.runtime as any).itemChargeDebits={version:9,opaque:{keep:true}};const before=itemChargeSnapshot(f.c);expect(renderControl(f)).toContain('只读');expect(renderControl(f).match(/<button[^>]*>确认记录物品充能<\/button>/)?.[0]).toContain('disabled');expect(itemChargeSnapshot(f.c)).toBe(before);
 const manual=itemChargeFixture(),offer=itemChargeOffers(manual.c)[0];manual.c.runtime.resources[offer.key]={name:'Authored exact-key collision',max:7,current:2,itemChargeDebitGrant:{key:offer.key}};const editor=renderToStaticMarkup(createElement(ResourceModuleEditor,{c:manual.c,id:offer.key,edit:()=>{},close:()=>{},disabled:false,gm:true}));expect(input(editor,'资源剩余')).not.toMatch(/\b(?:readonly|disabled)/i);expect(editor).toContain('>移除</button>');expect(itemChargeOffers(manual.c)[0].canAcquire).toBe(false);expect(manual.c.runtime.itemChargeDebits).toBeUndefined();
});
import {readFileSync} from 'node:fs';
it('the actual leaf binds balance acknowledgement to its edited value and observes only validated own-history receipts',()=>{const source=readFileSync('src/ui/ItemChargeUseControl.tsx','utf8');expect.soft(source).toContain('setRemaining(event.target.value);setKnown(false);epoch.current++');expect.soft(source).toContain("c.runtime.itemChargeDebits?.version===1&&offer?.record?.ownerId===ownerId");expect.soft(source).toContain('offer.record.events.some(event=>event.id===last.id&&event.sequence===last.sequence)');});
