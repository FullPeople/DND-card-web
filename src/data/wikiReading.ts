import type {Entry,Raw} from '../core/model';
import {DEFAULT_SOURCE} from './catalogSource';
import {catalogTransport} from './catalogTransport';
import {expandCopies} from './expand';
import {readCache,writeCache} from '../platform/storage';

export async function readingJson(path:string,signal:AbortSignal,refresh=false):Promise<Raw>{
 if(!/^data\/[\w./-]+\.json$/.test(path)||path.split('/').includes('..'))throw Error('资料地址不正确');
 const url=DEFAULT_SOURCE+'/'+path,key=url;
 const cached=await readCache(key).catch(()=>undefined);
 if(signal.aborted)throw signal.reason;
 if(cached&&!refresh)return cached.body;
 const {body,etag}=await catalogTransport(signal).json(url);
 if(signal.aborted)throw signal.reason;
 await writeCache(key,{body,revision:etag||'reading-v1'}).catch(()=>{});
 return body;
}
const names=(row:Raw)=>[row.name,row.ENG_name].filter(Boolean).map((name:string)=>name.toLocaleLowerCase());
export async function entryFluff(entry:Entry,signal:AbortSignal,refresh=false):Promise<Raw|undefined>{
 if(entry.raw.fluff&&typeof entry.raw.fluff==='object')return entry.raw.fluff;
 const group=entry.kind==='subclass'?'class':entry.kind;
 let path:string|undefined,key=group+'Fluff';
 if(['class','spell','monster'].includes(group)){
  const folder=group==='class'?'class':group==='spell'?'spells':'bestiary';
  const index=await readingJson(`data/${folder}/fluff-index.json`,signal,refresh);
  const token=group==='class'?(entry.raw.classEnglish||entry.raw.className||entry.english):entry.source;
  const file=Object.entries(index).find(([name])=>name.toLowerCase()===String(token).toLowerCase())?.[1];
  if(typeof file==='string'&&/^[\w.-]+\.json$/.test(file))path=`data/${folder}/${file}`;
 }else{
  const files:Record<string,string>={race:'races',background:'backgrounds',feat:'feats',item:'items'};
  if(files[group])path=`data/fluff-${files[group]}.json`;
 }
 if(!path)return undefined;
 const body=await readingJson(path,signal,refresh);
 const keys=entry.kind==='subclass'?['subclassFluff','classFluff']:[key];
 const rows=expandCopies(keys.flatMap(key=>Array.isArray(body[key])?body[key]:[]));
 const wanted=[entry.name,entry.english,entry.raw.shortName].filter(Boolean).map(name=>String(name).toLowerCase());
 const found=rows.find(row=>String(row.source).toLowerCase()===entry.source.toLowerCase()&&names(row).some(name=>wanted.includes(name)));
 if(found?._copy)throw Error('这份简介的引用结构暂不支持，请在资料源中核对完整内容');
 return found;
}
export function readingImage(image:Raw):string|undefined{
 const href=image.href;
 const value=typeof href==='string'?href:href?.type==='internal'?'img/'+href.path:href?.url;
 if(typeof value!=='string'||!value)return undefined;
 try{const url=new URL(value,DEFAULT_SOURCE+'/');return url.protocol==='https:'?url.href:undefined;}catch{return undefined;}
}
export type ReadingVolume=Raw&{id:string;name:string;contents?:Raw[]};
export async function readingVolumes(kind:'book'|'adventure',signal:AbortSignal,refresh=false):Promise<ReadingVolume[]>{
 const body=await readingJson(`data/${kind==='book'?'books':'adventures'}.json`,signal,refresh);
 if(!Array.isArray(body[kind]))throw Error('出版资料目录结构不正确');
 return (Array.isArray(body[kind])?body[kind]:[]).filter((row:Raw)=>typeof row.id==='string'&&/^[\w.-]+$/.test(row.id));
}
export async function volumeChapters(kind:'book'|'adventure',id:string,signal:AbortSignal,refresh=false):Promise<Raw[]>{
 if(!/^[\w.-]+$/.test(id))throw Error('书籍标识不正确');
 const body=await readingJson(`data/${kind}/${kind}-${id.toLowerCase()}.json`,signal,refresh);
 const rows=body[kind+'Data'];
 const volume=Array.isArray(rows)?rows.find((row:Raw)=>String(row.id).toLowerCase()===id.toLowerCase()):undefined;
 const chapters=volume?.data||body.data;
 if(!Array.isArray(chapters)||!chapters.length)throw Error('这份资料没有可读取的章节');
 return chapters;
}
