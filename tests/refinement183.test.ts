import {describe,it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {candidateReason} from '../src/core/engine';
import {spellState} from '../src/core/characterDetails';
import {prepareSpellEntry} from '../src/core/spells';
import {pinEntry,removePin} from '../src/core/quickbar';
import {preparationFormula} from '../src/core/preparation';
import {validateCharacter} from '../src/core/validation';
const e=(kind:Entry['kind'],name:string,raw:Entry['raw']={}):Entry=>({id:name,kind,name,english:name,source:'PHB',edition:'2014',packId:'test',revision:'1',entries:[],raw});
describe('183 prepared data and independent shortcuts',()=>{
 it('uses formula and progression limits, respects adjustment, refuses excess without adding a selection',()=>{const c=newCharacter('2014');c.abilities.int=16;c.selections.push({id:'caster',entry:e('class','caster',{spellcastingAbility:'int',casterProgression:'full',preparedSpells:'<$level$> + <$int_mod$>'}),level:2,quantity:1,equipped:false});expect(spellState(c).capacity).toBe(5);for(let i=0;i<5;i++)expect(prepareSpellEntry(c,e('spell','spell'+i,{level:1}))).toBeTruthy();expect(prepareSpellEntry(c,e('spell','overflow',{level:1}))).toBeUndefined();expect(c.selections.some(s=>s.entry.id==='overflow')).toBe(false);c.selections[0].level=3;expect(spellState(c).capacity).toBe(6);c.spellSettings!.capacityAdjustment=-1;expect(spellState(c).capacity).toBe(5);c.selections[0].entry.raw.preparedSpellsProgression=[4,5,8];expect(spellState(c).capacity).toBe(7);});
 it('safe formula supports fractions and rejects executable expressions',()=>{expect(preparationFormula('floor(<$level$> / 2) + <$wis_mod$>',{level:5,wis_mod:3})).toBe(5);expect(preparationFormula('alert(1)',{})).toBeUndefined();expect(preparationFormula('1/0',{})).toBeUndefined();});
 it('quickbar copies any kind without granting it, survives validation and removes independently',()=>{const c=newCharacter();const entry=e('class','reference');pinEntry(c,entry);pinEntry(c,entry);expect(c.selections).toHaveLength(0);expect(c.quickbarCopies).toHaveLength(1);entry.name='changed upstream';expect(c.quickbarCopies![0].entry.name).toBe('reference');const copy=validateCharacter(c);removePin(copy,copy.quickbarCopies![0].id);expect(copy.quickbarCopies).toHaveLength(0);expect(c.quickbarCopies).toHaveLength(1);});
 it('2014 permits a SCAG inherited subrace and every enabled expansion regardless of edition tag',()=>{for(const edition of ['2014','2024'] as const){const c=newCharacter(edition);c.profile.enabledSources.push('SCAG');const [entry]=normalizeData({subrace:[{name:'鬼智',ENG_name:'Ghostwise',source:'SCAG',raceName:'半身人',raceSource:'PHB',edition:'one'}]},'test');expect(candidateReason(c,entry)).toBeUndefined();} });
});
