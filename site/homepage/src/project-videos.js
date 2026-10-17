const videos=new Map();
const fullSources=new Map();
const preloadRank={none:0,metadata:1,auto:2};
let fullDownload=null;

export function registerProjectVideo(src,fullSrc){if(src&&fullSrc)fullSources.set(src,fullSrc)}
function previewsBuffered(){
  return fullSources.size&&[...fullSources.keys()].every(src=>{
    const video=videos.get(src)?.video;
    return video&&Number.isFinite(video.duration)&&video.buffered.length&&video.buffered.end(video.buffered.length-1)>=video.duration-.1;
  });
}
function prepareFullRecording(){
  if(fullDownload||document.hidden||navigator.connection?.saveData||!previewsBuffered())return;
  const entry=[...videos.entries()].find(([src,record])=>record.wanted&&!record.fullAttempted&&fullSources.has(src));
  if(!entry)return;
  const [src,record]=entry,controller=new AbortController();
  record.fullAttempted=true;fullDownload={record,controller};
  void fetch(fullSources.get(src),{priority:'low',signal:controller.signal}).then(response=>{
    if(!response.ok)throw new Error('Full recording unavailable');return response.blob();
  }).then(blob=>{
    record.fullURL=URL.createObjectURL(blob);record.applyFull();
  }).catch(error=>{if(error.name==='AbortError')record.fullAttempted=false}).finally(()=>{
    if(fullDownload?.record===record)fullDownload=null;prepareFullRecording();
  });
}

function getVideo(src,preload){
  let record=videos.get(src);
  if(!record){
    const video=document.createElement('video');
    video.crossOrigin='anonymous';video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload=preload;
    video.dataset.projectVideo=src;
    record={video,claims:new Map(),frame:0,wanted:false,pending:false,generation:0,failed:false,blocked:false,fullAttempted:false,fullURL:null,upgraded:false};videos.set(src,record);
    const notify=()=>{if(video.readyState>=2)record.claims.forEach(claim=>{if(claim.active)claim.callback(video)})};
    const stopFrame=()=>{if(record.frame)video.cancelVideoFrameCallback?.(record.frame);record.frame=0};
    record.applyFull=()=>{
      if(!record.fullURL||record.upgraded||record.failed)return;
      const time=video.currentTime;
      record.upgraded=true;record.generation++;record.pending=false;record.blocked=false;stopFrame();
      video.addEventListener('loadedmetadata',()=>{
        video.currentTime=Math.min(time,Math.max(0,video.duration-.01));record.sync();
      },{once:true});
      video.src=record.fullURL;
    };
    const scheduleFrame=()=>{
      if(record.frame||!record.wanted||video.paused||!video.requestVideoFrameCallback)return;
      record.frame=video.requestVideoFrameCallback(()=>{record.frame=0;if(!record.wanted||video.paused)return;notify();scheduleFrame()});
    };
    record.sync=()=>{
      const wanted=!record.failed&&!document.hidden&&[...record.claims.values()].some(claim=>claim.active);
      if(!wanted){
        if(record.wanted||record.pending){record.generation++;record.pending=false}
        record.wanted=false;video.pause();stopFrame();return;
      }
      record.wanted=true;
      prepareFullRecording();
      if(!video.paused){scheduleFrame();return}
      if(record.pending||record.blocked)return;
      const generation=++record.generation;record.pending=true;video.preload='auto';
      video.play().then(()=>{
        if(generation!==record.generation)return;
        record.pending=false;notify();scheduleFrame();
      }).catch(error=>{
        if(generation!==record.generation)return;
        record.pending=false;
        if(error.name==='AbortError'){if(record.wanted)queueMicrotask(record.sync)}
        else record.blocked=true;
      });
    };
    video.addEventListener('error',()=>{
      if(record.upgraded){
        URL.revokeObjectURL(record.fullURL);record.fullURL=null;record.upgraded=false;
        record.generation++;record.pending=false;record.blocked=false;video.src=src;
      }else record.failed=true;
      record.sync();
    });
    for(const event of ['loadeddata','canplay'])video.addEventListener(event,()=>{notify();record.sync()});
    for(const event of ['progress','canplaythrough','suspend'])video.addEventListener(event,prepareFullRecording);
    video.addEventListener('playing',()=>{notify();scheduleFrame()});
    video.addEventListener('timeupdate',()=>{if(!video.requestVideoFrameCallback)notify()});
    video.src=src;
  }
  if(preloadRank[preload]>preloadRank[record.video.preload])record.video.preload=preload;
  return record;
}

document.addEventListener('visibilitychange',()=>{
  if(document.hidden)fullDownload?.controller.abort();
  videos.forEach(record=>record.sync());
});

export function preloadProjectVideo(src){if(src&&!matchMedia('(prefers-reduced-motion: reduce)').matches)getVideo(src,'auto')}
export function waitForProjectVideoData(src){
  if(!src||matchMedia('(prefers-reduced-motion: reduce)').matches)return Promise.resolve();
  const record=getVideo(src,'auto'),video=record.video;
  if(video.readyState>=2||record.failed)return Promise.resolve();
  return new Promise(resolve=>{
    const done=()=>{clearTimeout(timer);video.removeEventListener('loadeddata',done);video.removeEventListener('error',done);resolve()};
    const timer=setTimeout(done,8000);video.addEventListener('loadeddata',done,{once:true});video.addEventListener('error',done,{once:true});
  });
}

export function acquireProjectVideo(src,onFrame=()=>{}){
  const record=getVideo(src,'auto');
  const owner={},claim={active:false,callback:onFrame};record.claims.set(owner,claim);
  return {video:record.video,setActive(active){
    const changed=claim.active!==active;claim.active=active;
    if(changed&&active){record.blocked=false;if(record.video.readyState>=2)claim.callback(record.video)}
    record.sync();
  },release(){record.claims.delete(owner);record.sync()}};
}
