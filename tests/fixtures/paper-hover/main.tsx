import {useCallback,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {newCharacter,type Entry} from '../../../src/core/model';
import {PaperFrame,type SheetPage} from '../../../src/ui/PaperFrame';
import {DragContext} from '../../../src/ui/DragEntry';
import {RetainedCardVisibility,RetainedCardCaptureTarget} from '../../../src/ui/RetainedCardVisibility';
const c=newCharacter(),entry:Entry={id:'fixture',name:'原创特性',english:'Authored feature',kind:'feature',source:'XPHB',edition:'2024',packId:'fixture',revision:'1',raw:{},entries:[]};
function App(){
 const [page,setPage]=useState<SheetPage>('主要'),[hoverTab,setHoverTab]=useState<string>(),[visible,setVisible]=useState(true),active=useRef(true);
 const target=useCallback(()=>active.current,[]);
 const surface=useMemo(()=><PaperFrame character={c} page={page} changePage={setPage} effectsEnabled={false} motionEnabled={false}><div>原创卡面</div></PaperFrame>,[page]);
 return <><button onClick={()=>setHoverTab('特性')}>拖到特性页签</button><button onClick={()=>{active.current=false;setVisible(false);}}>切离角色卡</button><output id="current-page">{page}</output><output id="visible">{String(visible)}</output><RetainedCardVisibility.Provider value={visible}><RetainedCardCaptureTarget.Provider value={target}><DragContext.Provider value={{editing:true,preservePage:false,entry:hoverTab?entry:undefined,intent:'entry',character:c,hoverTab,register:()=>()=>{},start:()=>{}}}><div style={{width:800,height:900}}>{surface}</div></DragContext.Provider></RetainedCardCaptureTarget.Provider></RetainedCardVisibility.Provider></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
