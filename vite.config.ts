import { defineConfig } from 'vite';
import {offlineShell} from './tools/offlineShell.ts';
import react from '@vitejs/plugin-react';
import {startupPreload} from './tools/startupPreload.ts';
import {standalonePlugin} from './tools/standalonePlugin.ts';
export default defineConfig(({mode})=>({ plugins: [...(['standalone','automation-standalone'].includes(mode)?[standalonePlugin()]:[]),react(), startupPreload(), offlineShell(),...(mode==='automation-standalone'?[{name:'automation-development',transformIndexHtml:(html:string)=>html.replace('DND 角色卡 · 单机版','DND 角色卡 · 自动化开发版')}]:[])], base: './', build:{target:['chrome109','edge109','firefox102','safari15.4'],outDir:mode==='automation-standalone'?'dist-automation':mode==='standalone'?'dist-standalone':'dist'},server: { port: mode==='automation-standalone'?5190:5178, strictPort: true,host:'127.0.0.1' } }));
