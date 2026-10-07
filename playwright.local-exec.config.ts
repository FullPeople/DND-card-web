// Local-only wrapper (untracked): run any project config with the pre-installed
// Chromium instead of the browser build pinned by this @playwright/test version.
import {defineConfig} from '@playwright/test';
const name=process.env.PW_BASE||'playwright.dashboard237.config.ts';
const base=(await import(`./${name}`)).default;
const executablePath=process.env.PW_EXEC||'/opt/pw-browsers/chromium';
const patch=(use:Record<string,unknown>={})=>({...use,launchOptions:{...((use.launchOptions as Record<string,unknown>)||{}),executablePath}});
export default defineConfig({...base,use:patch(base.use),projects:base.projects?.map((project:any)=>({...project,use:patch(project.use)}))});
