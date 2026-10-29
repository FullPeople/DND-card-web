import {afterEach,expect,it,vi} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import * as engine from '../src/core/engine';
import {sourceClassChoices} from '../src/core/automation/sourceClassChoices';

afterEach(()=>vi.restoreAllMocks());
it('evaluates one unchanged choice view once and rechecks changed abilities and sources on every new call',()=>{
 const entries=normalizeData({class:[{name:'Authored owner',source:'PHB',optionalfeatureProgression:[{name:'Authored choices',featureType:['AUTHORED'],progression:{1:1}}]}],optionalfeature:Array.from({length:32},(_,index)=>({name:`Authored option ${index}`,source:'PHB',featureType:['AUTHORED'],prerequisite:[{ability:[{str:13}]}],entries:['Authored prerequisite sentinel.']}))},'authored-evaluation-scope');
 const c=newCharacter('2014');c.automation=newAutomationState();c.abilities.str=12;c.runtime.hp=7;c.runtime.resources.manual={name:'Authored resource',max:5,current:2};c.selections=[{id:'owner',entry:entries.find(entry=>entry.kind==='class')!,level:1,quantity:1,equipped:false}];
 const derive=vi.spyOn(engine,'evaluate'),before=JSON.stringify(c);
 const low=sourceClassChoices(c,entries)[0];expect(low.options).toHaveLength(32);expect(low.options.every(option=>!!option.unavailable)).toBe(true);expect(JSON.stringify(c)).toBe(before);expect(derive).toHaveBeenCalledTimes(1);
 derive.mockClear();c.abilities.str=13;const ready=JSON.stringify(c),high=sourceClassChoices(c,entries)[0];expect(high.options.every(option=>!option.unavailable)).toBe(true);expect(JSON.stringify(c)).toBe(ready);expect(derive).toHaveBeenCalledTimes(1);
 derive.mockClear();c.profile.enabledSources=[];const held=JSON.stringify(c);expect(sourceClassChoices(c,entries)[0].options.every(option=>!!option.unavailable)).toBe(true);expect(JSON.stringify(c)).toBe(held);expect(derive).not.toHaveBeenCalled();
});
