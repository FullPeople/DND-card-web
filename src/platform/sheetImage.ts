import { downloadBlob } from './storage';
export type SheetCaptureOptions={hidePortraits?:boolean;hideNotes?:boolean;hideConditions?:boolean;hideResources?:boolean;collapseFeatures?:boolean};
export async function captureSheet(options:SheetCaptureOptions={}): Promise<Blob> {
 const paper=document.querySelector<HTMLElement>('.paper');if(!paper)throw new Error('角色卡尚未显示');
 const viewport=paper.closest<HTMLElement>('.sheet-viewport'),reflow=viewport?.classList.contains('sheet-reflow'),previousStyle=paper.getAttribute('style');
 if(reflow){viewport!.classList.remove('sheet-reflow');paper.style.width='680px';paper.style.height=`${680*297/210}px`;}
 paper.classList.add('sheet-export');
 const restored:{node:HTMLElement;style:string|null}[]=[];
 const conceal=(selector:string,collapse=false)=>paper.querySelectorAll<HTMLElement>(selector).forEach(node=>{restored.push({node,style:node.getAttribute('style')});node.style.setProperty(collapse?'display':'visibility',collapse?'none':'hidden','important');});
 conceal('.card-lock,.portrait-controls,.feature-browse');
 if(options.hidePortraits)conceal('.portrait-cell,.bio-portrait');
 if(options.hideNotes)conceal('.bio-description,.bio-appearance,.bio-personality,.bio-story');
 if(options.hideConditions)conceal('.overview-conditions,.condition-bubbles,.edition-divider .feature-panel,.card-art-layer,.card-atmosphere,.card-art,.buff-atmosphere');
 if(options.hideResources)conceal('.spell-slot-summary,.spell-slot-resources,.hit-dice-groups,.hit-dice-resources,.resource179-flow,.resource-row,.resource-section,.resources-grid');
 if(options.collapseFeatures)conceal('.feature-prose,.feature-body,.feature-expanded,.feature-detail',true);
 try {
 await new Promise(requestAnimationFrame);await document.fonts.ready;
 const {toSvg}=await import('html-to-image');
 const svg=await toSvg(paper,{width:680,height:680*297/210,skipFonts:true,backgroundColor:'#ededeb',style:{transform:'none',margin:'0',boxShadow:'none'},filter:node=>!node.classList?.contains('edit-mode-toggle')});
 // The renderer deep-clones SVG without copying descendant CSS. Preserve the
 // computed presentation in the detached image so transparent effects stay so.
 const doc=new DOMParser().parseFromString(decodeURIComponent(svg.slice(svg.indexOf(',')+1)),'image/svg+xml');
 const copies=doc.querySelector('foreignObject')!.querySelectorAll('svg');
 paper.querySelectorAll('svg').forEach((original,i)=>{
  const descendants=copies[i]?.querySelectorAll('*');
  original.querySelectorAll<SVGElement>('*').forEach((node,j)=>{
   const copy=descendants?.[j] as SVGElement|undefined;if(!copy?.style)return;
   const computed=getComputedStyle(node);for(const property of computed)copy.style.setProperty(property,computed.getPropertyValue(property));
   copy.style.animation='none';copy.style.transition='none';
  });
 });
 // Native number controls reserve spinner space in the SVG image. Export their
 // visible value as text, keeping the captured box, font and alignment.
 const fields=[...paper.querySelectorAll<HTMLInputElement>('input')].filter(input=>!input.closest('.edit-mode-toggle'));
 doc.querySelector('foreignObject')!.querySelectorAll<HTMLInputElement>('input').forEach((input,i)=>{
  if(!['text','number',''].includes(input.type))return;
  const text=doc.createElementNS('http://www.w3.org/1999/xhtml','span');text.setAttribute('style',input.getAttribute('style')||'');text.textContent=fields[i]?.value||input.getAttribute('value')||'';
  const span=text as HTMLElement;span.style.display='flex';span.style.alignItems='center';span.style.justifyContent=input.style.textAlign==='center'?'center':input.style.textAlign==='right'?'flex-end':'flex-start';span.style.whiteSpace='pre';span.style.fontSize=getComputedStyle(fields[i]).fontSize;input.replaceWith(span);
 });
 const image=new Image();image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(doc))}`;await image.decode();
 const canvas=document.createElement('canvas');canvas.width=2480;canvas.height=3508;
 const context=canvas.getContext('2d');if(!context)throw new Error('无法创建 PNG 画布');context.drawImage(image,0,0,canvas.width,canvas.height);
 return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG 生成失败')),'image/png'));
 }finally{for(const {node,style} of restored){if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);}paper.classList.remove('sheet-export');if(reflow){if(previousStyle===null)paper.removeAttribute('style');else paper.setAttribute('style',previousStyle);viewport!.classList.add('sheet-reflow');}}
}
export function saveSheetPng(blob:Blob,name:string){downloadBlob(name,blob);}
export function printSheetPng(url:string){
 const popup=window.open('','_blank');if(!popup)throw new Error('打印窗口未打开，请允许本站弹出窗口');popup.opener=null;
 const doc=popup.document;doc.title='角色卡 · A4 打印';const style=doc.createElement('style');style.textContent='@page{size:A4;margin:0}html,body{margin:0}img{display:block;width:210mm;height:297mm;object-fit:contain}';doc.head.append(style);
 const img=doc.createElement('img');img.alt='角色卡';img.onload=()=>{popup.focus();popup.print();};img.src=url;doc.body.append(img);
}
