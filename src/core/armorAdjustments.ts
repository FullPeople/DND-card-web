import {evaluate} from './engine';
import type {Character} from './model';

/** Old final-value records are retained until the player chooses how to retire
 * them. Neither reading a card nor a scene echo guesses its historical base. */
export function armorAdjustmentReview(c:Character){
 const records=(c.adjustments||[]).filter(row=>row.target==='ac');
 const ruleTotal=evaluate({...c,adjustments:(c.adjustments||[]).filter(row=>row.target!=='ac'),sheetBonuses:{...c.sheetBonuses,ac:0}}).ac;
 const previousBonus=c.sheetBonuses?.ac||0,previousTotal=evaluate(c).ac;
 return {records,ruleTotal,previousBonus,previousTotal,convertedBonus:previousTotal-ruleTotal};
}

/** Called only by an explicit recovery action; retrying after resolution is a
 * no-op. Preserve the original evidence independently of the editable offset. */
export function resolveLegacyArmorAdjustments(c:Character,action:'restore'|'convert'){
 const review=armorAdjustmentReview(c);if(!review.records.length)return;
 const resultingBonus=action==='convert'?review.convertedBonus:review.previousBonus;
 if(!Number.isFinite(resultingBonus)||Math.abs(resultingBonus)>9999)throw Error('护甲调整值超出范围，请恢复规则计算后重新核对。');
 (c.armorAdjustmentHistory||=[]).push({version:1,action,records:structuredClone(review.records),previousBonus:review.previousBonus,previousTotal:review.previousTotal,ruleTotal:review.ruleTotal,resultingBonus});
 c.adjustments=(c.adjustments||[]).filter(row=>row.target!=='ac');
 c.sheetBonuses={...c.sheetBonuses,ac:resultingBonus};
}
