import React, {Component, useEffect, useState, useRef, useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import FlexCarousel from './react-bits/FlexCarousel';
import {projects} from './projects';
import {loadProjectImage} from './project-images';
import {acquireProjectVideo,preloadProjectVideo,waitForProjectVideoData,registerProjectVideo} from './project-videos';
import {likesSnapshot,subscribeLikes,refreshLikes,setProjectLiked} from './project-likes';
import './project-carousel.css';

import {SIDEBAR_QUERY as wideQuery} from './device';
const defaultIndex=projects.findIndex(item=>item.id==='three-dragon');
projects.forEach(item=>registerProjectVideo(item.video,item.fullVideo));
export function preloadProjectImages(){return Promise.all(projects.map((item,index)=>loadProjectImage(innerWidth>=1000?item.src:item.mobileSrc,index===defaultIndex?'high':'low')))}
let state={activeIndex:defaultIndex,selectedIndex:null,orientation:'horizontal',layout:[]};

class CarouselBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){document.querySelector('#works-panel').dataset.carousel='fallback';}
  render(){return this.state.failed ? <Gallery fallback/> : this.props.children;}
}

function ProjectMedia({item}){
  const mount=useRef(null),[playing,setPlaying]=useState(false);
  useEffect(()=>{
    setPlaying(false);
    if(!item.video||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const claim=acquireProjectVideo(item.video,video=>{if(video.readyState>=2)setPlaying(true)}),video=claim.video;
    video.poster=item.src;video.setAttribute('aria-label',item.title+' 演示动画');
    mount.current?.appendChild(video);claim.setActive(true);
    return()=>{claim.release();video.remove()};
  },[item.id]);
  return <div className={`detail-image ${playing?'playing':''}`} ref={mount}>
    <img crossOrigin="anonymous" src={item.src} alt={item.title} draggable="false"/>
  </div>;
}

function ProjectLike({item}){
  const [likes,setLikes]=useState(likesSnapshot),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>subscribeLikes(setLikes),[]);
  useEffect(()=>{setError('')},[item.id]);
  const value=likes.projects[item.id];
  const toggle=async()=>{if(busy)return;setBusy(true);setError('');try{await setProjectLiked(item.id,!value?.liked)}catch(e){setError(e.message)}finally{setBusy(false)}};
  return <div className="project-like-wrap">
    <button className="project-like" type="button" aria-label={`${value?.liked?'取消点赞':'点赞'}：${item.name}${value?`，${value.count} 个赞`:''}`} aria-pressed={value?.liked||false} aria-busy={busy} disabled={busy} onClick={toggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-9-5.4-9-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.6-9 11-9 11Z"/></svg>
      <span className="like-count" aria-live="polite">{value?value.count:'…'}</span>
    </button>
    {(error||likes.error)&&<p className="like-error" role="status">{error||likes.error}</p>}
  </div>;
}

function ArtistCards({artists}){
  return <div className="artist-cards">{artists.map(artist=><section className="artist-card" key={artist.id}>
    <img src={artist.avatar} alt={`${artist.name}的头像`} loading="lazy" decoding="async"/>
    <div><h3>{artist.name}</h3><p>{artist.description}</p></div>
    <a className="detail-link" href={artist.href} target="_blank" rel="noopener noreferrer"><span>米画师 · {artist.name}</span><span aria-hidden="true">↗</span></a>
  </section>)}</div>;
}

function ProjectDetails({item,onClose}){
  return <article className="project-detail" data-project={item.id} aria-label={`${item.name} 项目详情`}>
    <button className="detail-back" type="button" onClick={onClose} aria-label="返回项目轮播">← <span>全部项目</span></button>
    <ProjectMedia item={item}/>
    <div className="detail-copy">
      <div className="detail-text"><p className="detail-author">{item.author}</p><h2>{item.name}</h2>
      <p className="detail-summary">{item.summary}</p>{item.description&&<p className="detail-description">{item.description}</p>}
      </div>
      {item.artists&&<ArtistCards artists={item.artists}/>}
      <div className="detail-actions">
        {item.version&&<p className="detail-release"><span>Windows 版本 {item.version}</span><time dateTime={item.updated}>更新于 {item.updated}</time></p>}
        <ProjectLike item={item}/>
        <div className="detail-links">
          {item.artists?null:item.platforms?item.platforms.map(platform=>platform.href?
            <a key={platform.name} className="detail-link" href={platform.href} download={platform.download||undefined} target={platform.download?undefined:'_blank'} rel={platform.download?undefined:'noopener noreferrer'}><span>{platform.name}</span><span aria-hidden="true">{platform.download?'↓':'↗'}</span></a>:
            <button key={platform.name} className="detail-link pending" type="button" disabled><span>{platform.name}</span><small>待发布</small></button>):
            <a className="detail-link" href={item.href} target="_blank" rel="noopener noreferrer"><span>{item.linkLabel}</span><span aria-hidden="true">↗</span></a>}
        </div>
        {item.alternateDownloads&&<p className="detail-alternate">备用下载：{item.alternateDownloads.map(link=><a key={link.name} href={link.href} download>{link.name}</a>)}</p>}
      </div>
    </div>
  </article>;
}

function Gallery({fallback=false}){
  const [wide,setWide]=useState(()=>matchMedia(wideQuery).matches);
  const [active,setActive]=useState(defaultIndex),[selected,setSelected]=useState(null);
  const carouselItems=useMemo(()=>projects.map(item=>({...item,src:wide&&innerWidth>=1000?item.src:item.mobileSrc,alt:item.title})),[wide]);
  const [graphics,setGraphics]=useState(!fallback);
  const item=projects[active],orientation=wide?'vertical':'horizontal';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  state.activeIndex=active;state.selectedIndex=selected;state.orientation=orientation;
  useEffect(()=>{
    const index=selected??active;let alive=true;
    if(selected===null||!wide||navigator.connection?.saveData||['slow-2g','2g','3g'].includes(navigator.connection?.effectiveType))return;
    void waitForProjectVideoData(projects[index].video).then(()=>{
      if(!alive)return;
      projects.forEach(next=>preloadProjectVideo(next.video));
    });
    return()=>{alive=false};
  },[active,selected,wide]);
  useEffect(()=>{
    void refreshLikes();
    const refresh=()=>{if(!document.hidden)void refreshLikes()};window.addEventListener('focus',refresh);
    return()=>window.removeEventListener('focus',refresh);
  },[]);
  useEffect(()=>{
    const media=matchMedia(wideQuery),change=()=>setWide(media.matches);
    media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
  },[]);
  useEffect(()=>{
    document.querySelector('#works-panel').dataset.detail=String(selected!==null);
    window.dispatchEvent(new CustomEvent('dnd-project-detail',{detail:selected!==null}));
    const escape=event=>{if(event.key==='Escape'&&selected!==null&&!document.querySelector('#about-dialog')?.open){event.preventDefault();event.stopPropagation();setSelected(null)}};
    window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);
  },[selected]);
  useEffect(()=>()=>{state.selectedIndex=null;state.layout=[]},[]);
  useEffect(()=>{
    const close=()=>setSelected(null);window.addEventListener('dnd-project-close',close);
    return()=>window.removeEventListener('dnd-project-close',close);
  },[]);
  useEffect(()=>{
    if(!graphics)return;
    const root=document.querySelector('#project-carousel');
    let canvas;
    const lost=()=>{if(canvas?.isConnected){setGraphics(false);document.querySelector('#works-panel').dataset.carousel='fallback'}};
    const ready=()=>{canvas=root?.querySelector('canvas');if(canvas)document.querySelector('#works-panel').dataset.carousel='ready'};
    const observer=new MutationObserver(ready);if(root)observer.observe(root,{childList:true,subtree:true});ready();
    root?.addEventListener('webglcontextlost',lost,true);
    return()=>{observer.disconnect();root?.removeEventListener('webglcontextlost',lost,true)};
  },[graphics,orientation]);
  const step=direction=>document.querySelector('.project-carousel')?.dispatchEvent(new KeyboardEvent('keydown',{key:wide?(direction>0?'ArrowDown':'ArrowUp'):(direction>0?'ArrowRight':'ArrowLeft'),bubbles:true}));
  const layout=rects=>{state.layout=rects};
  return <div className={`project-showcase ${wide?'wide':'narrow'} ${selected!==null?'detail-open':''}`} data-orientation={orientation}>
    <aside className="project-rail" aria-label="项目轮播">
      {graphics?<><FlexCarousel items={carouselItems} initialIndex={active} preset="liquid" orientation={orientation} selectOnClick fitViewport respectPadding={wide}
        doodle cardLabels={wide} selectedIndex={selected} dispersion={.05}
        intro={reduced?'fade':'rise'} introDuration={reduced?.35:.65} fit={wide?'banner':'landscape'} cardHeight={wide?1.08:.72}
        gap={wide?24:28} radius={12} bend={wide?.16:.34} tilt={wide?0:62} reach={wide?.25:.38} squeeze={wide?.08:.2}
        autoplay={false} captions={false} focusOnClick={false} followCursor={false} className="project-carousel"
        onSelect={index=>setSelected(index)} onChange={(index,_item,interaction)=>{setActive(index);if(interaction&&wide&&selected!==null)setSelected(index)}} onLayout={layout}>
        {wide&&<div className="project-interaction" aria-hidden="true"/>}
      </FlexCarousel>
      </>:
        <div className="project-fallback">{carouselItems.map((project,index)=><button type="button" key={project.id} onClick={()=>{setActive(index);setSelected(index)}}><img src={project.src} alt="" draggable="false" loading="lazy"/><span>{project.name}</span></button>)}</div>}
      <div className="project-caption">
        <button type="button" className="project-title" onClick={()=>setSelected(active)}><span>{item.title}</span><span aria-hidden="true">↗</span></button>
        <div className="project-navigation">
          <button type="button" onClick={()=>step(-1)} aria-label="上一个项目">{wide?'↑':'←'}</button>
          <span className="project-count" aria-live="polite">{String(active+1).padStart(2,'0')} / {String(projects.length).padStart(2,'0')}</span>
          <button type="button" onClick={()=>step(1)} aria-label="下一个项目">{wide?'↓':'→'}</button>
        </div>
      </div>
    </aside>
    {selected!==null&&<ProjectDetails item={carouselItems[selected]} onClose={()=>setSelected(null)}/>}
  </div>;
}

export function mountProjectCarousel(element){
  state={activeIndex:defaultIndex,selectedIndex:null,orientation:'horizontal',layout:[]};
  const root=createRoot(element);root.render(<CarouselBoundary><Gallery/></CarouselBoundary>);
  return()=>root.unmount();
}
export function carouselSnapshot(){return {component:'FlexCarousel',...state,projects:projects.map(({title,href,version,updated})=>({title,href,version,updated}))};}
