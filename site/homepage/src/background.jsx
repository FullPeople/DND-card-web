import React from 'react';
import {createRoot} from 'react-dom/client';
import ShapeGrid from './react-bits/ShapeGrid';

export function mountBackground(element) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = createRoot(element);
  root.render(<ShapeGrid direction={reduced ? 'none' : 'diagonal'} speed={0.22}
    squareSize={64} shape="square" borderColor="#91947d30" hoverFillColor="#e5ddc5" />);
  return {snapshot:()=>({component:'ShapeGrid',direction:reduced?'none':'diagonal',paper:'#f5f2e9',border:'#91947d30'}),destroy:()=>root.unmount()};
}
