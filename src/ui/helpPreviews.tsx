import {CloudCheckIcon,CloudUploadIcon} from './icons';
/** Miniature screens shown inside HelpHint. They are illustrations only. */
export function BookPreview(){
 return <div className="mini">
  <div className="mini-row"><div className="mini-card is-current"><b>艾琳 · 游侠 5</b><small>HP 38/42 · AC 16</small><span className="mini-chip is-on">当前</span></div></div>
  <div className="mini-row"><div className="mini-card"><b>索恩 · 牧师 3</b><small>HP 21/27 · AC 18</small><span className="mini-chip">可编辑</span></div></div>
  <div className="mini-row"><div className="mini-card"><b>怪物 · 地精</b><small>HP 7/7 · AC 15</small><span className="mini-chip">只读</span></div></div>
  <div className="mini-row"><span className="mini-chip">＋ 2024 角色</span><span className="mini-chip">导出 JSON</span><span className="mini-chip">审卡</span></div>
 </div>;
}
export function PalettePreview(){
 return <div className="mini">
  <div className="mini-row"><div className="mini-toggle"><span className="is-on">基础界面</span><span>Wiki</span><span>角色卡组件</span></div></div>
  <div className="mini-row"><div className="mini-swatches"><i className="mini-swatch" style={{background:'#d1d1d1'}}/><i className="mini-swatch" style={{background:'#f5f5f3'}}/><i className="mini-swatch" style={{background:'#747474'}}/><i className="mini-swatch" style={{background:'#343532'}}/><i className="mini-swatch" style={{background:'#50525b'}}/><i className="mini-swatch" style={{background:'#b58b2d'}}/></div></div>
  <div className="mini-sheet"><div className="mini-band">角色名</div><div className="mini-sheet-grid"><i className="mini-cell"/><i className="mini-cell is-dashed"/></div></div>
  <span className="mini-note">悬停圆钮会高亮卡面上对应的区域</span>
 </div>;
}
export function CloudPreview({uploaded=false}:{uploaded?:boolean}){
 return <div className="mini">
  <div className="mini-row"><div className="mini-card"><b>本机角色卡</b><small>浏览器保存</small></div><span className="mini-arrow">→</span><div className="mini-cloud">{uploaded?<CloudCheckIcon/>:<CloudUploadIcon/>}</div><span className="mini-arrow">→</span><div className="mini-card"><b>QQ 卡库</b><small>10 个槽位</small></div></div>
  <div className="mini-row"><span className={`mini-chip${uploaded?'':' is-on'}`}>仅本机</span><span className={`mini-chip${uploaded?' is-on':''}`}>已上传 · 自动同步</span><span className="mini-chip">房间修改写回</span></div>
  <span className="mini-note">卡主可授权其他账号编辑；冲突时保留本机草稿</span>
 </div>;
}
export function AccountPreview({nickname}:{nickname?:string}){
 return <div className="mini">
  <div className="mini-row"><div className="mini-avatar">QQ</div><div className="mini-card"><b>{nickname||'你的昵称'}</b><small>账号 ID 可复制给卡主</small></div></div>
  <div className="mini-row"><span className="mini-chip is-on">私人卡库</span><span className="mini-chip">跨设备打开</span><span className="mini-chip">枭熊房间写回</span></div>
  <span className="mini-note">未登录时角色只保存在当前浏览器</span>
 </div>;
}
export function RulesPreview(){
 return <div className="mini">
  <div className="mini-row"><span>基础版本</span><div className="mini-toggle"><span>2014</span><span className="is-on">2024</span></div></div>
  <div className="mini-row"><i className="mini-check is-on"/><span>玩家手册 2024</span></div>
  <div className="mini-row"><i className="mini-check is-on"/><span>XGE 万物指南</span></div>
  <div className="mini-row"><i className="mini-check"/><span>自定义扩展包 JSON</span></div>
  <span className="mini-note">禁用来源会保留已选条目并标记受限</span>
 </div>;
}
export function TransferPreview(){
 return <div className="mini">
  <div className="mini-row"><span className="mini-file">JSON</span><span className="mini-file">Excel</span><span className="mini-arrow">→</span><div className="mini-card"><b>导入到角色簿</b><small>校验后再写入</small></div></div>
  <div className="mini-row"><div className="mini-card"><b>当前角色</b><small>完整五页</small></div><span className="mini-arrow">→</span><span className="mini-file">JSON</span><span className="mini-file">PNG</span><span className="mini-file">PDF</span></div>
  <span className="mini-note">“读取上一次保存”可恢复本机备份</span>
 </div>;
}
export function AnnouncementPreview(){
 return <div className="mini">
  <div className="mini-card"><b>版本更新与常见问题</b><small>v 0.1.x</small></div>
  <div className="mini-row"><span className="mini-chip">新功能</span><span className="mini-chip">已修复</span><span className="mini-chip">Q&amp;A</span></div>
 </div>;
}
export function WorkbenchPreview({label}:{label:string}){
 return <div className="mini"><div className="mini-card"><b>{label}</b><small>在左侧功能页打开</small></div></div>;
}
