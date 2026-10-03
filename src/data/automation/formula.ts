type Node = { type: 'number'; value: number } | { type: 'variable'; name: string } | { type: 'unary'; op: '+' | '-'; value: Node } | { type: 'binary'; op: string; left: Node; right: Node } | { type: 'call'; name: string; args: Node[] };
export interface Formula { ast: Node; variables: string[]; dice: boolean }
const variable = /^@(?:class\.level|classes\.[a-zA-Z0-9_-]+\.levels|details\.level|prof|abilities\.(?:str|dex|con|int|wis|cha)\.mod|scale\.[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)$/;
/** Parse arithmetic, dice and a fixed set of numeric functions; never eval code. */
export function parseFormula(source: string): Formula {
  if (typeof source !== 'string' || !source.trim() || source.length > 160) throw Error('Invalid formula length');
  const tokens: string[] = [], variables = new Set<string>(); let cursor = 0, depth = 0, dice = false;
  while (cursor < source.length) {
    const text = source.slice(cursor);
    if (/^\s/.test(text)) { cursor++; continue; }
    const token = /^(?:\d+(?:\.\d+)?|@(?:class\.level|classes\.[a-zA-Z0-9_-]+\.levels|details\.level|prof|abilities\.(?:str|dex|con|int|wis|cha)\.mod|scale\.[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)|(?:floor|ceil|min|max)\b|[dD+*/(),-])/.exec(text)?.[0];
    if (!token) throw Error(`Unexpected formula token at ${cursor}`);
    if (token.startsWith('@')) { if (!variable.test(token)) throw Error(`Unknown formula variable ${token}`); variables.add(token); }
    tokens.push(token); cursor += token.length;
  }
  if (tokens.length > 120) throw Error('Formula too complex');
  let index = 0;
  function primary(): Node {
    if (++depth > 24) throw Error('Formula nesting too deep');
    const token = tokens[index++]; let result: Node;
    if (token === '+' || token === '-') result = { type: 'unary', op: token, value: primary() };
    else if (token === '(') { result = expression(0); if (tokens[index++] !== ')') throw Error('Unclosed formula group'); }
    else if (['floor', 'ceil', 'min', 'max'].includes(token)) {
      if (tokens[index++] !== '(') throw Error('Function requires parentheses');
      const args = [expression(0)]; while (tokens[index] === ',') { index++; args.push(expression(0)); }
      if (tokens[index++] !== ')' || (['floor', 'ceil'].includes(token) ? args.length !== 1 : args.length < 2 || args.length > 8)) throw Error('Invalid function arguments');
      result = { type: 'call', name: token, args };
    } else if (token?.startsWith('@')) result = { type: 'variable', name: token };
    else if (token !== undefined && /^\d/.test(token)) { const value = Number(token); if (!Number.isFinite(value) || value > 1000000) throw Error('Numeric literal too large'); result = { type: 'number', value }; }
    else throw Error('Expected formula operand');
    depth--; return result;
  }
  function expression(minimum: number): Node {
    let left = primary(); const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, d: 3, D: 3 };
    while (tokens[index] in precedence && precedence[tokens[index]] >= minimum) {
      const op = tokens[index++]; const right = expression(precedence[op] + 1);
      if (op.toLowerCase() === 'd') { if (left.type !== 'number' || right.type !== 'number' || !Number.isInteger(left.value) || !Number.isInteger(right.value) || left.value < 1 || left.value > 100 || right.value < 2 || right.value > 1000) throw Error('Invalid dice expression'); dice = true; }
      left = { type: 'binary', op, left, right };
    }
    return left;
  }
  const ast = expression(0); if (index !== tokens.length) throw Error('Unexpected trailing formula input');
  return { ast, variables: [...variables].sort(), dice };
}
export function evaluateFormula(source: string, values: Readonly<Record<string, number>>): number {
  const formula = parseFormula(source); if (formula.dice) throw Error('Dice require an explicit roll');
  const walk = (node: Node): number => {
    if (node.type === 'number') return node.value;
    if (node.type === 'variable') { if (!Object.hasOwn(values, node.name) || !Number.isFinite(values[node.name])) throw Error(`Unresolved formula variable ${node.name}`); return values[node.name]; }
    if (node.type === 'unary') return (node.op === '-' ? -1 : 1) * walk(node.value);
    if (node.type === 'call') { const args = node.args.map(walk); return node.name === 'floor' ? Math.floor(args[0]) : node.name === 'ceil' ? Math.ceil(args[0]) : node.name === 'min' ? Math.min(...args) : Math.max(...args); }
    const left = walk(node.left), right = walk(node.right); if (node.op === '/' && right === 0) throw Error('Formula division by zero');
    return node.op === '+' ? left + right : node.op === '-' ? left - right : node.op === '*' ? left * right : left / right;
  };
  const result = walk(formula.ast); if (!Number.isFinite(result) || Math.abs(result) > 1000000000) throw Error('Formula result out of bounds'); return result;
}
