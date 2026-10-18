export type LocalRollGroup={sign:number;sides:number;values:number[]};
export type LocalRollResult={formula:string;total:number;groups:LocalRollGroup[];modifier:number};
/** Validate the complete expression before asking for any random values. */
export function localRoll(expression:string,face:(sides:number)=>number):LocalRollResult{
 const formula=expression.replace(/\s/g,'').toLowerCase();
 if(!formula||formula.length>1000||!/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/.test(formula))throw Error('支持 1d20+5、2d6+3 等骰子表达式');
 let count=0,modifier=0;
 const terms=(formula.match(/[+-]?[^+-]+/g)||[]).map(part=>{
  const sign=part.startsWith('-')?-1:1,plain=part.replace(/^[+-]/,'');
  if(!plain.includes('d')){const value=Number(plain);if(!Number.isSafeInteger(value))throw Error('调整值超出范围');modifier+=sign*value;if(!Number.isSafeInteger(modifier))throw Error('调整值超出范围');return undefined;}
  const [amount,sides]=plain.split('d').map(Number),n=plain.startsWith('d')?1:amount;
  if(!Number.isSafeInteger(n)||!Number.isSafeInteger(sides)||n<1||sides<1||sides>10000||(count+=n)>100)throw Error('每次最多 100 枚骰子，面数为 1～10000');
  return {sign,sides,count:n};
 }).filter((term):term is {sign:number;sides:number;count:number}=>!!term);
 if(!Number.isSafeInteger(modifier)||Math.abs(modifier)>Number.MAX_SAFE_INTEGER-1000000)throw Error('调整值超出范围');
 const groups=terms.map(term=>({sign:term.sign,sides:term.sides,values:Array.from({length:term.count},()=>{const value=face(term.sides);if(!Number.isInteger(value)||value<1||value>term.sides)throw Error('骰子结果无效');return value;})}));
 return {formula,modifier,groups,total:modifier+groups.reduce((sum,group)=>sum+group.sign*group.values.reduce((a,b)=>a+b,0),0)};
}
export function randomLocalFace(sides:number){
 const buffer=new Uint32Array(1),limit=Math.floor(4294967296/sides)*sides;
 do{crypto.getRandomValues(buffer);}while(buffer[0]>=limit);
 return buffer[0]%sides+1;
}
