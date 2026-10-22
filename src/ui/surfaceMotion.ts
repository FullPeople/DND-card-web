export const SURFACE_MOTION_MS = 180;
export const SURFACE_MOTION_EASING = 'cubic-bezier(.2,.7,.2,1)';

/** Paint changes belong to navigation, never to a value render or save receipt. */
export function createSurfaceMotion<Key>(animate:()=>{cancel:()=>void}|undefined,reduced:()=>boolean){
 let initialized=false,previous:Key,previousScope:unknown,active:{cancel:()=>void}|undefined;
 const cancel=()=>{active?.cancel();active=undefined;};
 return {
  update(key:Key,enabled=true,scope?:unknown){
   const changed=initialized&&!Object.is(previous,key);
   const changedScope=initialized&&!Object.is(previousScope,scope);
   initialized=true;previous=key;previousScope=scope;
   // A cached card is already a complete surface. Changing its owner must not
   // replay a fade or carry the previous card's in-flight page animation.
   if(!enabled||reduced()||changedScope){cancel();return;}
   if(!changed)return;
   cancel();active=animate();
  },
  cancel,
 };
}
