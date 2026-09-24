import './platform/tone';
import { createRoot } from 'react-dom/client';
import { SourceProvider } from './ui/SourceName';
import App from './ui/App';
import './ui/style.css';
import './ui/workspace.css';
import './ui/overview.css';
import './ui/library.css';
import './ui/cardAtmosphere.css';
createRoot(document.getElementById('root')!).render(<SourceProvider><App/></SourceProvider>);
import './ui/libraryRefine.css';

import './ui/characterPages.css';
import './ui/suiteTheme.css';
import './ui/responsive176.css';

import './ui/refinement183.css';
