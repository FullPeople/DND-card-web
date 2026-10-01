import {defineConfig} from '@playwright/test';
import {SERVER_SYNC_E2E} from './tests/helpers/serverSyncBrowserBackend.ts';
// Real-browser server sync acceptance: Go backend + temporary SQLite behind the Vite /api proxy.
process.env.DND_SERVER_SYNC_E2E='1';
export default defineConfig({testDir:'./tests/e2e',outputDir:'test-results/server-sync',testMatch:['serverSync.spec.ts'],timeout:90000,expect:{timeout:15000},workers:1,reporter:'list',
  use:{baseURL:`http://127.0.0.1:${SERVER_SYNC_E2E.appPort}`,channel:process.env.CI?undefined:process.env.PW_CHANNEL||'chrome',viewport:{width:1512,height:982},trace:'retain-on-failure'},
  webServer:[
    {command:'node tests/helpers/serverSyncBrowserBackend.ts',url:`http://127.0.0.1:${SERVER_SYNC_E2E.backendPort}/health`,reuseExistingServer:false,timeout:180000},
    {command:`node node_modules/vite/bin/vite.js --mode standalone --host 127.0.0.1 --port ${SERVER_SYNC_E2E.appPort}`,url:`http://127.0.0.1:${SERVER_SYNC_E2E.appPort}`,reuseExistingServer:false,env:{DND_BACKEND_URL:`http://127.0.0.1:${SERVER_SYNC_E2E.backendPort}`}},
  ]});
