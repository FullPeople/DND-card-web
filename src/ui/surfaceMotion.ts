export const SURFACE_MOTION_MS = 180;
export const SURFACE_MOTION_EASING = 'cubic-bezier(.2,.7,.2,1)';

/** Paint changes belong to navigation, never to a value render or save receipt. */
export function createSurfaceMotion<Key>(animate:()=>{cancel:()=>void}|undefined,reduced:()=>boolean){
 let initialized=false,previous:Key,active:{cancel:()=>void}|undefined;
 const cancel=()=>{active?.cancel();active=undefined;};
 return {
  update(key:Key,enabled=true){
   const changed=initialized&&!Object.is(previous,key);
   initialized=true;previous=key;
   if(!enabled||reduced()){cancel();return;}
   if(!changed)return;
   cancel();active=animate();
  },
  cancel,
 };
}
