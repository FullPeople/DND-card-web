import {setSheetDisplayMode,useSheetDisplayMode} from './sheetDisplay';
export function SheetDisplayButton(){
  const mode=useSheetDisplayMode();
  return <button className="sheet-display-toggle" aria-pressed={mode==='screen'} aria-label={mode==='screen'?'切换为 A4 显示':'切换为非 A4 显示'} title="切换角色卡显示模式" onClick={()=>setSheetDisplayMode(mode==='screen'?'a4':'screen')}>{mode==='screen'?'非 A4 · 自适应':'A4 · 适应窗口'}</button>;
}
