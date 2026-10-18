import {setSheetDisplayMode,useSheetDisplayMode} from './sheetDisplay';
export function SheetDisplayButton(){
  const mode=useSheetDisplayMode();
  return <button className="sheet-display-toggle" aria-pressed={mode==='screen'} aria-label={mode==='screen'?'切换为 A4 显示':'切换为非 A4 显示'} title={mode==='screen'?'当前：清晰操作；点击切换为纸卡总览（A4）':'当前：纸卡总览（A4）；点击切换为清晰操作，放大字段与操作区域'} onClick={()=>setSheetDisplayMode(mode==='screen'?'a4':'screen')}>{mode==='screen'?'清晰操作':'纸卡总览 · A4'}</button>;
}
