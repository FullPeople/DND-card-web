import {createRoot} from 'react-dom/client';
import {DicePage} from '../../../src/ui/Workbench';
import {useWorkbench} from '../../../src/platform/workbench';

function DiceFrameHarness(){
 const wb=useWorkbench();
 return <><output aria-label="桥接连接">{wb.online?'online':'offline'}</output><output aria-label="桥接目标">{wb.target?.key||''}</output><DicePage online={wb.online} target={wb.target} rolls={wb.rolls}/></>;
}
createRoot(document.getElementById('root')!).render(<DiceFrameHarness/>);
