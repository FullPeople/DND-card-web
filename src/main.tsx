import {EntryMenuProvider} from './ui/EntrySharing';
import './platform/tone';
import { createRoot } from 'react-dom/client';
import { SourceProvider } from './ui/SourceName';
import {lazy,Suspense} from 'react';
const viewer=new URLSearchParams(location.search).get('legacyViewer')==='1';
// Keep dynamic imports in separate lazy callbacks so the production bundler
// attaches each entry's own CSS dependencies (including the standalone reader).
const App=viewer?lazy(()=>import('./ui/PlayerViewer')):lazy(()=>import('./ui/App'));
import './ui/style.css';
import './ui/workspace.css';
import './ui/overview.css';
import './ui/library.css';
import './ui/cardAtmosphere.css';
const app=<Suspense fallback={<p role="status">正在读取角色卡…</p>}><App/></Suspense>;
createRoot(document.getElementById('root')!).render(<SourceProvider>{viewer?app:<EntryMenuProvider>{app}</EntryMenuProvider>}</SourceProvider>);
import './ui/libraryRefine.css';

import './ui/characterPages.css';
import './ui/suiteTheme.css';
import './ui/responsive176.css';

import './ui/refinement183.css';
import './ui/domesticCompact.css';
