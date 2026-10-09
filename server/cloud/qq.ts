import type {IncomingMessage,ServerResponse} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {CloudError,CloudStore} from './store';

export interface QQConfig {appId:string;appKey:string;callback:string;fetch?:typeof fetch}
export function qqReturnTo(value:string|null,origin:string){
  if(!value||value.length>2048)return '/';
  try {const url=new URL(value,origin);if(url.origin===origin&&!url.username&&!url.password&&['/','/card/','/library/'].includes(url.pathname))return url.pathname+url.search+url.hash;}catch{}
  return '/';
}
const cookie=(request:IncomingMessage,name:string)=>request.headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith(name+'='))?.slice(name.length+1);
const equal=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function qqPage(response:ServerResponse,status:number,message:string,back='/'){
  response.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"});
  response.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QQ 登录 · 弗人城堡</title><style>body{font:16px/1.8 system-ui,sans-serif;max-width:32rem;margin:12vh auto;padding:24px;color:#333;background:#f5f2e9}a{color:#245a84}</style><h1>QQ 登录</h1><p>${escape(message)}</p><a href="${escape(back)}">返回网站</a></html>`);
}
export function createQQAuth(store:CloudStore,origin:string,config?:QQConfig){
  const ready=!!config?.appId&&!!config?.appKey;
  if(ready){const callback=new URL(config!.callback);if(callback.origin!==origin||callback.pathname!=='/api/auth/qq/callback'||callback.search||callback.hash||!/^\d{5,20}$/.test(config!.appId))throw Error('Invalid QQ OAuth configuration');}
  const pending=new Map<string,{nonce:string;returnTo:string;expires:number}>();
  const flags='; Path=/api/auth/qq/; '+(origin.startsWith('https:')?'Secure; ':'')+'HttpOnly; SameSite=Lax';
  async function provider(path:string,params:Record<string,string>){
    const url=new URL(path,'https://graph.qq.com');url.search=new URLSearchParams(params).toString();
    const result=await (config!.fetch||fetch)(url,{signal:AbortSignal.timeout(10000),redirect:'error'});
    if(!result.ok)throw new CloudError(502,'qq_provider','QQ 授权服务暂时无法连接，请返回网站重试。');
    const text=(await result.text()).trim();if(text.length>32768)throw new CloudError(502,'qq_provider','QQ 授权结果无效，请返回网站重试。');
    let data:Record<string,unknown>;
    try{data=text.startsWith('callback')?JSON.parse(text.replace(/^callback\s*\(\s*/,'').replace(/\s*\)\s*;?$/,'')):text.startsWith('{')?JSON.parse(text):Object.fromEntries(new URLSearchParams(text));}catch{throw new CloudError(502,'qq_provider','QQ 授权结果无效，请返回网站重试。');}
    if(data.error||data.ret!==undefined&&Number(data.ret)!==0)throw new CloudError(502,'qq_provider','QQ 未完成授权，请确认应用配置或返回网站重试。');
    return data;
  }
  return {ready,async handle(request:IncomingMessage,response:ServerResponse,url:URL){
    if(request.method!=='GET'||!['/api/auth/qq/login','/api/auth/qq/callback'].includes(url.pathname))return false;
    const back=qqReturnTo(url.searchParams.get('returnTo'),origin);
    if(!ready){qqPage(response,503,'网站尚未完成 QQ 登录配置，请稍后重试。本机角色卡仍可使用。',back);return true;}
    if(url.pathname.endsWith('/login')){
      const now=Date.now();for(const [state,row] of pending)if(row.expires<now)pending.delete(state);
      if(pending.size>=1000)throw new CloudError(429,'qq_busy','登录请求过多，请稍后重试。');
      const state=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url');pending.set(state,{nonce,returnTo:back,expires:now+600000});
      const target=new URL('https://graph.qq.com/oauth2.0/authorize');target.search=new URLSearchParams({response_type:'code',client_id:config!.appId,redirect_uri:config!.callback,scope:'get_user_info',state}).toString();
      response.writeHead(302,{'Location':target.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':'dnd_qq_state='+nonce+flags+'; Max-Age=600'});response.end();return true;
    }
    const state=url.searchParams.get('state')||'',row=pending.get(state),nonce=cookie(request,'dnd_qq_state')||'';
    if(!row||row.expires<Date.now()||!equal(nonce,row.nonce)){qqPage(response,400,'登录请求已失效，请从网站上的 QQ 登录按钮重新开始。');return true;}
    pending.delete(state);response.setHeader('Set-Cookie','dnd_qq_state='+flags+'; Max-Age=0');
    if(url.searchParams.has('error')){qqPage(response,400,'你已取消 QQ 授权，网站没有登录。',row.returnTo);return true;}
    const code=url.searchParams.get('code');if(!code||code.length>512){qqPage(response,400,'QQ 没有返回有效的授权结果，请重新登录。',row.returnTo);return true;}
    try{
      const token=await provider('/oauth2.0/token',{grant_type:'authorization_code',client_id:config!.appId,client_secret:config!.appKey,code,redirect_uri:config!.callback});
      if(typeof token.access_token!=='string'||!token.access_token||token.access_token.length>512)throw new CloudError(502,'qq_provider','QQ 授权结果无效，请重新登录。');
      const identity=await provider('/oauth2.0/me',{access_token:token.access_token});
      if(String(identity.client_id)!==config!.appId||typeof identity.openid!=='string'||!/^[a-f\d]{32}$/i.test(identity.openid))throw new CloudError(502,'qq_identity','QQ 身份验证失败，请重新登录。');
      // OpenID identifies this application account. It is never a QQ number.
      const account=store.provisionVerifiedAccount('qq:'+config!.appId+':'+identity.openid.toUpperCase());
      try{const profile=await provider('/user/get_user_info',{access_token:token.access_token,oauth_consumer_key:config!.appId,openid:identity.openid});store.saveQQProfile(account.id,profile.nickname,profile.figureurl_qq_2||profile.figureurl_qq_1);}catch{/* Profile permission may be pending; verified identity remains valid. */}
      const issued=store.issueVerifiedSession(account.id,30*86400000);
      response.writeHead(302,{'Location':row.returnTo,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':['dnd_qq_state='+flags+'; Max-Age=0','dnd_cloud='+issued.token+'; Path=/api/; '+(origin.startsWith('https:')?'Secure; ':'')+'HttpOnly; SameSite=Strict; Max-Age=2592000']});response.end();
    }catch{qqPage(response,502,'QQ 登录未完成，请确认应用回调配置并重新登录。本机角色卡保留。',row.returnTo);}
    return true;
  }};
}
