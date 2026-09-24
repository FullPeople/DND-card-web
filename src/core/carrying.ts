import type {Character,Derived} from './model';
/** Arithmetic only: no JavaScript, property access or executable expressions. */
export function capacityFormula(text:string,base:number,strength:number):number{
 let source=text.trim().replace(/基础|base/gi,String(base)).replace(/力量|str/gi,String(strength)).replace(/[×x]/g,'*').replace(/÷/g,'/');
 if(!source)return base;if(/^[+*/]/.test(source)||/^-[0-9.]/.test(source))source=String(base)+source;
 if(source.length>180||/[^\d.\s()+*/-]/.test(source))throw Error('请输入数字、基础、力量和四则运算');
 const tokens=source.match(/\d+(?:\.\d+)?|\.\d+|[()+*/-]/g)||[];let cursor=0;
 function atom():number{const token=tokens[cursor++];if(token==='+'||token==='-')return (token==='-'?-1:1)*atom();if(token==='('){const n=sum();if(tokens[cursor++]!==')')throw Error('括号不完整');return n;}if(!token||!/^\d|^\./.test(token))throw Error('公式不完整');return Number(token);}
 function product(){let n=atom();while(['*','/'].includes(tokens[cursor])){const op=tokens[cursor++],v=atom();n=op==='*'?n*v:n/v;}return n;}
 function sum(){let n=product();while(['+','-'].includes(tokens[cursor])){const op=tokens[cursor++],v=product();n=op==='+'?n+v:n-v;}return n;}
 const value=sum();if(cursor!==tokens.length||!Number.isFinite(value)||value<0||value>1e9)throw Error('负重上限必须在 0 到 10 亿磅之间');return value;
}
export function carrying(c:Character,d:Derived){const size=c.size||'M',strength=d.abilities.str,base=strength*({T:7.5,S:15,M:15,L:30,H:60,G:120}[size]||15);return {base,strength,max:capacityFormula(c.inventory?.capacityAdjustment||'',base,strength)};}
