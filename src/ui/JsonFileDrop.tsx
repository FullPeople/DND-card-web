import {useRef,useState} from 'react';
import './jsonFileDrop.css';

export function JsonFileDrop({disabled=false,multiple=true,kind='character',receive}:{disabled?:boolean;multiple?:boolean;kind?:'character'|'pack';receive:(files:File[])=>Promise<void>}){
 const input=useRef<HTMLInputElement>(null),flight=useRef(false),[over,setOver]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function accept(files:File[]){
  if(disabled||flight.current||!files.length)return;
  flight.current=true;setBusy(true);setError('');
  try{if(!multiple&&files.length>1)throw Error('这里一次只能导入一个文件。');if(files.some(file=>file.size>20_000_000))throw Error('单个文件不能超过 20 MB');if(files.some(file=>!(kind==='pack'?/\.json$/i:/\.(json|xlsx)$/i).test(file.name)))throw Error(kind==='pack'?'请拖入 JSON 扩展包。':'请选择 JSON 或旧版角色模板的 .xlsx 文件；不支持 .xls');await receive(files);}catch(error){setError(error instanceof Error?error.message:String(error));}finally{flight.current=false;setBusy(false);}
 }
 return <div className="json-file-import"><button type="button" className={`json-file-drop ${over?'is-over':''}`} disabled={disabled||busy} onClick={()=>input.current?.click()}
  onDragEnter={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();if(!disabled&&!busy)setOver(true);}}}
  onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect=disabled||busy?'none':'copy';}}}
  onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOver(false);}}
  onDrop={event=>{event.preventDefault();event.stopPropagation();setOver(false);void accept([...event.dataTransfer.files]);}}>
  <strong>{busy?'正在校验文件…':kind==='pack'?'拖入 JSON 文件，或点击选择文件':'拖入 JSON / Excel 文件，或点击选择文件'}</strong><span>{kind==='pack'?'选择一个扩展包；校验通过后才安装':multiple?'支持多个角色备份和旧版 2014／2024 Excel 模板':'角色备份或旧版 2014／2024 Excel 模板'} · 单个文件不超过 20 MB</span>
 </button><input ref={input} hidden type="file" multiple={multiple} accept={kind==='pack'?'.json,application/json':'.json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'} aria-label={kind==='pack'?'拖拽或选择扩展包文件':multiple?'批量导入角色文件':'单个角色文件选择'} disabled={disabled||busy} onChange={event=>{const files=[...(event.target.files||[])];event.target.value='';void accept(files);}}/>{error&&<p role="alert">{error}</p>}</div>;
}
