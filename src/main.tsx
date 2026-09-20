import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './ui/style.css';
import './ui/workspace.css';
import './ui/overview.css';
createRoot(document.getElementById('root')!).render(<App/>);
