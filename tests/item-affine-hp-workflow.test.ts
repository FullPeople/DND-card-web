import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {removeSelection} from '../src/core/sheet';
import {equipSelection} from '../src/core/automation/equipment';
import {ITEM_AFFINE_HP_ANSWER_KEY,itemAffineHpOffer,itemAffineHpRequest,itemAffineHpRequestFingerprint,itemAffineHpReceipt,performItemAffineHpAction,projectItemAffineHp} from '../src/core/automation/itemAffineHp';
import type {Character} from '../src/core/model';
import {itemAffineHpFixture} from './helpers/itemAffineHpFlowFixture';
import {itemAffineHpSpecs,itemAffineHpSourceEvidence,itemAffineHpSnapshot as snapshot} from './helpers/itemAffineHpSourceFixture';

beforeAll(()=>{itemAffineHpSourceEvidence();},30000);
const authority={canEdit:true,gm:false},ackKey=ITEM_AFFINE_HP_ANSWER_KEY;
const preserved=(c:Character)=>{const copy=structuredClone(c);delete copy.answers[ackKey];return snapshot(copy);};
function act(c:Character,selectionId:string,kind:'confirm'|'withdraw'){
 const request=itemAffineHpRequest(c,selectionId,crypto.randomUUID(),kind==='confirm'?{kind,confirmedManualHpExcluded:true}:{kind}),before=preserved(c);
 expect(performItemAffineHpAction(c,request,authority).status).toBe('applied');expect(preserved(c)).toBe(before);
 expect(itemAffineHpReceipt(c,request.id)).toEqual({id:request.id,sequence:request.sequence,selectionId,kind,fingerprint:itemAffineHpRequestFingerprint(request)});return request;
}
function unchangedRuntime(c:Character){expect(c.runtime.hp).toBe(7);expect(c.runtime.tempHp).toBe(2);expect(c.runtime.resources.manual.current).toBe(1);}

it('all 15 actual canonical and cold-App item owners need explicit exclusion consent before the real engine derives maximum HP, then native export/reopen and withdrawal preserve every other field',()=>{
 expect(itemAffineHpSpecs).toHaveLength(15);
 for(const form of ['canonical','app']as const)for(const spec of itemAffineHpSpecs){const f=itemAffineHpFixture(spec.key,form),manual=preserved(f.c),before=snapshot(f.c);expect(itemAffineHpOffer(f.c,f.owner.id,authority)?.confirmed).toBe(false);expect(evaluate(f.c).maxHp).toBe(42);expect(snapshot(f.c)).toBe(before);
  const request=act(f.c,f.owner.id,'confirm'),bonus=f.rule.constant+7;expect(evaluate(f.c).maxHp).toBe(42+bonus);expect(projectItemAffineHp(f.c).bonus).toBe(bonus);expect(preserved(f.c)).toBe(manual);const saved=snapshot(f.c),reopened=readCharacter(exportCharacter(f.c)).character;expect(snapshot(reopened)).toBe(saved);expect(evaluate(reopened).maxHp).toBe(42+bonus);expect(snapshot(reopened)).toBe(saved);expect(itemAffineHpReceipt(reopened,request.id)?.fingerprint).toBe(itemAffineHpRequestFingerprint(request));act(reopened,f.owner.id,'withdraw');expect(evaluate(reopened).maxHp).toBe(42);expect(preserved(reopened)).toBe(manual);const withdrawn=snapshot(reopened);expect(snapshot(readCharacter(exportCharacter(reopened)).character)).toBe(withdrawn);expect(itemAffineHpOffer(reopened,f.owner.id,authority)?.withdrawn).toBe(true);act(reopened,f.owner.id,'confirm');expect(evaluate(reopened).maxHp).toBe(42+bonus);expect(preserved(reopened)).toBe(manual);unchangedRuntime(reopened);
 }
});

it('axe attunement-only and actual armor wear conditions pause without writing new consent; exact restoration and current total-level growth rederive without healing',()=>{
 for(const key of ['14:72','15:73','named:2316','33:59','34:59']){const f=itemAffineHpFixture(key);act(f.c,f.owner.id,'confirm');const consent=f.c.answers[ackKey][0],bonus=f.rule.constant+7;
  equipSelection(f.c,f.owner.id,false);expect(evaluate(f.c).maxHp).toBe(f.rule.sourceCondition==='attuned-only'?42+bonus:42);expect(f.c.answers[ackKey][0]).toBe(consent);equipSelection(f.c,f.owner.id,true);expect(evaluate(f.c).maxHp).toBe(42+bonus);
  f.owner.attuned=false;expect(evaluate(f.c).maxHp).toBe(42);f.owner.attuned=true;expect(evaluate(f.c).maxHp).toBe(42+bonus);const sources=[...f.c.profile.enabledSources];f.c.profile.enabledSources=[];expect(evaluate(f.c).maxHp).toBe(42);f.c.profile.enabledSources=sources;expect(evaluate(f.c).maxHp).toBe(42+bonus);f.classOwner.level=4;f.owner.level=20;expect(evaluate(f.c).level).toBe(8);expect(evaluate(f.c).maxHp).toBe(43+bonus);expect(f.c.answers[ackKey][0]).toBe(consent);unchangedRuntime(f.c);
 }
});

it('changed manual base or offset requires fresh explicit consent, final-value overrides stay additive-held, and withdrawal or a new physical UID cannot silently reuse confirmation',()=>{
 for(const mode of ['base','offset','final']as const){const f=itemAffineHpFixture('33:59');act(f.c,f.owner.id,'confirm');if(mode==='base')f.c.baseHp=41;if(mode==='offset')f.c.sheetBonuses!.hp=3;if(mode==='final')f.c.adjustments=[{id:'authored-final-hp',target:'hp',value:90,reason:'Authored retained final HP'}];const before=snapshot(f.c);expect(projectItemAffineHp(f.c).bonus).toBe(0);expect(evaluate(f.c).maxHp).toBe(mode==='final'?92:43);expect(snapshot(f.c)).toBe(before);if(mode==='final')expect(itemAffineHpOffer(f.c,f.owner.id,authority)?.canConfirm).toBe(false);else{act(f.c,f.owner.id,'confirm');expect(evaluate(f.c).maxHp).toBe(60);}unchangedRuntime(f.c);}
 const f=itemAffineHpFixture();act(f.c,f.owner.id,'confirm');act(f.c,f.owner.id,'withdraw');const old=structuredClone(f.owner),answer=f.c.answers[ackKey][0];removeSelection(f.c,f.owner.id);f.c.selections.push({...old,id:'authored-new-physical-item'});expect(evaluate(f.c).maxHp).toBe(42);expect(itemAffineHpOffer(f.c,'authored-new-physical-item',authority)?.confirmed).toBe(false);expect(f.c.answers[ackKey][0]).toBe(answer);act(f.c,'authored-new-physical-item','confirm');expect(evaluate(f.c).maxHp).toBe(49);unchangedRuntime(f.c);
});
