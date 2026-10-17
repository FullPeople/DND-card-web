let snapshot={projects:{},csrf:null,error:null},pending;
const subscribers=new Set();
const publish=()=>subscribers.forEach(callback=>callback(snapshot));
export const likesSnapshot=()=>snapshot;
export const subscribeLikes=callback=>{subscribers.add(callback);return()=>subscribers.delete(callback)};
export function refreshLikes(){
  if(pending)return pending;
  pending=fetch('/api/home/projects',{credentials:'same-origin',cache:'no-store'}).then(async response=>{
    if(!response.ok)throw Error('点赞数量加载失败');
    const data=await response.json();snapshot={projects:data.projects,csrf:data.csrf,error:null};publish();
  }).catch(()=>{snapshot={...snapshot,error:'点赞数量暂时无法读取，请重试。'};publish()}).finally(()=>{pending=null});
  return pending;
}
export async function setProjectLiked(id,liked){
  if(!snapshot.csrf){await refreshLikes();if(!snapshot.csrf)throw Error('点赞暂不可用，请稍后重试。')}
  const response=await fetch('/api/home/projects/'+encodeURIComponent(id)+'/like',{method:'PUT',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':snapshot.csrf},body:JSON.stringify({liked})});
  const data=await response.json();
  if(!response.ok){if(response.status===403)await refreshLikes();throw Error(data.error?.message||'点赞没有保存，请稍后重试。')}
  snapshot={...snapshot,projects:{...snapshot.projects,[id]:data}};publish();
}
