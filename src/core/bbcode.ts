export type BbNode=string|{tag:string;value?:string;children:BbNode[]};
const tags=new Set(['b','i','u','s','h1','h2','h3','quote','code','list','*','url','color','size','center','br']);
export function parseBbcode(text:string):BbNode[]{
 const root:BbNode[]=[],stack:{tag:string;children:BbNode[]}[]=[{tag:'root',children:root}];
 const tokens=text.split(/(\[\/?(?:b|i|u|s|h[123]|quote|code|list|\*|url|color|size|center|br)(?:=[^\]\r\n]{0,500})?\])/gi);
 for(const token of tokens){if(!token)continue;const match=/^\[(\/)?([a-z1-3*]+)(?:=(.*))?\]$/i.exec(token),parent=stack.at(-1)!;
  if(!match||!tags.has(match[2].toLowerCase())||(parent.tag==='code'&&token.toLowerCase()!=='[/code]')){parent.children.push(token);continue;}
  const [,closing,name,value]=match,tag=name.toLowerCase();
  if(closing){let at=stack.length-1;while(at>0&&stack[at].tag!==tag)at--;if(at>0)stack.length=at;else parent.children.push(token);continue;}
  if(tag==='*'){if(parent.tag==='*')stack.pop();if(stack.at(-1)?.tag!=='list'){stack.at(-1)!.children.push(token);continue;}}
  if(stack.length>32){parent.children.push(token);continue;}
  const node={tag,value,children:[] as BbNode[]};stack.at(-1)!.children.push(node);if(tag!=='br')stack.push(node);
 }
 return root;
}
export function bbUrl(value:string){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:undefined;}catch{return undefined;}}
