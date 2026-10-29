import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import {performSpellAction,spellActionRequest,spellPayments} from '../src/core/automation/actions';
import {FeedbackContext} from '../src/ui/InteractionFeedback';
import {confirmSpellPresentation,type SpellPresentation} from '../src/ui/spellActionPresentation';
import {ordinarySpellFixture} from './helpers/ordinarySpellCastingFixture';
let SpellActionFeedback:typeof import('../src/ui/SpellActionFeedback')['SpellActionFeedback'];
// URL binding only for the browser-only platform module's top-level import.
// No room/session, role, transport, DOM or authority execution is simulated.
beforeAll(async()=>{vi.stubGlobal('location',new URL('https://ordinary-presentation.invalid/'));({SpellActionFeedback}=await import('../src/ui/SpellActionFeedback'));});
afterAll(()=>vi.unstubAllGlobals());

/** Node/SSR checks only. These do not replace the separately authored eight
 * actual-DOM flows, whose local environment currently lacks jsdom. */
it('renders an actual ordinary pool receipt and the real scoped persistence failure, never a synthetic saved claim',()=>{
 const {c,row}=ordinarySpellFixture(),payment=spellPayments(c,row.id).options.find(p=>p.id.startsWith('ordinary:'))!,request=spellActionRequest(c,row.id,payment.id,'ssr-real-owned-cast');
 expect(performSpellAction(c,request).status).toBe('applied');
 const pending:SpellPresentation={id:request.id,scope:c.id,title:row.entry.name,payment:payment.label,mode:'cast',phase:'pending'},action=confirmSpellPresentation(pending,c.id,c.runtime.automationActions?.last)!;
 const render=(scope:string)=>renderToStaticMarkup(createElement(FeedbackContext.Provider,{value:{scope,saveLabel:'保存失败：authored failure',announce:()=>{}}},createElement(SpellActionFeedback,{action})));
 expect(render(c.id)).toContain('data-phase="applied"');expect(render(c.id)).toContain('保存失败：authored failure');expect(render(c.id)).not.toContain('已保存到本机');expect(render('other-authored-card')).not.toContain('authored failure');expect(render('other-authored-card')).toContain('请查看卡面保存状态');
});
it('SSR pending/unconfirmed states never publish a successful debit or persistence label without an observed receipt',()=>{
 const action:SpellPresentation={id:'authored-pending',scope:'authored-card',title:'authored pending action',payment:'chosen pool',mode:'cast',phase:'pending'};
 for(const phase of ['pending','unconfirmed'] as const){const html=renderToStaticMarkup(createElement(SpellActionFeedback,{action:{...action,phase}}));expect(html).not.toContain('action-save-state');expect(html).not.toContain('施法已记录');expect(html).toContain('等待卡面确认');}
});
it('static route guard keeps ordinary actions distinct from existing special/source details and keeps authorization transient',()=>{
 const page=readFileSync(new URL('../src/ui/SpellsPage.tsx',import.meta.url),'utf8'),control=readFileSync(new URL('../src/ui/OrdinarySpellActions.tsx',import.meta.url),'utf8'),hook=readFileSync(new URL('../src/ui/SpellActionFeedback.tsx',import.meta.url),'utf8'),source=readFileSync(new URL('../src/ui/SourceSpellActions.tsx',import.meta.url),'utf8');
 expect(page).toContain('detailRow&&!detailConfig&&createPortal');expect(page).toContain('detailRow&&detailConfig&&createPortal');expect(control).toContain("row.id.startsWith('ordinary:')");expect(hook).toContain('performSpellAction(draft,request,access)');expect(hook).toContain("gm:inWorkbench?wb.role==='GM':localGm()");expect(hook).not.toMatch(/draft\.(gm|canEdit)\s*=/);
 expect(source).toContain('spellPayments(c,id,feedback.authority)');expect(source).toContain('sourceSpellRestoreOffer(c,id,feedback.authority)');
});
