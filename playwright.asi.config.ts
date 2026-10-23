import {defineConfig} from '@playwright/test';
import infusion from './playwright.infusions.config';
export default defineConfig({...infusion,testMatch:['asiAllocation.spec.ts'],outputDir:'.local-evidence/asi-browser'});
