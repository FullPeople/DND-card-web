type Sounds={prime:()=>void;play:(name:string)=>void};
let sounds:Sounds|undefined;
export function startWorkbenchSound(){
 const url=new URL('../workbench-panels/sound.js',location.href.split('#')[0]);
 void import(/* @vite-ignore */ url.href).then(module=>{sounds=module;}).catch(()=>{});
 const prime=()=>sounds?.prime();
 for(const event of ['pointerdown','keydown','click'])document.addEventListener(event,prime,{capture:true});
}
export function playWorkbenchSound(name:unknown){if(typeof name==='string'){sounds?.prime();sounds?.play(name);}}
