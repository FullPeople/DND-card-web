import {parseAst} from 'vite';

export interface ClassFilterSourceMetadata {
 schemaVersion:1;
 abbreviations:Record<string,string>;
 nonstandardSources:string[];
 nonstandardPrefixes:string[];
}
export interface DeclaredClassFilterSource {abbreviations:string[]}
/** Retain source registrations and conflicts separately from every rule snapshot. */
export function extractDeclaredClassFilterSources(bodies:readonly unknown[]):Record<string,DeclaredClassFilterSource>{
 const plain=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const sources=new Map<string,Set<string>>();
 for(const body of bodies){
  if(!plain(body)||!plain(body._meta)||body._meta.sources===undefined)continue;
  if(!Array.isArray(body._meta.sources))throw Error('Invalid source registration metadata');
  for(const row of body._meta.sources){
   if(!plain(row)||typeof row.json!=='string'||row.json.length>80||!/^[a-z0-9][a-z0-9_.:&-]*(?: [a-z0-9_.:&-]+)*$/i.test(row.json))throw Error('Invalid source registration ID');
   const id=row.json.toUpperCase(),values=sources.get(id)||new Set<string>();
   if(row.abbreviation!==undefined){
    if(typeof row.abbreviation!=='string'||!row.abbreviation.trim()||row.abbreviation.length>80||/[\r\n\0]/.test(row.abbreviation))throw Error('Invalid source registration abbreviation');
    values.add(row.abbreviation);
   }
   sources.set(id,values);
  }
 }
 return Object.fromEntries([...sources].sort(([a],[b])=>a.localeCompare(b,'en')).map(([id,values])=>[id,{abbreviations:[...values].sort((a,b)=>a.localeCompare(b,'en'))}]));
}
type AstNode={type:string;[key:string]:unknown};
const kind=(value:unknown,type:string):value is AstNode=>!!value&&typeof value==='object'&&(value as AstNode).type===type;
const identifier=(value:unknown,name:string)=>kind(value,'Identifier')&&value.name===name;
function parserProperty(value:unknown):string|undefined{
 if(!kind(value,'MemberExpression')||value.computed||value.optional||!identifier(value.object,'Parser')||!kind(value.property,'Identifier'))return;
 return typeof value.property.name==='string'?value.property.name:undefined;
}
/** Read only static source metadata; never execute the upstream JavaScript. */
export function extractClassFilterSourceMetadata(code:string):ClassFilterSourceMetadata{
 let statements:unknown[];try{statements=parseAst(code).body;}catch{throw Error('Invalid primary metadata syntax');}
 const constants=new Map<string,string>(),abbreviations=new Map<string,string>();let initialized=false,nonstandard:string[]|undefined;
 function scalar(node:unknown):string{
  if(kind(node,'Literal')&&typeof node.value==='string')return node.value;
  const property=parserProperty(node);if(property&&constants.has(property))return constants.get(property)!;
  if(kind(node,'BinaryExpression')&&node.operator==='+')return scalar(node.left)+scalar(node.right);
  if(kind(node,'TemplateLiteral')&&Array.isArray(node.quasis)&&Array.isArray(node.expressions)&&node.quasis.length===node.expressions.length+1){
   const expressions=node.expressions;return node.quasis.map((part:unknown,index:number)=>{
    if(!kind(part,'TemplateElement')||!part.value||typeof part.value!=='object'||typeof (part.value as {cooked?:unknown}).cooked!=='string')throw Error('Source metadata must use declared static strings');
    return (part.value as {cooked:string}).cooked+(index<expressions.length?scalar(expressions[index]):'');
   }).join('');
  }
  if(kind(node,'MemberExpression')&&node.computed&&!node.optional&&parserProperty(node.object)==='SOURCE_JSON_TO_ABV'){const value=abbreviations.get(scalar(node.property));if(value!==undefined)return value;}
  throw Error('Source metadata must use declared static strings');
 }
 for(const statement of statements){
  if(!kind(statement,'ExpressionStatement')||!kind(statement.expression,'AssignmentExpression')||statement.expression.operator!=='=')continue;
  const {left,right}=statement.expression,property=parserProperty(left);
  if(property?.startsWith('SRC_')){
   const value=scalar(right);if(constants.has(property)&&constants.get(property)!==value)throw Error('Source constant was redefined');constants.set(property,value);
  }else if(property==='SOURCE_JSON_TO_ABV'){
   if(initialized||!kind(right,'ObjectExpression')||!Array.isArray(right.properties)||right.properties.length)throw Error('Source abbreviation table must start empty once');initialized=true;
  }else if(kind(left,'MemberExpression')&&left.computed&&!left.optional&&parserProperty(left.object)==='SOURCE_JSON_TO_ABV'){
   if(!initialized)throw Error('Source abbreviation table was not initialized');const source=scalar(left.property),value=scalar(right);
   if(!source.trim()||source.length>80||!value.trim()||value.length>80||/[\r\n\0]/.test(source+value))throw Error('Invalid source metadata string');
   if(abbreviations.has(source)&&abbreviations.get(source)!==value)throw Error('Source abbreviation was redefined');abbreviations.set(source,value);
  }else if(property==='SOURCES_NON_STANDARD_WOTC'){
   if(nonstandard||!kind(right,'NewExpression')||!identifier(right.callee,'Set')||!Array.isArray(right.arguments)||right.arguments.length!==1||!kind(right.arguments[0],'ArrayExpression')||!Array.isArray(right.arguments[0].elements))throw Error('Nonstandard sources require one static Set');
   nonstandard=right.arguments[0].elements.map(element=>scalar(element));
  }
 }
 if(!initialized||!abbreviations.size||!nonstandard)throw Error('Incomplete class-filter source metadata');
 const canonical=new Map<string,string>();for(const [source,value]of abbreviations){const id=source.toUpperCase();if(canonical.has(id)&&canonical.get(id)!==value)throw Error('Case-colliding source abbreviations');canonical.set(id,value);}
 const prefixes=['SRC_UA_PREFIX','SRC_UA_ONE_PREFIX','SRC_PS_PREFIX','SRC_MCVX_PREFIX'].map(name=>{const value=constants.get(name);if(!value?.trim())throw Error('Missing nonstandard source prefix');return value.toUpperCase();});
 const sourceIds=[...new Set(nonstandard.map(source=>source.toUpperCase()))].sort();if(sourceIds.some(id=>!canonical.has(id)))throw Error('Nonstandard source has no abbreviation');
 return {schemaVersion:1,abbreviations:Object.fromEntries([...canonical].sort(([a],[b])=>a.localeCompare(b,'en'))),nonstandardSources:sourceIds,nonstandardPrefixes:[...new Set(prefixes)].sort()};
}
