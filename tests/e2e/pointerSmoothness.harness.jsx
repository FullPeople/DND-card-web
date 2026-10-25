import React from 'react';
import {createRoot} from 'react-dom/client';
import {WikiSplitter} from '../../src/ui/WikiSplitter';
import {WikiColumnsContext} from '../../src/ui/WikiLayout';
import {pointerDrag} from '../../src/ui/pointerDrag';

window.dragMoves=[];window.dragFinishes=[];window.dragCancels=0;
document.querySelector('#source').addEventListener('pointerdown',event=>pointerDrag(event,{title:'Drag source',move:(point,hit)=>window.dragMoves.push({point,hit:hit?.id}),finish:(point,hit)=>{window.dragFinishes.push({point,hit:hit?.id});},cancel:()=>window.dragCancels++}));
createRoot(document.querySelector('#root')).render(<WikiColumnsContext.Provider value={true}><div className="wiki-layout"><div className="catalog">Catalog</div><WikiSplitter/><div className="reader">Reader</div></div></WikiColumnsContext.Provider>);
