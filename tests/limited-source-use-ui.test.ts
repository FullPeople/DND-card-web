import {it,expect,vi} from 'vitest';
vi.mock('../src/platform/workbench',()=>{const state={};return{inWorkbench:false,useWorkbench:()=>state,getWorkbench:()=>state,workbenchRequest:vi.fn(),composeRoll:vi.fn()};});
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4',useSheetCaptureActive:()=>false}));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {evaluate} from '../src/core/engine';
import {limitedSourceFixture,limitedSnapshot} from './helpers/limitedSourceUseFixture';
import {limitedSourceUseOffers,limitedSourceUseRequest,performLimitedSourceUseAction} from '../src/core/automation/limitedSourceUses';
import {ResourceModuleEditor} from '../src/ui/ResourceModuleEditor';
import {ResourceRow} from '../src/ui/ResourceRow';
import {SourceSpellActions} from '../src/ui/SourceSpellActions';
import {SpellsPage} from '../src/ui/SpellsPage';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {readCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';

it('actual DMG finite reward renders explicit blank known-balance acquisition, not a free/full/daily grant',()=>{
 const {c,entries,entry}=limitedSourceFixture(),before=limitedSnapshot(c);
 expect(entry.id).toBe('kiwee:feature:dmg:charm%20of%20animal%20conjuring::::::');
 const html=renderToStaticMarkup(createElement(AutomationPanel,{c,d:evaluate(c),entries,edit:()=>{}}));
 expect(limitedSnapshot(c)).toBe(before);expect(html).toContain('aria-label="有限来源当前已知剩余"');expect(html).toContain('确认记录有限来源');expect(html).not.toContain('value="3"');
});
function acquired(remaining=1){const f=limitedSourceFixture(),offer=limitedSourceUseOffers(f.c)[0];expect(performLimitedSourceUseAction(f.c,limitedSourceUseRequest(f.c,offer.ownerId,offer.poolId,'ui-actual-acquire',{kind:'acquire',knownRemaining:remaining,confirmedGenuineGrant:true,confirmedKnownBalance:true})).status).toBe('applied');syncSourceSpells(f.c,f.entries);return{...f,offer,row:f.c.selections.find(row=>row.entry.kind==='spell')!};}
it('finite child offers fresh current-source acknowledgement, no recovery action and no invented attack/DC',()=>{
 const f=acquired(),before=limitedSnapshot(f.c),html=renderToStaticMarkup(createElement(SourceSpellActions,{c:f.c,id:f.row.id,edit:()=>{}}));expect(html).toContain('aria-label="确认有限来源本次施法当前仍有效"');expect(html.match(/<button[^>]*>使用<\/button>/)?.[0]).toContain('disabled');expect(html).not.toMatch(/>恢复(?:共用)?次数<\/button>/);expect(html).toContain('不恢复');expect(html).not.toMatch(/DC\s*\d/);expect(f.c.spellSettings!.special![f.row.id].sourceGrant?.ability).toBeUndefined();expect(limitedSnapshot(f.c)).toBe(before);
});
it('finite source badge is distinct from daily/free uses in the existing spell page and remains render-pure',()=>{
 const f=acquired(),before=limitedSnapshot(f.c),html=renderToStaticMarkup(createElement(SpellsPage,{c:f.c,d:evaluate(f.c),entries:f.entries,edit:()=>{},browse:()=>{},inspect:()=>{},onLink:()=>{},add:()=>{}}));expect(html).toContain('有限次数 1/3 · 不恢复');expect(html).not.toContain('免费 1/3');expect(limitedSnapshot(f.c)).toBe(before);
});
it('explicit zero is a retained exhausted record through the real native envelope and never an invitation to reinitialize',()=>{
 const f=acquired(0),reopened=readCharacter(exportCharacter(f.c)).character;syncSourceSpells(reopened,f.entries);const before=limitedSnapshot(reopened),html=renderToStaticMarkup(createElement(AutomationPanel,{c:reopened,d:evaluate(reopened),entries:f.entries,edit:()=>{}}));expect(html).toContain('次数已耗尽');expect(html.match(/<button[^>]*>确认记录有限来源<\/button>/)?.[0]).toContain('disabled');expect(limitedSourceUseOffers(reopened)[0].remaining).toBe(0);expect(limitedSnapshot(reopened)).toBe(before);
});
it('known expiry and ambiguous sources stay held and future histories stay opaque despite any visible confirmation controls',()=>{
 for(const[english,source]of[['Arcane Study Charm','XDMG'],['Charm of Restoration','DMG']]){const f=limitedSourceFixture(english,source),before=limitedSnapshot(f.c),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d:evaluate(f.c),entries:f.entries,edit:()=>{}}));expect(html.match(/<button[^>]*>确认记录有限来源<\/button>/)?.[0]).toContain('disabled');expect(limitedSnapshot(f.c)).toBe(before);expect(limitedSourceUseOffers(f.c)[0].canAcquire).toBe(false);}
 const f=limitedSourceFixture();(f.c.runtime as any).limitedSourceUses={version:9,opaque:{keep:['exact']}};const before=limitedSnapshot(f.c),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d:evaluate(f.c),entries:f.entries,edit:()=>{}}));expect(html).toContain('版本尚未支持');expect(html.match(/<button[^>]*>确认记录有限来源<\/button>/)?.[0]).toContain('disabled');expect(limitedSnapshot(f.c)).toBe(before);
});
it('retained orphan/paused history stays visible for explicit withdrawal without enabling a fresh acquisition',()=>{
 const f=acquired();f.c.selections=[];f.c.automation!.enabled=false;const before=limitedSnapshot(f.c),html=renderToStaticMarkup(createElement(AutomationPanel,{c:f.c,d:evaluate(f.c),entries:f.entries,edit:()=>{}}));expect(html).toContain('当前已记录剩余 1 / 3 次');expect(html.match(/<button[^>]*>撤销有限来源授权<\/button>/)?.[0]).not.toContain('disabled');expect(html.match(/<button[^>]*>确认记录有限来源<\/button>/)?.[0]).toContain('disabled');expect(limitedSnapshot(f.c)).toBe(before);
});
it('the real generic row disables finite pips but preserves the existing explicit solo GM lock and presentation controls',()=>{
 const f=acquired(),r=f.c.runtime.resources[f.offer.key],before=limitedSnapshot(f.c),html=renderToStaticMarkup(createElement(ResourceRow,{resource:{...r,id:f.offer.key},enabled:true,gm:true,balanceReadonly:true,change:async()=>{},configure:()=>{},lock:()=>{}}));const pips=html.match(/<button[^>]*aria-pressed="[^"]*"[^>]*>/g)||[];expect(pips).toHaveLength(3);for(const pip of pips)expect(pip).toContain('disabled');expect(html.match(/<button[^>]*class="resource-lock"[^>]*>/)?.[0]).not.toContain('disabled');expect(html.match(/<button[^>]*class="resource-configure"[^>]*>/)?.[0]).not.toContain('disabled');expect(limitedSnapshot(f.c)).toBe(before);
});
const input=(html:string,label:string)=>html.match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0]||'';
it('owned finite numeric mirror remains readonly in the real module editor even after its mutable marker disappears',()=>{
 const {c}=limitedSourceFixture(),offer=limitedSourceUseOffers(c)[0];expect(performLimitedSourceUseAction(c,limitedSourceUseRequest(c,offer.ownerId,offer.poolId,'ui-owned-acquire',{kind:'acquire',knownRemaining:1,confirmedGenuineGrant:true,confirmedKnownBalance:true})).status).toBe('applied');
 delete c.runtime.resources[offer.key].limitedSourceUseGrant;const before=limitedSnapshot(c),html=renderToStaticMarkup(createElement(ResourceModuleEditor,{c,id:offer.key,edit:()=>{},close:()=>{},disabled:false,gm:true}));
 expect(input(html,'资源剩余')).toMatch(/\b(?:readonly|disabled)/i);expect(input(html,'资源上限')).toMatch(/\b(?:readonly|disabled)/i);expect(html).not.toContain('>移除</button>');expect(limitedSnapshot(c)).toBe(before);
});
it('an unrelated manual counter at the exact proposed finite key stays manually editable and is never adopted',()=>{
 const {c}=limitedSourceFixture(),offer=limitedSourceUseOffers(c)[0];c.runtime.resources[offer.key]={name:'Authored independent manual collision',max:3,current:1};const before=limitedSnapshot(c),html=renderToStaticMarkup(createElement(ResourceModuleEditor,{c,id:offer.key,edit:()=>{},close:()=>{},disabled:false,gm:true}));
 expect(input(html,'资源剩余')).not.toMatch(/\b(?:readonly|disabled)/i);expect(html).toContain('>移除</button>');expect(limitedSourceUseOffers(c)[0].canAcquire).toBe(false);expect(limitedSnapshot(c)).toBe(before);
});
