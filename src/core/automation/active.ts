import {irSelectionActive} from './ir';
import {selectionAllowed,type Character,type Selection} from '../model';

/** A missing, disabled or cyclic parent never leaves a child rule active. */
export function activeSelections(c:Character):Selection[]{
 return c.selections.filter(row=>irSelectionActive(c,row));
}
