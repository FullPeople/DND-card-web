import {useEffect,useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import type {Character} from '../src/core/model';
import {counts,type CardRenderer,type RendererOptions} from './types';

function SimpleCard({card}:{card:Character}){
 useLayoutEffect(()=>{counts.commits++;});
 useEffect(()=>{counts.mounts++;return()=>{counts.unmounts++;};},[]);
 return <article className="lab-simple" data-visible-card={card.id}><h2>{card.name}</h2><p>{card.edition} · {card.selections.length} 个特性</p><div>{card.selections.map(row=><p key={row.id}><strong>{row.entry.name}</strong><span>已经存在于内存中的内容</span></p>)}</div></article>;
}
export async function mount({host,cards}:RendererOptions):Promise<CardRenderer>{
 const root=createRoot(host);
 return {show(index){flushSync(()=>root.render(<SimpleCard card={cards[index]}/>));},dispose(){root.unmount();}};
}
