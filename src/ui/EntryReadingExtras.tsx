import {useEffect,useRef,useState} from 'react';
import {classMatches,type Entry,type Raw} from '../core/model';
import {resolveEntryReference} from '../core/entryReferences';
import {DEFAULT_SOURCE} from '../data/catalogSource';
import {entryFluff,readingImage} from '../data/wikiReading';
import {ReadingRefresh} from '../data/readingRefresh';
import {Entries,Inline} from './Entries';
import {SourceName} from './SourceName';
import {translationInfo} from './wikiMetadata';
import './wikiReading.css';

export function TranslationNotice({raw}:{raw:Raw}){
 const info=translationInfo(raw);
 return <p className={`translation-notice ${info.machine?'machine-translation':''}`}><span>{info.status}</span>{info.name&&<span> · {info.name}</span>}{info.machine&&<strong> · 规则用语可能有误，请核对原文。</strong>}</p>;
}
export function ReadingImages({images}:{images:Raw[]}){
 return <div className="reading-images">{images.map((image,index)=>{const url=readingImage(image);return url?<figure key={url+index}><a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={image.title||image.alt||'资料插图'} loading="lazy" onError={event=>{event.currentTarget.hidden=true;event.currentTarget.parentElement?.setAttribute('aria-label','图片暂时无法读取；可以打开原图重试');}}/></a>{(image.title||image.credit)&&<figcaption>{image.title}{image.credit&&<> · {image.credit}</>}</figcaption>}</figure>:null;})}</div>;
}
export function EntryReadingExtras({entry,entries=[],inspect,onLink}:{entry:Entry;entries?:Entry[];inspect?:(entry:Entry)=>void;onLink:(reference:string,kind?:string)=>void}){
 const [tab,setTab]=useState<'rules'|'intro'|'images'>('rules'),[fluff,setFluff]=useState<Raw>(),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 const refresh=useRef(new ReadingRefresh());
 const refreshReading=()=>setRetry(refresh.current.request([entry.id]));
 const parentEnglish=entry.kind==='subclass'?entries.find(value=>value.kind==='class'&&classMatches(entry,value))?.english:undefined;
 useEffect(()=>{setTab('rules');setFluff(undefined);setError('');},[entry.id]);
 useEffect(()=>{
  if(tab==='rules')return;
  const controller=new AbortController(),ticket=refresh.current.pending(entry.id);setLoading(true);setError('');
  const readingEntry=parentEnglish?{...entry,raw:{...entry.raw,classEnglish:parentEnglish}}:entry;
  entryFluff(readingEntry,controller.signal,ticket!==undefined).then(value=>{if(!controller.signal.aborted)setFluff(value);}).catch(error=>{if(!controller.signal.aborted)setError(String(error?.message||error));}).finally(()=>{if(!controller.signal.aborted){refresh.current.complete(entry.id,ticket);setLoading(false);}});
  return()=>controller.abort();
 },[entry.id,parentEnglish,tab,retry]);
 const sourceRows:[string,any][]=[['主要来源',[{source:entry.source,page:entry.page}]],...(['additionalSources','otherSources','referenceSources'] as const).filter(key=>Array.isArray(entry.raw[key])).map(key=>[({additionalSources:'其他出处',otherSources:'重印出处',referenceSources:'参考来源'} as Record<string,string>)[key],entry.raw[key]] as [string,any])];
 const reprints=Array.isArray(entry.raw.reprintedAs)?entry.raw.reprintedAs:[];
 const flags=[['srd','SRD 5.1'],['srd52','SRD 5.2'],['basicRules','基础规则（2014）'],['basicRules2024','基础规则（2024）']].filter(([key])=>entry.raw[key]).map(([,label])=>label);
 const linked=(value:any)=>{const pointer=typeof value==='string'?value:value?.uid||[value?.name,value?.source].filter(Boolean).join('|');return {pointer,entry:resolveEntryReference(pointer,entries,entry.kind)};};
 return <section className="entry-reading-extras" aria-label="资料补充信息">
  <TranslationNotice raw={entry.raw}/>
  <details className="reading-sources"><summary>来源与版本{flags.length?' · '+flags.join('／'):''}</summary>{sourceRows.map(([label,rows])=><p key={label}><strong>{label}：</strong>{rows.map((row:Raw,index:number)=><span key={index}>{index>0?'；':''}<SourceName id={String(row.source||row)}/>{row.page?` · 第 ${row.page} 页`:''}</span>)}</p>)}
   {reprints.length>0&&<p><strong>关联重印：</strong>{reprints.map((value:any,index:number)=>{const target=linked(value);return <span key={index}>{index>0?'；':''}{target.entry&&inspect?<button className="text-link" onClick={()=>inspect(target.entry!)}>{target.entry.name}（{target.entry.source}）</button>:<Inline text={target.pointer.replaceAll('|',' · ')}/>}</span>;})}</p>}
   <a href={`${DEFAULT_SOURCE}/${({monster:'bestiary',class:'classes',subclass:'classes',race:'races',background:'backgrounds',feat:'feats',spell:'spells',item:'items'} as Record<string,string>)[entry.kind]||'variantrules'}.html`} target="_blank" rel="noopener noreferrer">在资料源中查阅原文 ↗</a>
  </details>
  {(['class','subclass','race','background','feat','spell','item','monster'].includes(entry.kind)||entry.raw.fluff)&&<>
   <div className="reading-extra-tabs" role="group" aria-label="补充资料"><button aria-pressed={tab==='rules'} onClick={()=>setTab('rules')}>规则</button><button aria-pressed={tab==='intro'} onClick={()=>setTab('intro')}>简介</button><button aria-pressed={tab==='images'} onClick={()=>setTab('images')}>图片</button></div>
   {tab!=='rules'&&<div className="reading-extra-content" role="region" aria-label={tab==='intro'?'资料简介':'资料图片'}>{loading?<p role="status">正在读取{tab==='intro'?'简介':'图片资料'}…</p>:error?<><p role="alert">资料读取失败：{error}</p><button onClick={refreshReading}>重试读取</button></>:<>{tab==='intro'?fluff?.entries?<Entries value={fluff.entries} onLink={onLink}/>:<p>资料源没有提供独立简介。</p>:fluff?.images?.length?<ReadingImages images={fluff.images}/>:<p>资料源没有提供独立图片。</p>}<button onClick={refreshReading}>重新读取补充资料</button></>}</div>}
  </>}
 </section>;
}
