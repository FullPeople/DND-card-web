import {createRoot} from 'react-dom/client';
import {UiLanguageProvider} from '../ui/UiLanguage';
import {SourceProvider} from '../ui/SourceName';
import WikiApp from './WikiApp';
import '../ui/style.css';
import '../ui/library.css';
import '../ui/libraryRefine.css';
import './wiki.css';

createRoot(document.getElementById('root')!).render(<UiLanguageProvider><SourceProvider><WikiApp/></SourceProvider></UiLanguageProvider>);
