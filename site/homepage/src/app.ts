import type {DiceExperience} from './dice-experience';
import {SIDEBAR_QUERY} from './device';
import {LogoExperience} from './logo-experience';
import './button-effects.css';
import {mountAbout} from './about';
const $=<T extends HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const account=$('#home-qq-account');
let accountTimer=0;
const syncAccount=()=>{clearTimeout(accountTimer);account.inert=true;if(document.body.dataset.intro==='complete')accountTimer=window.setTimeout(()=>{account.inert=false},matchMedia('(prefers-reduced-motion: reduce)').matches?0:600)};
syncAccount();
new MutationObserver(syncAccount).observe(document.body,{attributes:true,attributeFilter:['data-intro']});
let toastTimer=0;
function toast(message:string){clearTimeout(toastTimer);const element=$('#toast');element.textContent=message;element.classList.add('visible');toastTimer=window.setTimeout(()=>element.classList.remove('visible'),7000)}
let dice:DiceExperience|undefined,diceModule:Promise<DiceExperience>|undefined;
const loadDice=()=>diceModule??=import('./dice-experience').then(module=>dice=new module.DiceExperience($('#dice-stage'),(event,detail)=>{if(event==='error')toast(detail.message||'骰子演出失败，请重新加载页面。')})).catch(error=>{diceModule=undefined;throw error});
const warmDice=()=>void loadDice().then(value=>value.init()).catch(error=>toast('骰子加载失败：'+String(error)));
function queueDiceWarm(){
  window.setTimeout(()=>{if('requestIdleCallback' in window)window.requestIdleCallback(()=>void loadEffects(),{timeout:1500});else void loadEffects();},650);
}
const logo=new LogoExperience(queueDiceWarm,()=>{const hit=$('#die-hit');hit.setAttribute('aria-busy','true');void loadDice().then(value=>value.roll('random')).catch(error=>toast(error instanceof Error?error.message:String(error))).finally(()=>hit.removeAttribute('aria-busy'))},toast);
$('#die-hit').addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')warmDice()});$('#die-hit').addEventListener('focus',event=>{if(matchMedia('(hover:hover)').matches)warmDice()});
let space:ReturnType<typeof import('./background').mountBackground>|undefined;
let effectsLoading:Promise<void>|undefined;
function loadEffects(){return effectsLoading??=Promise.all([import('./background'),import('./button-effects')]).then(([background,buttons])=>{
  space=background.mountBackground($('#world'));document.body.dataset.style='shape-grid';buttons.mountButtonEffects($('#pointer-effects'));
}).catch(error=>toast('页面特效加载失败：'+String(error)))}
const worksPanel=$('#works-panel');
let carouselCleanup:(()=>void)|undefined,carouselLoading=false,carouselState:(()=>unknown)|undefined;
let carouselModule:Promise<typeof import('./project-carousel')>|undefined;
const loadCarousel=()=>carouselModule??=import('./project-carousel').catch(error=>{carouselModule=undefined;throw error});
// Fetch the desktop/tablet rail during the opening, before it becomes visible.
if(matchMedia(SIDEBAR_QUERY).matches)void loadCarousel().then(module=>module.preloadProjectImages()).catch(()=>{});
const warmCarousel=()=>void loadCarousel().then(module=>module.preloadProjectImages()).catch(()=>{});
$('#molecule-handle').addEventListener('pointerenter',warmCarousel);
$('#molecule-handle').addEventListener('focus',warmCarousel);
async function syncCarousel(){
  if(worksPanel.hidden){carouselCleanup?.();carouselCleanup=undefined;worksPanel.dataset.carousel='idle';return}
  if(carouselCleanup||carouselLoading)return;
  carouselLoading=true;
  worksPanel.dataset.carousel='loading';
  try{
    const carousel=await loadCarousel();
    carouselState=carousel.carouselSnapshot;
    if(!worksPanel.hidden)carouselCleanup=carousel.mountProjectCarousel($('#project-carousel'));
  }catch(error){worksPanel.dataset.carousel='fallback';$('.works-grid').style.display='grid';toast('项目展示加载失败，请重新加载页面。')}
  finally{carouselLoading=false}
}
new MutationObserver(()=>void syncCarousel()).observe(worksPanel,{attributes:true,attributeFilter:['hidden']});
mountAbout();
document.addEventListener('selectstart',event=>event.preventDefault());document.addEventListener('dragstart',event=>event.preventDefault());
(window as any).__dndPreview={get dice(){return dice},snapshot:()=>({...logo.snapshot(),style:'shape-grid',space:space?.snapshot(),carousel:carouselState?.(),dice:dice?.snapshot()??{ready:false,workers:0}})};
