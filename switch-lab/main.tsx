import type {Character} from '../src/core/model';
import {authoredCards} from './cards';
import {counts,emptyCounts,metricSemantics,type Counts,type Mode,type CardRenderer} from './types';
import './style.css';

type Sample={sequence:number;from:number;to:number;mode:Mode;commitMs:number;nextFrameMs:number;counts:Counts;blankFrames:number;wrongCardFrames:number;opacity:number};
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const host=$<HTMLElement>('lab-stage'),status=$<HTMLElement>('lab-status'),tabs=$<HTMLElement>('lab-tabs');
const nodeCount=(nodes:NodeList)=>[...nodes].reduce((sum,node)=>sum+(node instanceof Element?1+node.querySelectorAll('*').length:0),0);
const mutations=new MutationObserver(records=>{for(const row of records){counts.domAdded+=nodeCount(row.addedNodes);counts.domRemoved+=nodeCount(row.removedNodes);}});
mutations.observe(host,{childList:true,subtree:true});
const modeInput=$<HTMLSelectElement>('lab-mode');
const frames=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
let cards:Character[]=[],original='',active=0,mode:Mode='native',renderer:CardRenderer|undefined,ready=false,running=false,epoch=0;
let samples:Sample[]=[],prepareMs=0;

function NativeCard(card:Character){const panel=document.createElement('article');panel.className='lab-simple';panel.dataset.cardId=card.id;const h=document.createElement('h2');h.textContent=card.name;panel.append(h);for(const row of card.selections){const line=document.createElement('p');line.textContent=row.entry.name+' · 已经存在于内存中的内容';panel.append(line);}return panel;}
function show(index:number){
 renderer!.show(index);
 host.dataset.activeCard=String(index);host.dataset.activeId=cards[index].id;
 for(const [i,button] of [...tabs.querySelectorAll('button')].entries())button.setAttribute('aria-pressed',String(i===index));
}
function summary(){
 const sorted=samples.map(row=>row.commitMs).sort((a,b)=>a-b),median=sorted.length?sorted[Math.floor(sorted.length/2)]:0;
 $('lab-summary').textContent=`准备 ${prepareMs.toFixed(1)} ms · ${samples.length} 次切换 · 界面提交中位 ${median.toFixed(2)} ms`;
 const body=$('lab-results');body.replaceChildren();for(const sample of samples.slice(-40)){
  const tr=document.createElement('tr');for(const value of [`${sample.from+1} → ${sample.to+1}`,sample.commitMs.toFixed(2)+' ms',sample.nextFrameMs.toFixed(2)+' ms',String(sample.counts.evaluations),String(sample.counts.commits),`${sample.counts.mounts}／${sample.counts.unmounts}`,`${sample.counts.domAdded}／${sample.counts.domRemoved}`,String(sample.blankFrames)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);
 }
 document.body.dataset.labSamples=String(samples.length);
}
async function select(index:number){
 if(!ready||index===active)return;
 const token=epoch,from=active,before={...counts},start=performance.now();active=index;show(index);
 const commitMs=performance.now()-start;
 const surface=(mode==='native'||mode==='retained'?host.querySelector<HTMLElement>('.is-active'):host)?.querySelector<HTMLElement>('.paper,.lab-simple')||host.querySelector<HTMLElement>('.is-active');
 let fade:Animation|undefined;if($<HTMLInputElement>('lab-legacy-fade').checked&&surface)fade=surface.animate([{opacity:.78},{opacity:1}],{duration:180,easing:'cubic-bezier(.2,.7,.2,1)'});
 let blankFrames=0,wrongCardFrames=0;await new Promise<void>(resolve=>requestAnimationFrame(()=>{
  const target=(mode==='native'||mode==='retained'?host.querySelector<HTMLElement>('.is-active'):host);if(!target||target.getBoundingClientRect().height===0)blankFrames++;
  const visible=target?.querySelector<HTMLElement>('.paper,.lab-simple')||target;const id=visible?.dataset.characterId||visible?.dataset.visibleCard||visible?.dataset.cardId;if(id!==cards[index].id)wrongCardFrames++;
  resolve();
 }));
 if(token!==epoch){fade?.cancel();return;}
 const nextFrameMs=performance.now()-start,delta=Object.fromEntries(Object.keys(before).map(key=>[key,counts[key as keyof Counts]-before[key as keyof Counts]])) as Counts;
 samples.push({sequence:samples.length+1,from,to:index,mode,commitMs,nextFrameMs,counts:delta,blankFrames,wrongCardFrames,opacity:surface?Number(getComputedStyle(surface).opacity):1});summary();
}
async function setup(){
 const token=++epoch;ready=false;host.dataset.ready='false';$<HTMLButtonElement>('lab-run').disabled=true;status.textContent='正在准备卡面，准备完成后再切换…';
 renderer?.dispose();renderer=undefined;host.replaceChildren();active=0;mode=modeInput.value as Mode;samples=[];Object.assign(counts,emptyCounts());
 const start=performance.now();
 if(mode==='native'){
  for(const [index,card] of cards.entries()){const panel=NativeCard(card);panel.dataset.deckCard=String(index);panel.classList.add('lab-deck-panel');host.append(panel);}
  renderer={show(index){for(const panel of host.querySelectorAll<HTMLElement>('[data-deck-card]')){const visible=Number(panel.dataset.deckCard)===index;panel.classList.toggle('is-active',visible);panel.setAttribute('aria-hidden',String(!visible));panel.inert=!visible;}},dispose(){}};
 }else{
  const module=mode==='react'?await import('./simpleCard'):await import('./realCard');
  if(token!==epoch)return;
  const mounted=await module.mount({host,cards,mode,decoration:$<HTMLInputElement>('lab-decoration').checked,display:$<HTMLSelectElement>('lab-display').value as 'screen'|'a4'});
  if(token!==epoch){mounted.dispose();return;}
  renderer=mounted;
 }
 if(token!==epoch)return;
 show(0);await frames();if(token!==epoch)return;prepareMs=performance.now()-start;
 tabs.replaceChildren();for(const [index,card] of cards.entries()){const button=document.createElement('button');button.textContent=card.name;button.setAttribute('aria-pressed',String(index===0));button.addEventListener('click',()=>{if(!running)void select(index);});tabs.append(button);}
 ready=true;host.dataset.ready='true';status.textContent=`${cards.length} 张卡已准备好 · 本页不连接云端，不读写正式角色存档`;$<HTMLButtonElement>('lab-run').disabled=false;summary();
}
async function importFile(file:File){
 if(file.size>20_000_000)throw Error('文件超过 20 MB，请拆分后测试。');
 const {parseFile,readCharacter}=await import('../src/core/validation');
 const value=parseFile(await file.text()) as any;
 const rows:unknown[]=Array.isArray(value)?value:Array.isArray(value?.characters)?value.characters:[value];
 if(!rows.length||rows.length>30)throw Error('请选择包含 1～30 张卡的 JSON。');
 const next=rows.map(row=>readCharacter(row).character);if(new Set(next.map(card=>card.id)).size!==next.length)throw Error('文件包含重复角色身份，请使用各不相同的角色卡。');
 cards=next;original=JSON.stringify(cards);await setup();
}
modeInput.onchange=()=>{if(!running)void setup();};
$('lab-display').onchange=()=>{if(!running)void setup();};
$('lab-decoration').onchange=()=>{if(!running)void setup();};
$('lab-samples').onclick=()=>{if(running)return;cards=authoredCards(Number($<HTMLSelectElement>('lab-size').value));original=JSON.stringify(cards);void setup();};
$('lab-import').onchange=()=>{const input=$<HTMLInputElement>('lab-import'),file=input.files?.[0];if(file&&!running)void importFile(file).catch(error=>{status.textContent=String(error);});input.value='';};
$('lab-clear').onclick=()=>{samples=[];summary();};
$('lab-run').onclick=()=>{if(!ready||running)return;running=true;for(const node of document.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('.lab-controls input,.lab-controls select,.lab-controls button'))node.disabled=true;void(async()=>{for(let round=0;round<3;round++)for(const index of [...cards.keys()].slice(1).concat([...cards.keys()].reverse().slice(1))){await select(index);await frames();}if(JSON.stringify(cards)!==original)throw Error('验收失败：实验意外改变了角色内容。');status.textContent='三轮完成 · 原角色内容完整相同';})().catch(error=>{status.textContent=String(error);}).finally(()=>{running=false;for(const node of document.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('.lab-controls input,.lab-controls select,.lab-controls button'))node.disabled=false;});};
$('lab-export').onclick=()=>{const report={format:'dnd-card-switch-lab',version:1,scope:'one document, no Wiki or cloud; frame timing is an observation, not exact pixel paint',metricSemantics,mode,display:$<HTMLSelectElement>('lab-display').value,cardCount:cards.length,selectionCounts:cards.map(card=>card.selections.length),prepareMs,counts,samples,unchanged:JSON.stringify(cards)===original,legacyFade:$<HTMLInputElement>('lab-legacy-fade').checked,decoration:$<HTMLInputElement>('lab-decoration').checked};const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='card-switch-measurements.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
cards=authoredCards(80);original=JSON.stringify(cards);void setup().catch(error=>{status.textContent=String(error);});
