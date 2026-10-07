import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:'library',publicDir:false,plugins:[react()],base:'/library/',build:{outDir:'../dist-library',emptyOutDir:true,target:['chrome109','edge109','firefox102','safari15.4']}});
