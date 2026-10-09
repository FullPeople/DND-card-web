import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {automationProgressPlugin} from './tools/automationProgressPlugin';
export default defineConfig({root:'library',publicDir:'../public',plugins:[automationProgressPlugin(fileURLToPath(new URL('.',import.meta.url))),react()],base:'/library/',build:{outDir:'../dist-library',emptyOutDir:true,target:['chrome109','edge109','firefox102','safari15.4']}});
