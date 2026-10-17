import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// Isolated UI fixtures exercise the dashboard without producing a release.
// The ordinary development and production configurations retain every audit gate.
export default defineConfig({plugins:[react()],cacheDir:'.cache/vite-loading-feedback-fixture',optimizeDeps:{entries:['tests/fixtures/overview-dashboard235/index.html'],include:['react','react-dom','react-dom/client']},server:{host:'127.0.0.1',port:5330,strictPort:true}});
