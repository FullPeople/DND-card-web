import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', testMatch: ['wikiMotion232.spec.ts', 'wikiColumns232.spec.ts', 'wikiEdition232.spec.ts', 'featureCollapse232.spec.ts', 'sourceChoices232.spec.ts', 'domestic189.spec.ts'],
  outputDir: '.local-evidence/wiki232', workers: 1, timeout: 45000, expect: {timeout: 12000},
  reporter: [['list'], ['json', {outputFile: '.local-evidence/wiki232/report.json'}]],
  use: {browserName: 'chromium', launchOptions: process.env.DND_CHROMIUM_PATH ? {executablePath: process.env.DND_CHROMIUM_PATH} : undefined, baseURL: 'http://127.0.0.1:5684', viewport: {width:2560,height:1080}, serviceWorkers:'block', trace:'retain-on-failure', screenshot:'only-on-failure'},
  webServer: {command:'node node_modules/vite/bin/vite.js --mode standalone --host 127.0.0.1 --port 5684 --strictPort',url:'http://127.0.0.1:5684',reuseExistingServer:false},
});
