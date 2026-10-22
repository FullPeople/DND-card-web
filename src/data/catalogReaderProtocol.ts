import type {Entry} from '../core/model';
import type {SourceMeta} from '../core/sourceCatalog';
import type {LoadProgress} from './catalog';

export type CatalogReadRequest={type:'load';refresh:boolean;base:string;retryKeys:readonly string[]};
export type CatalogReadResponse={type:'batch';sequence:number;buffer:ArrayBuffer}|{type:'progress';value:LoadProgress}|{type:'sources';value:Record<string,SourceMeta>}|{type:'done'}|{type:'error';message:string};

/** Entries and source snapshots are JSON data. Encode off the page thread to
 * avoid a large structured clone on every worker message. Oversized individual
 * entries remain whole; entry boundaries and order are never changed. */
export function* catalogBatchBuffers(entries:readonly Entry[],limit=128*1024){
 let parts:string[]=[],size=2;
 const bytes=()=>new TextEncoder().encode('['+parts.join(',')+']').buffer;
 for(const entry of entries){
  const part=JSON.stringify(entry);
  if(parts.length&&(size+part.length+1>limit||parts.length>=50)){yield bytes();parts=[];size=2;}
  parts.push(part);size+=part.length+1;
 }
 if(parts.length)yield bytes();
}

export function decodeCatalogBatch(buffer:ArrayBuffer):Entry[]{
 const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));
 if(!Array.isArray(value)||value.some(entry=>!entry||typeof entry.id!=='string'||typeof entry.kind!=='string'||!entry.raw||typeof entry.raw!=='object'))throw Error('Invalid normalized catalog batch');
 return value;
}
