import {useRef,useState} from 'react';
import type {Edition} from '../core/model';

export function QuickStart({edition,locked,canImport=true,start,importCard,settings}:{edition:Edition;locked:boolean;canImport?:boolean;start:(edition:Edition)=>Promise<void>;importCard:()=>void;settings:()=>void}){
 const [chosen,choose]=useState(edition),[busy,setBusy]=useState(false),[error,setError]=useState(''),flight=useRef(false);
 async function begin(){if(flight.current)return;flight.current=true;setBusy(true);setError('');try{await start(chosen);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{flight.current=false;setBusy(false);}}
 return <section className="quick-start"><p>先确定规则版本，就可以开始填写。已有角色卡可以直接导入。</p><fieldset disabled={busy}><legend>{locked?'房间规则版本':'角色规则版本'}</legend><div className="quick-start-editions" role="radiogroup" aria-label="开始使用的规则版本">{(['2014','2024'] as const).map(value=><button type="button" key={value} role="radio" aria-checked={chosen===value} disabled={locked} onClick={()=>choose(value)}><strong>{value}</strong><span>{value==='2014'?'第五版':'修订版'}</span></button>)}</div><p className="muted">{locked?'规则由 DM 管理。你可以直接填写当前角色。':'已启用的来源和选项保持原样，之后可在“规则与扩展”中调整。'}</p><div className="quick-start-actions"><button className="primary" onClick={()=>void begin()}>{busy?'正在打开…':'开始填写'}</button>{canImport&&<button onClick={importCard}>导入已有角色</button>}</div><button className="text-link" onClick={settings}>规则与扩展 · 高级设置</button></fieldset>{error&&<p role="alert">{error}</p>}</section>;
}
