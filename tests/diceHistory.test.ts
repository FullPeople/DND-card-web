import {it,expect} from 'vitest';
import {boundedDiceHistory} from '../src/platform/diceHistory';
const row=(n:number,hidden=false)=>({rollId:'r'+n,ts:n,total:n,dice:[],hidden});
it('bounds a host snapshot at 100 latest valid unique dice results',()=>{
 const rows=boundedDiceHistory([null,row(10),...Array.from({length:201},(_,i)=>row(i)),{...row(900),dice:null}]);
 expect(rows).toHaveLength(100);expect(rows[0].rollId).toBe('r200');expect(rows[99].rollId).toBe('r101');
});
it('a revealed result wins over a duplicate private result in either arrival order',()=>{
 expect(boundedDiceHistory([row(1,true),row(1)])[0].hidden).toBe(false);
 expect(boundedDiceHistory([row(1),row(1,true)])[0].hidden).toBe(false);
 expect(boundedDiceHistory(undefined)).toEqual([]);
});
