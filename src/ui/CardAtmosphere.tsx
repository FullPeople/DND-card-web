import { useContext, useEffect, useId, useState } from 'react';
import type { Character } from '../core/model';
import { classBadge } from './classBadges';
import { CardVisualContext } from './cardVisualState';
import type { ConditionVisual } from './conditionVisuals';

function Art({ id }: { id: ConditionVisual }) {
  switch (id) {
    case 'restrained': return <>{[[-110,170,27],[790,180,151],[-100,620,-18],[790,800,204],[180,-90,70],[530,1040,-108]].map(([x,y,a],i)=><g key={i} transform={`translate(${x} ${y}) rotate(${a})`}><g className="chain-run">{Array.from({length:52},(_,n)=><g key={n} transform={`translate(${n*25} 0)`}><rect x="1" y="5" width="31" height="14" rx="7" className="chain-link"/><path d="M20 12h18" className="chain-joint"/></g>)}</g></g>)}</>;
    case 'grappled': return <>{[false,true].map(right=><g key={String(right)} transform={right?'translate(680 0) scale(-1 1)':undefined}><g className="grapple-clasp"><path d="M-10 317Q11 310 37 331L79 382Q92 398 82 410Q71 419 59 401L31 371V408L85 445Q101 458 88 472Q77 483 60 467L32 447V477L79 511Q97 523 82 538Q70 548 55 535L27 515Q43 566-10 586Z"/><path className="hand-crease" d="M8 382L19 394M8 431L21 445M7 480L19 493"/></g></g>)}</>;
    case 'charmed': return <>{[false,true].map(right=><g key={String(right)} transform={right?'translate(680 962) rotate(180)':undefined}><g className="charm-vine"><path className="vine-stem" pathLength="1000" d="M340 950C170 960 42 980 22 873S66 718 23 622S-7 425 25 312S-8 123 25 53S185 2 340 12"/>{[0,1,2,3,4,5].map(i=><g key={i} transform={`translate(${i%2?22:27} ${100+i*141}) rotate(${i%2?20:-25})`}><path className="vine-heart" d="M12 8C3 0-10-8-8-19C-6-31 8-32 12-22C17-33 31-30 33-19C35-8 22 1 12 8ZM-9 39C-17 32-28 24-26 16C-24 7-14 7-10 14C-5 6 5 9 6 17C7 25-2 33-9 39Z"/><path className="vine-curl" d="M0 7C50 29 58-29 36-22C18-18 35 7 43-9"/></g>)}</g></g>)}</>;
    case 'deafened': case 'blinded': return <g className="prohibition-symbol" transform={`translate(510 ${id==='deafened'?270:710})`}>
      <circle r="96"/>{id==='deafened'?<><path className="symbol-fill" d="M-58-25H-30L5-56V56L-30 25H-58Z"/><path d="M25-33Q60 0 25 33M41-51Q96 0 41 51"/></>:<><path d="M-73 0Q0-80 73 0Q0 80-73 0Z"/><circle r="26"/></>}<path className="prohibition-slash" d="M-68-68L68 68"/>
    </g>;
    case 'bloodied': return <>{Array.from({length:19},(_,i)=>{const x=19+(i*173)%642,y=28+(i*251)%910,scale=.42+(i%4)*.2;return <g key={i} className="blood-spatter" transform={`translate(${x} ${y}) scale(${scale}) rotate(${i*37})`}><path d="M-7-17L-10-50-1-27 12-18 36-40 21-12 25 1 66 10 28 12 12 22 15 53 3 26-13 20-43 37-23 7-61-6-24-8-20-31Z"/><circle cx="-49" cy="-35" r="5"/><circle cx="60" cy="30" r="7"/><circle cx="35" cy="-57" r="3"/></g>})}</>;
    case 'paralyzed': return <><rect className="glitch-flash" width="680" height="962"/><path className="glitch-slices" d="M0 134H680V153H0ZM0 406H680V413H0ZM0 719H680V748H0Z"/></>;
    case 'poisoned': return <path className="paper-poison-rim" d="M12 12H668V950H12Z"/>;
    default: return null;
  }
}

function Effect({ id, active }: { id: ConditionVisual; active: boolean }) {
  const [retained, setRetained] = useState(active);
  useEffect(() => { if(active){setRetained(true);return;} const timer=setTimeout(()=>setRetained(false),1000);return()=>clearTimeout(timer); },[active]);
  if(!active&&!retained)return null;
  return <div className={`card-state-effect effect-${id} ${active?'is-present':'is-leaving'}`} data-card-effect={id} data-phase={active?'present':'leaving'}><svg viewBox="0 0 680 962" preserveAspectRatio="none" focusable="false"><Art id={id}/></svg></div>;
}
function MagicSeal({ badge, active }: { badge: ReturnType<typeof classBadge>; active: boolean }) {
  const maskId=useId().replace(/:/g,'');
  return <svg className={`magic-seal ${active?'seal-active':''}`} viewBox="0 0 1000 1000" aria-hidden="true">
    <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><rect width="1000" height="1000" fill="white"/>{badge&&<image href={badge.url} width="1000" height="1000"/>}</mask></defs>
    <g mask={`url(#${maskId})`}><g className="magic-rotation"><circle cx="500" cy="500" r="479"/><circle cx="500" cy="500" r="448"/><circle cx="500" cy="500" r="380"/><path d="M500 64L878 718H122ZM500 936L122 282H878Z"/>{Array.from({length:24},(_,i)=><g key={i} transform={`rotate(${i*15} 500 500)`}><path d="M491 28V46L509 35V54M495 63H505"/></g>)}</g></g>
  </svg>;
}
export function CardAtmosphere({ character }: { character: Character }) {
  const {active}=useContext(CardVisualContext);
  const primary=character.selections.filter(s=>s.entry.kind==='class').reduce<(typeof character.selections)[number]|undefined>((best,next)=>!best||next.level>best.level?next:best,undefined);
  const badge=primary&&classBadge(primary.entry);
  const [shown,setShown]=useState(badge);
  const [leaving,setLeaving]=useState(false);
  useEffect(()=>{
    if(shown?.id===badge?.id){setLeaving(false);return;}
    if(!shown){setShown(badge);setLeaving(false);return;}
    setLeaving(true);
    const timer=setTimeout(()=>{setShown(badge);setLeaving(false);},750);
    return()=>clearTimeout(timer);
  },[badge,shown]);
  const [paused,setPaused]=useState(document.hidden);
  useEffect(()=>{const update=()=>setPaused(document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  return <>
    <div className={`card-art-layer card-art-background ${paused?'effects-paused':''}`} aria-hidden="true">
      <div className="watermark-anchor"><MagicSeal badge={shown} active={active.has('concentration')}/>{shown&&<div className={`class-watermarks ${leaving?'badge-leaving':'badge-present'}`} data-watermark-count="1" data-phase={leaving?'leaving':'present'}><span className="badge-tint" style={{maskImage:`url("${shown.url}")`,WebkitMaskImage:`url("${shown.url}")`}}><img key={shown.id} data-class-badge={shown.id} src={shown.url} alt="" draggable={false}/></span></div>}</div>
      <Effect id="restrained" active={active.has('restrained')}/><Effect id="charmed" active={active.has('charmed')}/>
    </div>
    <div className={`card-art-layer card-art-edge ${paused?'effects-paused':''}`} aria-hidden="true">
      {(['grappled','deafened','blinded','bloodied','paralyzed','poisoned'] as ConditionVisual[]).map(id=><Effect key={id} id={id} active={active.has(id)}/>)}
    </div>
  </>;
}
