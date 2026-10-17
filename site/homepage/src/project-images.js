const images=new Map();

export function loadProjectImage(src,priority='auto'){
  let pending=images.get(src);
  if(!pending){
    pending=new Promise((resolve,reject)=>{
      const image=new Image();image.crossOrigin='anonymous';image.decoding='async';image.fetchPriority=priority;
      let attempts=0,timer;
      const failed=()=>{clearTimeout(timer);if(attempts++===0){setTimeout(start,250)}else reject(new Error('Project image failed: '+src))};
      const start=()=>{timer=setTimeout(failed,20000);image.src=attempts?src+(src.includes('?')?'&':'?')+'retry=1':src};
      image.onload=()=>{clearTimeout(timer);image.naturalWidth?(image.decode?image.decode().catch(()=>{}).then(()=>resolve(image)):resolve(image)):failed()};
      image.onerror=failed;start();
    }).catch(error=>{images.delete(src);throw error});
    images.set(src,pending);
  }
  return pending;
}
