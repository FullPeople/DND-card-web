import {createRoot} from 'react-dom/client';
import LibraryApp from './LibraryApp';
import {PluginLogin} from './PluginLogin';
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).get('pluginAuth')==='1'?<PluginLogin/>:<LibraryApp/>);
