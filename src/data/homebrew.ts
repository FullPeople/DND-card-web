import type {Raw} from '../core/model';

export const DEFAULT_HOMEBREW='https://homebrew.kiwee.top';
/** Source indexes can alias several books to one collection. Never fetch it twice. */
export function homebrewPaths(index:Raw):string[]{
 return [...new Set(Object.values(index).filter((v):v is string=>typeof v==='string'&&v.endsWith('.json')&&!/^[a-z]+:|^[\\/]|[?#\\]/i.test(v)&&!v.split('/').some(p=>p==='..'||p==='.'||!p)))];
}
export function homebrewMetadata(body:Raw):Record<string,{name:string;date?:string}>{
 return Object.fromEntries((Array.isArray(body._meta?.sources)?body._meta.sources:[]).filter((s:Raw)=>typeof s.json==='string').map((s:Raw)=>[s.json.toUpperCase(),{name:String(s.full||s.abbreviation||s.json),date:s.dateReleased||undefined}]));
}
/** Edition can belong to the whole brew rather than every individual record. */
export function homebrewBody(body:Raw):Raw{
 const edition=body._meta?.edition;
 return Object.fromEntries(Object.entries(body).map(([key,value])=>[key,Array.isArray(value)?value.map(raw=>raw&&typeof raw==='object'?{...raw,edition:raw.edition||edition,_homebrew:true}:raw):value]));
}
