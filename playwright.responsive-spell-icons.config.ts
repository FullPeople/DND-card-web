import {defineConfig} from '@playwright/test';

// Exercise the normal production bundle, including its real Quickbar and CSS.
export default defineConfig({
  testDir:'./tests/production',testMatch:'responsiveSpellIcons.spec.ts',
  timeout:60000,expect:{timeout:12000},workers:1,retries:0,reporter:'list',
  outputDir:process.env.DND_ICON_ARTIFACTS||'.local-evidence/responsive-spell-icons/playwright',
  use:{baseURL:'http://127.0.0.1:5341',viewport:{width:1440,height:1000},
    channel:process.env.DND_ICON_BROWSER_CHANNEL==='msedge'?'msedge':undefined,
    launchOptions:process.env.DND_EDGE_EXECUTABLE?{executablePath:process.env.DND_EDGE_EXECUTABLE}:undefined,
    trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'node node_modules/vite/bin/vite.js preview --outDir dist-standalone --host 127.0.0.1 --port 5341 --strictPort',
    url:'http://127.0.0.1:5341',reuseExistingServer:!process.env.CI},
});
