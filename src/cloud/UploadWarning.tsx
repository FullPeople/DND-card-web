export function UploadWarning({temporary=true}:{temporary?:boolean}){if(!temporary)return <div className="cloud-upload-warning"><p>完整角色卡将保存到当前 QQ 账号。只有你和你授权的账号可以访问；加载到枭熊房间并解锁后，该房间可以修改原卡。</p><p>请保留完整 JSON 备份。多人同时保存发生冲突时，本机草稿会保留。</p></div>;return <div className="cloud-upload-warning">
 <p>目前保存还在内测阶段，这意味着你的卡将会无条件<strong>公之于众</strong>。</p>
 <p>等未来接入登陆和便捷的账号系统后，该问题会得到解决。</p>
 <p>请确保你真的同意，并且不要在卡内填写隐私信息。</p>
 </div>;}
