import {EntryMenuProvider} from './ui/EntrySharing';
import {UiLanguageProvider} from './ui/UiLanguage';
import './platform/tone';
import { createRoot } from 'react-dom/client';
import { SourceProvider } from './ui/SourceName';
import {lazy,Suspense} from 'react';
import {StartupBoundary,StartupReady} from './ui/StartupBoundary';
performance.mark('dnd-card:app-entry');
window.dispatchEvent(new CustomEvent('dnd-card-stage',{detail:'正在加载角色卡界面'}));
const viewer=new URLSearchParams(location.search).get('legacyViewer')==='1';
// Keep dynamic imports in separate lazy callbacks so the production bundler
// attaches each entry's own CSS dependencies (including the standalone reader).
const App=viewer?lazy(()=>import('./ui/PlayerViewer')):lazy(()=>import('./ui/App'));
import './ui/style.css';
import './ui/characterTabs.css';
import './ui/workspace.css';
import './ui/overview.css';
import './ui/library.css';
import './ui/cardAtmosphere.css';
const app=<Suspense fallback={null}>{viewer?<StartupReady><App/></StartupReady>:<App/>}</Suspense>;
createRoot(document.getElementById('root')!).render(<StartupBoundary><UiLanguageProvider><SourceProvider>{viewer?app:<EntryMenuProvider>{app}</EntryMenuProvider>}</SourceProvider></UiLanguageProvider></StartupBoundary>);
import './ui/libraryRefine.css';

import './ui/characterPages.css';
import './ui/suiteTheme.css';
import './ui/responsive176.css';

import './ui/refinement183.css';
import './ui/domesticCompact.css';
import './ui/screenLayout.css';
