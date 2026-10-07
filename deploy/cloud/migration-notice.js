(()=>{
 const ready=()=>{
  if(document.documentElement.dataset.cardStartup!=='complete'||document.getElementById('card-migration-notice'))return;
  try{if(sessionStorage.getItem('card-migration252-dismissed'))return;}catch{}
  const aside=document.createElement('aside');aside.id='card-migration-notice';aside.setAttribute('aria-label','独立角色卡迁移说明');
  Object.assign(aside.style,{position:'fixed',bottom:'8px',right:'8px',maxWidth:'340px',padding:'12px',background:'#e5e5e5',color:'#292a2d',border:'4px solid #50525b',zIndex:'1000',font:'13px/1.6 system-ui',boxShadow:'0 3px 15px #0004'});
  const heading=document.createElement('strong');heading.textContent='独立角色卡已迁至 dnd.center';aside.append(heading);
  const text=document.createElement('p');text.textContent='旧站仍可读取、保存和导出。迁移前，请在“导入 / 导出”选择“全部可见角色”并下载 JSON，再到新站批量导入并核对五页与资源。存档不会自动跨域搬运。';aside.append(text);
  const link=document.createElement('a');link.href='https://dnd.center/card/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='打开新站（先导出旧站备份）';aside.append(link);
  const help=document.createElement('a');help.href='https://dnd.center/library/';help.target='_blank';help.rel='noopener noreferrer';help.textContent='迁移说明';help.style.marginLeft='10px';aside.append(help);
  const close=document.createElement('button');close.textContent='暂时收起';close.style.marginLeft='10px';close.onclick=()=>{aside.remove();try{sessionStorage.setItem('card-migration252-dismissed','1');}catch{}};aside.append(close);document.body.append(aside);
 };
 window.addEventListener('dnd-card-startup',ready);ready();
})();
