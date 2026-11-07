// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {newCharacter} from '../src/core/model';
import * as engine from '../src/core/engine';
import * as details from '../src/core/characterDetails';
import {applyDisplayCharacterEdit,displayBiographyEdit} from '../src/core/displayCharacterEdit';
import {SheetChoicesContext} from '../src/ui/SheetChoicesContext';
import {HitPointEditor} from '../src/ui/HitPointEditor';
import {DetailHeader} from '../src/ui/CharacterPages';

it('the omitted background header performs no spell-state or spell-value projection',()=>{
 const c=newCharacter(),d=engine.evaluate(c),state=vi.spyOn(details,'spellState'),values=vi.spyOn(details,'spellValues');
 try{expect(renderToStaticMarkup(createElement(DetailHeader,{c,d,page:'背景',edit:()=>{},browse:()=>{},inspect:()=>{},onLink:()=>{},add:()=>{}}))).toBe('');expect(state).not.toHaveBeenCalled();expect(values).not.toHaveBeenCalled();}finally{state.mockRestore();values.mockRestore();}
});

it('an ordinary stat editor reuses the owning card derived snapshot after a text-only change',()=>{
 const c=newCharacter(),derived=engine.evaluate(c),next=applyDisplayCharacterEdit(c,displayBiographyEdit('story','Authored story'))!;
 const snapshot={character:c,catalog:[],choices:[],derived},evaluate=vi.spyOn(engine,'evaluate');
 try{const html=renderToStaticMarkup(createElement(SheetChoicesContext.Provider,{value:snapshot},createElement(HitPointEditor,{c:next,edit:()=>{}})));expect(html).toContain('当前生命值上限');expect(evaluate).not.toHaveBeenCalled();}finally{evaluate.mockRestore();}
});

it('independent mutable previews keep their current calculation path and never get a permanent object cache',()=>{
 const c=newCharacter(),evaluate=vi.spyOn(engine,'evaluate');
 try{renderToStaticMarkup(createElement(HitPointEditor,{c,edit:()=>{}}));c.baseHp=11;const html=renderToStaticMarkup(createElement(HitPointEditor,{c,edit:()=>{}}));expect(evaluate).toHaveBeenCalledTimes(2);expect(html).toContain('11');}finally{evaluate.mockRestore();}
});

it('a changed mechanical field cannot borrow the cached numbers',()=>{
 const c=newCharacter(),derived=engine.evaluate(c),snapshot={character:c,catalog:[],choices:[],derived},evaluate=vi.spyOn(engine,'evaluate');
 try{const next={...c,baseHp:13};const html=renderToStaticMarkup(createElement(SheetChoicesContext.Provider,{value:snapshot},createElement(HitPointEditor,{c:next,edit:()=>{}})));expect(evaluate).toHaveBeenCalledTimes(1);expect(html).toContain('13');}finally{evaluate.mockRestore();}
});

it.each(['id','edition','profile','futureRule'] as const)('a changed %s cannot borrow another immutable view',key=>{
 const c=newCharacter(),derived=engine.evaluate(c),snapshot={character:c,catalog:[],choices:[],derived},evaluate=vi.spyOn(engine,'evaluate');
 const next={...c};
 if(key==='id')next.id='another-card';
 else if(key==='edition')next.edition=c.edition==='2024'?'2014':'2024';
 else if(key==='profile')next.profile={...c.profile,enabledSources:[]};
 else (next as unknown as Record<string,unknown>).futureRule={enabled:true};
 try{renderToStaticMarkup(createElement(SheetChoicesContext.Provider,{value:snapshot},createElement(HitPointEditor,{c:next,edit:()=>{}})));expect(evaluate).toHaveBeenCalledTimes(1);expect(evaluate).toHaveBeenCalledWith(next);}finally{evaluate.mockRestore();}
});

it('a legacy choice-only snapshot still computes its current numeric values',()=>{
 const c=newCharacter(),snapshot={character:c,catalog:[],choices:[]},evaluate=vi.spyOn(engine,'evaluate');
 try{renderToStaticMarkup(createElement(SheetChoicesContext.Provider,{value:snapshot},createElement(HitPointEditor,{c,edit:()=>{}})));expect(evaluate).toHaveBeenCalledTimes(1);}finally{evaluate.mockRestore();}
});
