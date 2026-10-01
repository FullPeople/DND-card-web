import {Component,type ReactNode} from 'react';

/** A missing deferred tool must not unmount the saved card or its navigation. */
export class ToolBoundary extends Component<{children:ReactNode;label:string;close:()=>void},{error?:Error}>{
 state:{error?:Error}={};
 static getDerivedStateFromError(error:unknown){return {error:error instanceof Error?error:new Error(String(error))};}
 render(){if(!this.state.error)return this.props.children;return <section className="inline-warning tool-load-error" role="alert"><p>{this.props.label}暂时无法加载。可以检查网络后重新打开；已保存的角色仍然保留。</p><button onClick={this.props.close}>返回角色卡</button><details><summary>错误详情</summary><pre>{this.state.error.message}</pre></details></section>;}
}
