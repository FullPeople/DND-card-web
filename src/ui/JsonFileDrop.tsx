import {useRef,useState} from 'react';
import './jsonFileDrop.css';

export function JsonFileDrop({disabled=false,multiple=true,kind='character',receive}:{disabled?:boolean;multiple?:boolean;kind?:'character'|'pack';receive:(files:File[])=>Promise<void>}){
 const input=useRef<HTMLInputElement>(null),flight=useRef(false),[over,setOver]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function accept(files:File[]){
  if(disabled||flight.current||!files.length)return;
  flight.current=true;setBusy(true);setError('');
  try{if(!multiple&&files.length>1)throw Error('这里一次只能导入一个 JSON 文件。');if(files.some(file=>file.size>20_000_000))throw Error('单个文件不能超过 20 MB');if(files.some(file=>!file.name.toLowerCase().endsWith('.json')))throw Error('请拖入 JSON 文件。');await receive(files);}catch(error){setError(error instanceof Error?error.message:String(error));}finally{flight.current=false;setBusy(false);}
 }
 return <div className="json-file-import"><button type="button" className={`json-file-drop ${over?'is-over':''}`} disabled={disabled||busy} onClick={()=>input.current?.click()}
  onDragEnter={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();if(!disabled&&!busy)setOver(true);}}}
  onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect=disabled||busy?'none':'copy';}}}
  onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOver(false);}}
  onDrop={event=>{event.preventDefault();event.stopPropagation();setOver(false);void accept([...event.dataTransfer.files]);}}>
  <strong>{busy?'正在校验并导入…':'拖入 JSON 文件，或点击选择文件'}</strong><span>{kind==='pack'?'选择一个扩展包；校验通过后才安装':multiple?'支持一次拖入多个角色备份':'选择一个角色备份'} · 单个文件不超过 20 MB</span>
 </button><input ref={input} hidden type="file" multiple={multiple} accept=".json,application/json" aria-label={kind==='pack'?'拖拽或选择扩展包文件':multiple?'批量导入角色文件':'单个角色文件选择'} disabled={disabled||busy} onChange={event=>{const files=[...(event.target.files||[])];event.target.value='';void accept(files);}}/>{error&&<p role="alert">{error}</p>}</div>;
}
