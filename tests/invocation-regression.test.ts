import {expect,it} from 'vitest';
import {sheetChoices} from '../src/core/automation/choices';
import {planSourceSpells} from '../src/core/automation/sourceSpells';
import {evaluate} from '../src/core/engine';

import {invocationFixture,learn} from './fixtures/invocationFixture';

it('learning reviewed PHB Beguiling Influence grants both skills without manual toggles',()=>{
 const {c,entries,find}=invocationFixture();learn(c,entries,find('Beguiling Influence'));expect(evaluate(c).skills.deception.proficient).toBe(true);expect(evaluate(c).skills.persuasion.proficient).toBe(true);expect(c.proficiencies).toBeUndefined();
});
it.each(['Eldritch Sight','Armor of Shadows'])('learning %s grants only its reviewed at-will spell qualification',name=>{
 const {c,entries,find}=invocationFixture();learn(c,entries,find(name));expect(sheetChoices(c,entries).find(row=>row.id==='warlock:class-optional:0')?.selected).toContain(find(name).id);
 const grants=planSourceSpells(c,entries).grants;expect(grants).toHaveLength(1);expect(grants[0].config.sourceGrant).toMatchObject({usage:'free',active:true,canUseSlots:false,ability:'cha'});expect(evaluate(c).ac).toBe(10);
});
it('manual bare innate metadata keeps check usage without a source-owned learning grant',()=>{
 const {c,entries,find}=invocationFixture();c.selections.push({id:'manual-invocation',entry:find('Eldritch Sight'),quantity:1,level:1,equipped:false});expect(planSourceSpells(c,entries).grants[0].config.sourceGrant?.usage).toBe('check');
});
