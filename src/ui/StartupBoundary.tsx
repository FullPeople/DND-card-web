import {Component,useEffect,type ReactNode} from 'react';

function ready(){window.dispatchEvent(new Event('dnd-card-ready'));}
/** Runs only after the lazy application has committed, not while its chunk is pending. */
export function StartupReady({children}:{children:ReactNode}){useEffect(ready,[]);return children;}

export class StartupBoundary extends Component<{children:ReactNode},{error?:Error}>{
 state:{error?:Error}={};
 static getDerivedStateFromError(error:unknown){return {error:error instanceof Error?error:new Error(String(error))};}
 componentDidCatch(){window.dispatchEvent(new Event('dnd-card-failed'));}
 render(){const error=this.state.error;if(!error)return this.props.children;
  return <section className="startup-panel" role="alert"><h1>角色卡程序加载失败</h1><p>请检查网络或浏览器扩展是否拦截了本站，再尝试重新加载。旧版浏览器可以尝试升级后打开。</p><p>重新加载不会清除已保存的角色卡；尚未保存的修改可能丢失。</p><button type="button" onClick={()=>location.reload()}>重新加载</button><details><summary>错误详情（可复制给开发者）</summary><pre>{error.name}: {error.message}{'\n'}{navigator.userAgent}</pre></details></section>;
 }
}
