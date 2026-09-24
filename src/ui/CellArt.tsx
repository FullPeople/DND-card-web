import { useContext } from 'react';
import { CardVisualContext } from './cardVisualState';
export function CellArt({ width: w, height: h, missing, rounded=false }: { width: number; height: number; missing: boolean; rounded?:boolean }) {
  const { exhaustion } = useContext(CardVisualContext);
  if (!w || !h) return null;
  const perimeter = rounded ? `M9 1.5H${w-9}Q${w-1.5} 1.5 ${w-1.5} 9V${h-9}Q${w-1.5} ${h-1.5} ${w-9} ${h-1.5}H9Q1.5 ${h-1.5} 1.5 ${h-9}V9Q1.5 1.5 9 1.5Z` : `M8.6 1.5H${w-8.6}L${w-1.5} 8.6V${h-8.6}L${w-8.6} ${h-1.5}H8.6L1.5 ${h-8.6}V8.6Z`;
  return <>
    <svg className="cell-state-art cell-edge-art" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {!missing && <path className="invisible-cell-edge" d={perimeter}/>}
      <path className="poison-edge" d={perimeter}/>
      {Array.from({length:6}, (_,i) => <path key={i} className={`exhaustion-segment ${i < exhaustion ? 'segment-on' : ''}`} d={perimeter} pathLength="600" strokeDasharray="98 502" strokeDashoffset={-i*100}/>) }
    </svg>
    <svg className="cell-state-art cell-cracks" viewBox="0 0 160 130" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 13L15 23 12 39 29 53 23 74M12 39L3 49M29 53L43 48 56 58M160 88L147 76 135 83 115 66 103 70M147 76L149 59M115 66L118 53M72 0L68 17 81 32 77 44M68 17L51 20M112 130L105 110 86 106 76 92M105 110L121 102"/>
      <path className="stone-highlight" d="M1 15L13 24 10 40 27 54M158 90L146 79 134 85 114 69M74 1L70 17 83 33M114 129L107 108 86 104"/>
    </svg>
    <svg className="cell-state-art poison-drips" viewBox="0 0 160 130" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0H160V4Q138 11 123 5Q118 2 116 15Q113 25 110 8Q97 5 76 7Q71 17 69 8Q52 3 41 6Q36 30 32 9Q15 16 0 8ZM0 130V122Q16 120 23 124Q36 113 43 121Q57 117 65 123Q91 117 112 124Q138 111 160 122V130ZM0 0H3Q9 27 3 53Q12 59 5 78Q10 101 2 130H0ZM160 0H157Q149 20 157 42Q145 70 156 88Q151 114 158 130H160Z"/></svg>
    <div className="cell-state-art poison-soak" aria-hidden="true"/>
  </>;
}
export function CellHalo({ kind }: { kind: 'portrait' | 'initiative' }) {
  return <svg className={`cell-halo halo-${kind}`} viewBox="0 0 160 100" preserveAspectRatio="none" aria-hidden="true">
    {kind === 'portrait' ? <g className="portrait-star-orbit"><ellipse cx="80" cy="28" rx="67" ry="20"/>{[0,1,2].map(i => <g className={`ellipse-star star-${i}`} key={i}><path d="M0-10L3-3 10 0 3 3 0 10-3 3-10 0-3-3Z"/></g>)}</g> : <g className="initiative-burst">{Array.from({length:18},(_,i)=><path key={i} d="M-2-38L0-50 3-38Z" transform={`translate(80 50) scale(1.5 1) rotate(${i*20})`}/>)}</g>}
  </svg>;
}
