// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {applyDisplayCharacterEdit,displayBiographyEdit} from '../src/core/displayCharacterEdit';
import {SheetChoicesContext} from '../src/ui/SheetChoicesContext';
import {SpellsPage} from '../src/ui/SpellsPage';
import {evaluate} from '../src/core/engine';
import * as spells from '../src/core/spells';
import * as workspace from '../src/core/spellWorkspace';
import * as sources from '../src/core/automation/sourceSpells';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('a retained spell page reuses its immutable read models for story edits and refreshes them for mechanical edits',async()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 const host=document.createElement('div'),root=createRoot(host),c=newCharacter();c.automation=newAutomationState();const entries:any[]=[],d=evaluate(c),snapshot={character:c,catalog:entries,choices:[],derived:d};const spies=[vi.spyOn(spells,'spellLibrary'),vi.spyOn(workspace,'cantripGroups'),vi.spyOn(sources,'planSourceSpells')];
 const draw=(card:typeof c)=>act(()=>root.render(createElement(SheetChoicesContext.Provider,{value:snapshot},createElement(SpellsPage,{c:card,d,entries,edit:()=>{},browse:()=>{},inspect:()=>{}} as any))));
 try{await draw(c);const counts=spies.map(s=>s.mock.calls.length);const text=applyDisplayCharacterEdit(c,displayBiographyEdit('story','Authored story'))!;await draw(text);expect(spies.map(s=>s.mock.calls.length)).toEqual(counts);await draw({...text,baseHp:99});for(let n=0;n<spies.length;n++)expect(spies[n].mock.calls.length).toBeGreaterThan(counts[n]);}finally{await act(()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();}
});
