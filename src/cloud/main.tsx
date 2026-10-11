import {createRoot} from 'react-dom/client';
// Night mode and the saved palette apply from the first paint instead of waiting for the sheet preview chunk.
import '../platform/tone';
import '../platform/appearance';
import LibraryApp from './LibraryApp';
import {PluginLogin} from './PluginLogin';
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).get('pluginAuth')==='1'?<PluginLogin/>:<LibraryApp/>);
