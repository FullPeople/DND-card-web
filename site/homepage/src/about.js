import './about.css';

export function mountAbout(){
  const open=document.querySelector('#about-open'),dialog=document.querySelector('#about-dialog');
  open.addEventListener('click',()=>{
    if(dialog.querySelector('.about-content')===null){
      dialog.innerHTML=`<section class="about-content" aria-labelledby="about-title">
        <button type="button" class="about-close" aria-label="关闭关于我">×</button>
        <p class="about-eyebrow">FullPeople</p><h2 id="about-title">关于我</h2>
        <p class="about-description">这个人暂时没空填写这部分的内容。他说已加入待办。</p>
        <div class="about-support-links"><a href="https://ko-fi.com/fullpeople" target="_blank" rel="noopener noreferrer">Ko-fi <span aria-hidden="true">↗</span></a></div>
        <div class="about-qrs"><figure><img src="/card/support/wechat.png" alt="微信支持二维码" decoding="async"><figcaption>微信</figcaption></figure><figure><img src="/card/support/alipay.jpg" alt="支付宝支持二维码" decoding="async"><figcaption>支付宝</figcaption></figure></div>
      </section>`;
      dialog.querySelector('.about-close').addEventListener('click',()=>dialog.close());
    }
    dialog.showModal();open.setAttribute('aria-expanded','true');
  });
  dialog.addEventListener('close',()=>{open.setAttribute('aria-expanded','false');open.focus()});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close()}});
  new MutationObserver(()=>{if(document.body.dataset.intro!=='complete'&&dialog.open)dialog.close()}).observe(document.body,{attributes:true,attributeFilter:['data-intro']});
}
