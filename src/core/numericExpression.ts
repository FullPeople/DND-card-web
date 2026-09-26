/** A deliberately small arithmetic grammar. It never executes JavaScript. */
export function numericExpression(input: string, current: number): {value:number;relative:boolean} {
  const source=input.trim();
  if(!source||source.length>160)throw new Error('请输入不超过 160 字的数值或算式。');
  const absolute=source.startsWith('='),relative=!absolute&&/^[+\-*/]/.test(source);
  const expression=absolute?source.slice(1):relative?`(${current})${source}`:source;
  const tokens=expression.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/]/g)||[];
  if(expression.replace(/\s/g,'')!==tokens.join(''))throw new Error('仅支持数字、括号和 + - * /，绝对负数请以 = 开头。');
  let at=0;
  function atom(depth:number):number {
    if(depth>24)throw new Error('算式括号嵌套过深。');
    const token=tokens[at++];
    if(token==='+'||token==='-')return (token==='-'?-1:1)*atom(depth+1);
    if(token==='('){const n=sum(depth+1);if(tokens[at++]!==')')throw new Error('算式括号不完整。');return n;}
    if(token===undefined||!/^\d|^\.\d/.test(token))throw new Error('算式缺少数字。');
    return Number(token);
  }
  function product(depth:number):number {let n=atom(depth);while(tokens[at]==='*'||tokens[at]==='/'){const op=tokens[at++],r=atom(depth);if(op==='/'&&r===0)throw new Error('不能除以零。');n=op==='*'?n*r:n/r;}return n;}
  function sum(depth:number):number {let n=product(depth);while(tokens[at]==='+'||tokens[at]==='-'){const op=tokens[at++],r=product(depth);n=op==='+'?n+r:n-r;}return n;}
  const value=sum(0);
  if(at!==tokens.length||!Number.isFinite(value)||Math.abs(value)>1e9)throw new Error('算式结果无效或超出范围。');
  return {value,relative};
}
