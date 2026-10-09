const root=document.querySelector('#home-qq-account');
const login=root.cloneNode(true);
async function update(){
  try{
    const response=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return;
    const session=await response.json();if(!session.authenticated||!session.account){root.replaceChildren(...Array.from(login.cloneNode(true).childNodes));return;}
    const nodes=[];
    if(session.account.avatar){const image=document.createElement('img');image.src=session.account.avatar;image.className='qq-avatar';image.alt='';image.referrerPolicy='no-referrer';nodes.push(image);}
    const name=document.createElement('span');name.className='qq-name';name.textContent=session.account.nickname||'QQ 已登录';nodes.push(name);
    const button=document.createElement('button');button.type='button';button.textContent='退出登录';button.onclick=async()=>{button.disabled=true;try{const result=await fetch('/api/logout',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'X-CSRF-Token':session.csrf}});if(result.ok)location.reload();else button.disabled=false;}catch{button.disabled=false;}};nodes.push(button);root.replaceChildren(...nodes);
  }catch{}
}
void update();window.addEventListener('focus',()=>{if(document.visibilityState==='visible')void update();});
