import {createRoot} from 'react-dom/client';
import {cloudFeaturesEnabled} from './availability';
import {installCloudSuspension} from './suspension';
import {CloudSuspended} from './CloudSuspended';
import './suspended.css';
// Night mode and the saved palette apply from the first paint instead of waiting for the sheet preview chunk.
import '../platform/tone';
import '../platform/appearance';
import LibraryApp from './LibraryApp';
import {PluginLogin} from './PluginLogin';
installCloudSuspension(globalThis,location.href);
createRoot(document.getElementById('root')!).render(!cloudFeaturesEnabled?<CloudSuspended/>:new URLSearchParams(location.search).get('pluginAuth')==='1'?<PluginLogin/>:<LibraryApp/>);
